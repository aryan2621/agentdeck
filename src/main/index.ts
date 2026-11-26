import { autoUpdater } from 'electron-updater'
import { app, dialog, Menu, shell, BrowserWindow, Notification } from 'electron'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { openDb } from './db'
import { getSettings, loadSettings, setSettings, setSoundsDir } from './settings'
import { playSound, syncCaffeinate, syncTray } from './system'
import { loadApiKeys } from './apiKeys'
import { applyTheme, registerIpc, pickFolder } from './ipc'
import { SessionManager } from './sessions'
import { PtyManager } from './pty'
import { createClaudeProvider } from './providers/claude'
import { CodexAdapter } from './providers/codex'
import icon from '../../resources/icon.png?asset'

// Apps opened from Finder get a minimal PATH, so codex/gh/git installed via nvm or Homebrew aren't found. Take the login shell's PATH.
function adoptLoginShellPath(): void {
  if (process.platform === 'win32' || !app.isPackaged) return
  try {
    const out = execFileSync(process.env.SHELL || '/bin/zsh', ['-ilc', 'echo "__PATH__$PATH"'], { encoding: 'utf8', timeout: 3000 })
    const p = out.split('\n').find((l) => l.includes('__PATH__'))?.split('__PATH__')[1]
    if (p) process.env.PATH = p
  } catch { /* shortcut: keep the inherited PATH if the shell is slow or fails; use Settings > CLI paths */ }
}

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
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const win = mainWindow
  win.on('ready-to-show', () => win.show())
  win.on('closed', () => (mainWindow = null))

  win.webContents.setWindowOpenHandler((details) => {
    if (/^https?:\/\//i.test(details.url)) shell.openExternal(details.url)
    return { action: 'deny' }
  })
  // The app never navigates; block it so a compromised page can't swap the UI.
  win.webContents.on('will-navigate', (e) => e.preventDefault())

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
  autoUpdater.on('update-downloaded', () => { if (getSettings().restartOnUpdate) autoUpdater.quitAndInstall() })
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  adoptLoginShellPath()
  loadSettings(join(app.getPath('userData'), 'settings.json'))
  loadApiKeys(join(app.getPath('userData'), 'apikeys.json'))
  setSoundsDir(join(app.getPath('userData'), 'sounds'))
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
    saveText: async (name, text) => {
      const opts = { defaultPath: name, filters: [{ name: 'Markdown', extensions: ['md'] }] }
      const r = mainWindow ? await dialog.showSaveDialog(mainWindow, opts) : await dialog.showSaveDialog(opts)
      if (r.canceled || !r.filePath) return null
      await writeFile(r.filePath, text)
      return r.filePath
    },
    confirmSetup: async (path, script) => {
      const hash = createHash('sha256').update(script).digest('hex')
      const trusted = getSettings().trustedSetups
      if (trusted[path] === hash) return true
      const opts = { type: 'warning' as const, message: "Run this project's setup script?", detail: script, buttons: ['Run', 'Cancel'], defaultId: 1, cancelId: 1 }
      const r = mainWindow ? await dialog.showMessageBox(mainWindow, opts) : await dialog.showMessageBox(opts)
      if (r.response !== 0) return false
      setSettings({ trustedSetups: { [path]: hash } }) // merge() keeps the other entries
      return true
    },
    pty,
    emit: {
      progress: (step) => send('evt:project-progress', step),
      event: (id, e) => send('evt:event', id, e),
      session: (s) => {
        send('evt:session', s)
        if (s.status === 'needs-you') needsYou.add(s.id)
        else needsYou.delete(s.id)
        app.dock?.setBadge(needsYou.size ? String(needsYou.size) : '')
        syncCaffeinate(manager?.hasWorking() ?? false)
        void syncDeck()
        if (s.status === 'done' && getSettings().notifyAgents) playSound()
        if (['done', 'needs-you', 'error'].includes(s.status) && getSettings().notifyAgents && getSettings().notify[s.status as 'done'] && !mainWindow?.isFocused()) {
          const n = new Notification({ title: { done: 'Session done', 'needs-you': 'Session needs you', error: 'Session failed' }[s.status as 'done'], body: s.title })
          n.on('click', () => { mainWindow?.show(); mainWindow?.focus(); send('evt:select', s.id) })
          n.show()
        }
      }
    }
  })
  const syncDeck = async (): Promise<void> => syncTray(async () => {
    const sessions = (await Promise.all((await manager!.listProjects()).map((p) => manager!.listSessions(p.id)))).flat().sort((a, b) => b.createdAt - a.createdAt).slice(0, 8)
    const cost = (await manager!.usageSummary()).reduce((n, u) => n + u.costUsd, 0)
    return { sessions, usage: `Spent $${cost.toFixed(2)} across all sessions` }
  }, (id) => { mainWindow?.show(); mainWindow?.focus(); send('evt:select', id) })
  registerIpc(manager, () => { syncCaffeinate(manager?.hasWorking() ?? false); void syncDeck() })
  void syncDeck()

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
