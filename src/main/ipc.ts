import { dialog, ipcMain, nativeTheme, shell, type BrowserWindow } from 'electron'
import type { SessionManager } from './sessions'
import { getSettings, setSettings } from './settings'

const METHODS = [
  'addProject', 'listProjects', 'listSessions', 'listModels', 'providerModes', 'createSession', 'getEvents',
  'sendMessage', 'interrupt', 'respondToApproval', 'archiveSession', 'renameSession', 'getLimits',
  'sessionDiff', 'commitSession', 'searchSessions', 'listHistory', 'importHistory', 'listMcp', 'listFiles', 'listCheckpoints', 'rewindSession', 'rewindPreview', 'checkTool', 'pushSession', 'createPr',
  'listAccounts', 'addAccount', 'accountLogin', 'moveSession', 'sessionUsage', 'removeAccount', 'configureSession', 'branchStatus', 'revertFile',
  'termOpen', 'termWrite', 'termResize',
] as const

/** Follows the saved theme; CSS prefers-color-scheme then tracks it. */
export const applyTheme = (): void => { nativeTheme.themeSource = getSettings().theme }

export function registerIpc(m: SessionManager): void {
  for (const name of METHODS) {
    ipcMain.handle(`api:${name}`, (_e, ...args: unknown[]) => (m[name] as (...a: unknown[]) => unknown)(...args))
  }
  ipcMain.handle('api:getSettings', () => getSettings())
  ipcMain.handle('api:setSettings', (_e, patch) => {
    const s = setSettings(patch)
    applyTheme()
    return s
  })
  ipcMain.handle('api:openFile', async (_e, id: string, relPath: string) => {
    const err = await shell.openPath(m.resolveFile(id, relPath))
    if (err) throw new Error(err)
  })
}

export async function pickFolder(win: BrowserWindow | null): Promise<string | null> {
  const opts = { properties: ['openDirectory' as const] }
  const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  return r.canceled ? null : (r.filePaths[0] ?? null)
}
