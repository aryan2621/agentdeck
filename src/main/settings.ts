import { readFileSync, writeFileSync } from 'node:fs'
import { DEFAULT_SETTINGS, type ProviderId, type Settings } from '../shared/types'

let file = ''
let current: Settings = DEFAULT_SETTINGS

const merge = (base: Settings, p: Partial<Settings>): Settings => ({
  ...base, ...p,
  notify: { ...base.notify, ...p.notify },
  cliPaths: { ...base.cliPaths, ...p.cliPaths },
  defaultModels: { ...base.defaultModels, ...p.defaultModels },
})

export function loadSettings(path: string): void {
  file = path
  try { current = merge(DEFAULT_SETTINGS, JSON.parse(readFileSync(path, 'utf8'))) } catch { current = DEFAULT_SETTINGS } // missing or corrupt: defaults
}
export const getSettings = (): Settings => current
export function setSettings(patch: Partial<Settings>): Settings {
  current = merge(current, patch)
  if (file) writeFileSync(file, JSON.stringify(current, null, 2))
  return current
}
/** The user's configured binary for a provider, else its bare command name (resolved on PATH). */
export const cliPath = (id: ProviderId, fallback: string): string => current.cliPaths[id]?.trim() || fallback
