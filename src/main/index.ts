import { autoUpdater } from 'electron-updater'
import { app, dialog, Menu, shell, BrowserWindow, Notification } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { openDb } from './db'
import { getSettings, loadSettings } from './settings'
import { applyTheme, registerIpc, pickFolder } from './ipc'
import { SessionManager } from './sessions'
import { PtyManager } from './pty'
import { createClaudeProvider } from './providers/claude'
import { CodexAdapter } from './providers/codex'
import icon from '../../resources/icon.png?asset'

let mainWindow: BrowserWindow | null = null
let manager: SessionManager | undefined
let quitConfirmed = false
const codex = new CodexAdapter()

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const win = mainWindow
  win.on('ready-to-show', () => win.show())
  win.on('closed', () => (mainWindow = null))

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // shortcut: unsigned builds can't auto-update on macOS; this only works once signing is set up. Errors are ignored (offline, no release yet).
  if (app.isPackaged) autoUpdater.checkForUpdatesAndNotify().catch(() => {})
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  loadSettings(join(app.getPath('userData'), 'settings.json'))
  applyTheme()
  const send = (channel: string, ...args: unknown[]): void => mainWindow?.webContents.send(channel, ...args)
  const needsYou = new Set<string>()
  const pty = new PtyManager((id, data) => send('evt:term', id, data))
  ptys = pty
  manager = new SessionManager({
    db: openDb(join(app.getPath('userData'), 'agentdeck.db')),
    adapters: { claude: createClaudeProvider(), codex },
    worktreesDir: join(app.getPath('userData'), 'worktrees'),
    accountsDir: join(app.getPath('userData'), 'accounts'),
    pickFolder: () => pickFolder(mainWindow),
    pty,
    emit: {
      event: (id, e) => send('evt:event', id, e),
      session: (s) => {
        send('evt:session', s)
        if (s.status === 'needs-you') needsYou.add(s.id)
        else needsYou.delete(s.id)
        app.dock?.setBadge(needsYou.size ? String(needsYou.size) : '')
        if (['done', 'needs-you', 'error'].includes(s.status) && getSettings().notify[s.status as 'done'] && !mainWindow?.isFocused()) {
          const n = new Notification({ title: { done: 'Session done', 'needs-you': 'Session needs you', error: 'Session failed' }[s.status as 'done'], body: s.title })
          n.on('click', () => { mainWindow?.show(); mainWindow?.focus(); send('evt:select', s.id) })
          n.show()
        }
      }
    }
  })
  registerIpc(manager)

  // Items replay the renderer's own ⌘ shortcut (registerAccelerator:false keeps the key from firing twice).
  const key = (label: string, k: string): Electron.MenuItemConstructorOptions => ({
    label, accelerator: `Cmd+${k.toUpperCase()}`, registerAccelerator: false,
    click: () => mainWindow?.webContents.sendInputEvent({ type: 'keyDown', keyCode: k, modifiers: ['meta'] })
  })
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    { label: 'File', submenu: [key('New Session', 'n'), key('Command Palette', 'k'), { type: 'separator' }, { role: 'close' }] },
    { role: 'editMenu' },
    { label: 'View', submenu: [key('Toggle Sidebar', 'b'), key('Next Session Needing You', 'j'), { type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { role: 'windowMenu' }
  ]))

  if (is.dev) app.dock?.setIcon(icon)
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

let ptys: PtyManager | undefined
app.on('before-quit', (e) => {
  if (!quitConfirmed && manager?.hasWorking()) {
    e.preventDefault()
    void dialog.showMessageBox({ type: 'warning', message: 'Quit AgentDeck?', detail: 'Agents stop when AgentDeck quits.', buttons: ['Quit', 'Cancel'], defaultId: 1, cancelId: 1 }).then((r) => {
      if (r.response === 0) { quitConfirmed = true; app.quit() }
    })
    return
  }
  codex.dispose()
  ptys?.dispose()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
