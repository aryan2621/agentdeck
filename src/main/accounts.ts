import { cp, mkdir, readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { hasAccounts, type AccountProvider, type ProviderId } from '../shared/types'

const CLI: Record<AccountProvider, { dir: string; login: string; env: string }> = {
  claude: { dir: '.claude', login: 'claude /login', env: 'CLAUDE_CONFIG_DIR' },
  codex: { dir: '.codex', login: 'codex login', env: 'CODEX_HOME' },
}
/** Throws for providers without accounts (ACP agents) so they never inherit another CLI's behaviour. */
const cli = (p: ProviderId): (typeof CLI)[AccountProvider] => {
  if (!hasAccounts(p)) throw new Error(`${p} does not support accounts`)
  return CLI[p]
}

/** The CLI's own config dir when no account is chosen. */
export const defaultConfigDir = (p: ProviderId): string => join(homedir(), cli(p).dir)

/** CLI that logs in under CLAUDE_CONFIG_DIR / CODEX_HOME. */
export const loginCommand = (p: ProviderId): string => cli(p).login
export const configEnv = (p: ProviderId, dir: string): Record<string, string> => ({ [cli(p).env]: dir })

async function find(dir: string, suffix: string): Promise<string | null> {
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      const hit = await find(p, suffix)
      if (hit) return hit
    } else if (e.name.endsWith(suffix)) return p
  }
  return null
}

/**
 * Copies the provider's transcript for `token` (a file ending `<token>.jsonl`) from one config dir to another,
 * keeping its relative path, so the session can resume under another account. Returns false if none found.
 */
export async function copyTranscript(token: string, fromDir: string, toDir: string): Promise<boolean> {
  if (!/^[\w-]+$/.test(token)) throw new Error('invalid resume token')
  const src = await find(fromDir, `${token}.jsonl`)
  if (!src) return false
  const dst = join(toDir, src.slice(fromDir.length))
  await mkdir(dirname(dst), { recursive: true })
  await cp(src, dst)
  return true
}
