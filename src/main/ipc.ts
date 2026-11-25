import { dialog, ipcMain, type BrowserWindow } from 'electron'
import type { SessionManager } from './sessions'
import { getSettings, setSettings } from './settings'

const METHODS = [
  'addProject', 'listProjects', 'listSessions', 'listModels', 'providerModes', 'createSession', 'getEvents',
  'sendMessage', 'interrupt', 'respondToApproval', 'archiveSession', 'renameSession', 'getLimits',
  'sessionDiff', 'commitSession', 'searchSessions', 'listHistory', 'importHistory', 'listMcp', 'listFiles', 'listCheckpoints', 'rewindSession', 'pushSession', 'createPr',
  'listAccounts', 'addAccount', 'accountLogin', 'moveSession', 'sessionUsage',
  'termOpen', 'termWrite', 'termResize',
] as const

export function registerIpc(m: SessionManager): void {
  for (const name of METHODS) {
    ipcMain.handle(`api:${name}`, (_e, ...args: unknown[]) => (m[name] as (...a: unknown[]) => unknown)(...args))
  }
  ipcMain.handle('api:getSettings', () => getSettings())
  ipcMain.handle('api:setSettings', (_e, patch) => setSettings(patch))
}

export async function pickFolder(win: BrowserWindow | null): Promise<string | null> {
  const opts = { properties: ['openDirectory' as const] }
  const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  return r.canceled ? null : (r.filePaths[0] ?? null)
}
