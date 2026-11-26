import { dialog, ipcMain, nativeTheme, shell, BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import type { SessionManager } from './sessions'
import { addSound, fullDiskAccess, listSounds, openDiskAccessSettings, playSound } from './system'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { gitIdentity } from './tools'
import { hasApiKey, setApiKey } from './apiKeys'
import type { ProviderId } from '../shared/types'
import { getSettings, sanitizeSettings, setSettings } from './settings'

const METHODS = [
  'addProject', 'initProject', 'createProject', 'githubOwners', 'githubRepoAvailable', 'cloneProject', 'pickDirectory', 'getWorktreesRoot', 'listRefs', 'removeProject', 'getProjectConfig', 'setProjectConfig', 'listProjects', 'listSessions', 'listModels', 'providerModes', 'createSession', 'getEvents',
  'sendMessage', 'interrupt', 'respondToApproval', 'archiveSession', 'listArchived', 'restoreSession', 'renameSession', 'getLimits',
  'sessionDiff', 'commitSession', 'searchSessions', 'listHistory', 'importHistory', 'listMcp', 'listFiles', 'listCheckpoints', 'rewindSession', 'rewindPreview', 'checkTool', 'agentInfo', 'pushSession', 'createPr', 'prStatus', 'mergePr', 'listArtifacts', 'setupOutput', 'projectRemoteUrl',
  'listAccounts', 'addAccount', 'accountLogin', 'moveSession', 'sessionUsage', 'usageSummary', 'removeAccount', 'configureSession', 'branchStatus', 'revertFile', 'revertHunk', 'exportSession',
  'termOpen', 'termWrite', 'termResize',
] as const

/** Follows the saved theme; CSS prefers-color-scheme then tracks it. */
export const applyTheme = (): void => {
  nativeTheme.themeSource = getSettings().theme
  for (const w of BrowserWindow.getAllWindows()) w.webContents.setZoomFactor(getSettings().zoom / 100)
}

/** Only our own renderer page may call the API (not a navigated or embedded frame). */
function assertFromApp(e: IpcMainInvokeEvent): void {
  const url = e.senderFrame?.url ?? ''
  const dev = process.env['ELECTRON_RENDERER_URL']
  if (!(url.startsWith('file://') || (dev && url.startsWith(dev)))) throw new Error('IPC call from untrusted frame')
}

export function registerIpc(m: SessionManager, onSettings: () => void = () => {}): void {
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
    onSettings()
    return s
  })
  const plain: Record<string, (...a: never[]) => unknown> = {
    playSound: (s?: string) => playSound(typeof s === 'string' ? s : undefined), listSounds, fullDiskAccess, openDiskAccessSettings,
    addSound: () => addSound(BrowserWindow.getFocusedWindow()),
  }
  for (const [name, fn] of Object.entries(plain)) ipcMain.handle(`api:${name}`, (e, ...a: unknown[]) => { assertFromApp(e); return (fn as (...x: unknown[]) => unknown)(...a) })
  ipcMain.handle('api:gitIdentity', (e) => { assertFromApp(e); return gitIdentity() })
  ipcMain.handle('api:apiKeyStatus', (e, p: ProviderId) => { assertFromApp(e); return hasApiKey(p) })
  ipcMain.handle('api:setApiKey', (e, p: ProviderId, key: string) => { assertFromApp(e); setApiKey(p, String(key)) })
  ipcMain.handle('api:openClaudeSettings', async (e, reveal: boolean) => {
    assertFromApp(e)
    const f = join(homedir(), '.claude', 'settings.json')
    if (reveal) shell.showItemInFolder(f)
    else { const err = await shell.openPath(f); if (err) throw new Error(err) }
  })
  ipcMain.handle('api:openFile', async (e, id: string, relPath: string, reveal?: boolean) => {
    assertFromApp(e)
    if (reveal) return shell.showItemInFolder(m.resolveFile(id, relPath))
    const err = await shell.openPath(m.resolveFile(id, relPath))
    if (err) throw new Error(err)
  })
}

export async function pickFolder(win: BrowserWindow | null): Promise<string | null> {
  const opts = { properties: ['openDirectory' as const] }
  const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  return r.canceled ? null : (r.filePaths[0] ?? null)
}
