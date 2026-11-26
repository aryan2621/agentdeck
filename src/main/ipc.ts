import { dialog, ipcMain, nativeTheme, shell, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import type { SessionManager } from './sessions'
import { getSettings, sanitizeSettings, setSettings } from './settings'

const METHODS = [
  'addProject', 'listProjects', 'listSessions', 'listModels', 'providerModes', 'createSession', 'getEvents',
  'sendMessage', 'interrupt', 'respondToApproval', 'archiveSession', 'renameSession', 'getLimits',
  'sessionDiff', 'commitSession', 'searchSessions', 'listHistory', 'importHistory', 'listMcp', 'listFiles', 'listCheckpoints', 'rewindSession', 'rewindPreview', 'checkTool', 'pushSession', 'createPr',
  'listAccounts', 'addAccount', 'accountLogin', 'moveSession', 'sessionUsage', 'usageSummary', 'removeAccount', 'configureSession', 'branchStatus', 'revertFile', 'revertHunk', 'exportSession',
  'termOpen', 'termWrite', 'termResize',
] as const

/** Follows the saved theme; CSS prefers-color-scheme then tracks it. */
export const applyTheme = (): void => { nativeTheme.themeSource = getSettings().theme }

/** Only our own renderer page may call the API (not a navigated or embedded frame). */
function assertFromApp(e: IpcMainInvokeEvent): void {
  const url = e.senderFrame?.url ?? ''
  const dev = process.env['ELECTRON_RENDERER_URL']
  if (!(url.startsWith('file://') || (dev && url.startsWith(dev)))) throw new Error('IPC call from untrusted frame')
}

export function registerIpc(m: SessionManager): void {
  for (const name of METHODS) {
    ipcMain.handle(`api:${name}`, (e, ...args: unknown[]) => {
      assertFromApp(e)
      return (m[name] as (...a: unknown[]) => unknown)(...args)
    })
  }
  ipcMain.handle('api:getSettings', (e) => { assertFromApp(e); return getSettings() })
  ipcMain.handle('api:setSettings', (e, patch) => {
    assertFromApp(e)
    const s = setSettings(sanitizeSettings(patch))
    applyTheme()
    return s
  })
  ipcMain.handle('api:openFile', async (e, id: string, relPath: string) => {
    assertFromApp(e)
    const err = await shell.openPath(m.resolveFile(id, relPath))
    if (err) throw new Error(err)
  })
}

export async function pickFolder(win: BrowserWindow | null): Promise<string | null> {
  const opts = { properties: ['openDirectory' as const] }
  const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  return r.canceled ? null : (r.filePaths[0] ?? null)
}
