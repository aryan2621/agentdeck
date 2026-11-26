import { safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { ProviderId } from '../shared/types'

/** Provider -> env var the CLI reads. Only providers that accept an API key. */
const KEY_ENV: Partial<Record<ProviderId, string>> = { claude: 'ANTHROPIC_API_KEY', codex: 'OPENAI_API_KEY' }

let file = ''
let keys: Record<string, string> = {} // provider -> base64 of the encrypted key
export function loadApiKeys(path: string): void {
  file = path
  try { if (existsSync(path)) keys = JSON.parse(readFileSync(path, 'utf8')) } catch { keys = {} }
}
/** The saved key, decrypted; main-only, never sent to the renderer. */
const key = (p: ProviderId): string | undefined => {
  try { return keys[p] ? safeStorage.decryptString(Buffer.from(keys[p], 'base64')) : undefined } catch { return undefined }
}
export const hasApiKey = (p: ProviderId): boolean => !!key(p)
export function setApiKey(p: ProviderId, value: string): void {
  if (!KEY_ENV[p]) throw new Error(`${p} does not take an API key`)
  if (value.trim() && !safeStorage.isEncryptionAvailable()) throw new Error('Secure storage is unavailable, so the key was not saved')
  if (value.trim()) keys[p] = safeStorage.encryptString(value.trim()).toString('base64')
  else delete keys[p]
  writeFileSync(file, JSON.stringify(keys), { mode: 0o600 })
}
/** Env to add when spawning a provider CLI. */
export const apiKeyEnv = (p: ProviderId): Record<string, string> => {
  const k = key(p)
  return k && KEY_ENV[p] ? { [KEY_ENV[p]!]: k } : {}
}
