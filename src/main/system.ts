// macOS integrations behind the General and Experimental settings: sounds, disk access, caffeinate, menu bar tray.
import { app, BrowserWindow, dialog, Menu, powerSaveBlocker, shell, Tray, nativeImage } from 'electron'
import { execFile } from 'node:child_process'
import { accessSync, constants, copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { getSettings, soundsDir } from './settings'
import type { SessionInfo } from '../shared/ipc'

const SYSTEM_SOUNDS = '/System/Library/Sounds'
/** A system sound name or an added file's path -> a playable path; anything else is silent. */
const soundPath = (v: string): string => (/^[A-Za-z]{1,20}$/.test(v) ? join(SYSTEM_SOUNDS, `${v}.aiff`) : v)
export function playSound(v = getSettings().completionSound): void {
  if (v && process.platform === 'darwin') execFile('afplay', [soundPath(v)], () => {})
}
export function listSounds(): string[] {
  try { return readdirSync(soundsDir()).map((f) => join(soundsDir(), f)) } catch { return [] }
}
export async function addSound(win: BrowserWindow | null): Promise<string | null> {
  const opts = { properties: ['openFile' as const], filters: [{ name: 'Audio', extensions: ['aiff', 'aif', 'wav', 'mp3', 'm4a', 'caf'] }] }
  const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  if (r.canceled || !r.filePaths[0]) return null
  mkdirSync(soundsDir(), { recursive: true })
  const dest = join(soundsDir(), basename(r.filePaths[0]))
  copyFileSync(r.filePaths[0], dest)
  return dest
}

/** shortcut: probes a TCC-protected file; true on other platforms. Swap for a real API if Apple adds one. */
export function fullDiskAccess(): boolean {
  if (process.platform !== 'darwin') return true
  try { accessSync('/Library/Application Support/com.apple.TCC/TCC.db', constants.R_OK); return true } catch { return false }
}
export const openDiskAccessSettings = (): Promise<void> => shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles')

/** Keeps the Mac awake while any agent works; releases below 10% battery on battery power. */
let blocker: number | undefined
let timer: NodeJS.Timeout | undefined
const lowBattery = (): Promise<boolean> => new Promise((res) => {
  execFile('pmset', ['-g', 'batt'], (err, out) => {
    const pct = /(\d+)%/.exec(out)
    res(!err && /Battery Power/.test(out) && !!pct && Number(pct[1]) < 10)
  })
})
export function syncCaffeinate(working: boolean): void {
  const stop = (): void => { if (blocker !== undefined) powerSaveBlocker.stop(blocker); blocker = undefined; clearInterval(timer); timer = undefined }
  if (!working || !getSettings().caffeinate) return stop()
  if (blocker !== undefined) return
  void lowBattery().then((low) => {
    if (low || blocker !== undefined) return
    blocker = powerSaveBlocker.start('prevent-app-suspension')
    timer = setInterval(() => void lowBattery().then((l) => { if (l) stop() }), 60_000)
  })
}

/** Menu bar item: running count, recent sessions (click selects), usage line. */
let tray: Tray | undefined
export function syncTray(recent: () => Promise<{ sessions: SessionInfo[]; usage: string }>, open: (id: string) => void): void {
  if (!getSettings().menuBarTray) { tray?.destroy(); tray = undefined; return }
  tray ??= new Tray(nativeImage.createEmpty())
  void recent().then(({ sessions, usage }) => {
    if (!tray) return
    const working = sessions.filter((s) => s.status === 'working').length
    tray.setTitle(working ? `AgentDeck ${working}` : 'AgentDeck')
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: usage, enabled: false },
      { type: 'separator' },
      ...(sessions.length ? sessions.map((s) => ({ label: `${s.title}  (${s.status})`, click: () => open(s.id) })) : [{ label: 'No recent sessions', enabled: false }]),
      { type: 'separator' },
      { label: 'Quit AgentDeck', click: () => app.quit() },
    ]))
  })
}
