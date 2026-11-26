import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { DEFAULT_SETTINGS, PROVIDERS, type ProviderId, type Settings } from '../shared/types'

let file = ''
let current: Settings = DEFAULT_SETTINGS

const merge = (base: Settings, p: Partial<Settings>): Settings => ({
  ...base, ...p,
  notify: { ...base.notify, ...p.notify },
  cliPaths: { ...base.cliPaths, ...p.cliPaths },
  defaultModels: { ...base.defaultModels, ...p.defaultModels },
  trustedSetups: { ...base.trustedSetups, ...p.trustedSetups },
})

export function loadSettings(path: string): void {
  file = path
  try { current = merge(DEFAULT_SETTINGS, JSON.parse(readFileSync(path, 'utf8'))) } catch { current = DEFAULT_SETTINGS } // missing or corrupt: defaults
}
export const getSettings = (): Settings => current
export function setSettings(patch: Partial<Settings>): Settings {
  current = merge(current, patch)
  if (file) {
    try { // atomic: a failed write must not truncate the existing file
      writeFileSync(file + '.tmp', JSON.stringify(current, null, 2))
      renameSync(file + '.tmp', file)
    } catch (e) { console.error('settings not saved:', e) }
  }
  return current
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const strMap = (v: unknown, ok: (s: string) => boolean): Record<string, string> =>
  Object.fromEntries(Object.entries(isObj(v) ? v : {}).filter((e): e is [string, string] => typeof e[1] === 'string' && ok(e[1])))

/** Renderer-supplied patch -> only the keys the renderer may edit, type-checked. Drops trustedSetups. */
export function sanitizeSettings(patch: unknown): Partial<Settings> {
  const p = isObj(patch) ? patch : {}
  const out: Partial<Settings> = {}
  if (p.theme === 'system' || p.theme === 'light' || p.theme === 'dark') out.theme = p.theme
  if (PROVIDERS.some((x) => x.id === p.defaultProvider)) out.defaultProvider = p.defaultProvider as ProviderId
  if (Number.isInteger(p.maxParallel) && (p.maxParallel as number) >= 0 && (p.maxParallel as number) <= 32) out.maxParallel = p.maxParallel as number
  if (typeof p.defaultMode === 'string') out.defaultMode = p.defaultMode as Settings['defaultMode']
  if (isObj(p.notify)) out.notify = Object.fromEntries(Object.entries(p.notify).filter((e) => typeof e[1] === 'boolean')) as Settings['notify']
  if (isObj(p.cliPaths)) out.cliPaths = strMap(p.cliPaths, (s) => s === '' || isAbsolute(s))
  if (isObj(p.defaultModels)) out.defaultModels = strMap(p.defaultModels, () => true)
  return out
}
/** The user's configured binary for a provider, else its bare command name (resolved on PATH). */
export const cliPath = (id: ProviderId, fallback: string): string => current.cliPaths[id]?.trim() || fallback
