import { execFile } from 'child_process'
import { accessSync, constants, readFileSync } from 'fs'
import { homedir } from 'os'
import { delimiter, join } from 'path'
import type { ProviderId } from '../shared/types'
import { cliPath, getSettings } from './settings'

const executable = (p: string): boolean => { try { accessSync(p, constants.X_OK); return true } catch { return false } }

/** Whether `cmd` (a path or a bare name looked up on PATH) is runnable. */
const hasCommand = (cmd: string): boolean =>
  cmd.includes('/') ? executable(cmd) : (process.env.PATH ?? '').split(delimiter).some((d) => d && executable(join(d, cmd)))

/** The tool a session of this provider (or 'gh') would spawn. Claude uses the bundled SDK binary unless a path is set. */
export function checkTool(id: ProviderId | 'gh'): boolean {
  if (id === 'gh') return hasCommand('gh')
  if (id === 'claude') return hasCommand(cliPath('claude', '')) || !cliPath('claude', '')
  return hasCommand(cliPath(id, 'codex'))
}

const out = (cmd: string, args: string[]): Promise<string> =>
  new Promise((res) => execFile(cmd, args, { timeout: 8000 }, (_e, stdout, stderr) => res(String(stdout || stderr || '').trim())))
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/** Email and plan from the ChatGPT id_token in Codex's auth.json (decoded only, never verified or sent anywhere). */
function codexClaims(): { email?: string; plan?: string } {
  try {
    const auth = JSON.parse(readFileSync(join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'auth.json'), 'utf8'))
    const c = JSON.parse(Buffer.from(String(auth.tokens?.id_token).split('.')[1], 'base64url').toString())
    return { email: c.email, plan: c['https://api.openai.com/auth']?.chatgpt_plan_type }
  } catch { return {} } // API-key login or not signed in: no claims
}

/** Version and login details of a provider CLI for the Agents page. Rows are omitted when the CLI doesn't report them. */
export async function agentInfo(id: ProviderId): Promise<{ label: string; value: string }[]> {
  const bin = cliPath(id, id)
  const version = (await out(bin, ['--version'])).replace(/\s*\(.*\)$/, '').replace(/^codex-cli\s*/, '')
  let rows: [string, string | undefined][]
  if (id === 'claude') {
    let a: { loggedIn?: boolean; authMethod?: string; apiProvider?: string; subscriptionType?: string; orgName?: string; email?: string } = {}
    try { a = JSON.parse(await out(bin, ['auth', 'status'])) } catch { /* not logged in or old CLI */ }
    rows = [
      ['Version', version],
      ['Provider', a.apiProvider === 'firstParty' ? 'Anthropic API' : a.apiProvider],
      ['Login method', a.authMethod === 'claude.ai' ? `Claude ${cap(a.subscriptionType ?? '')} account`.replace('  ', ' ') : a.authMethod],
      ['Organization', a.orgName],
      ['Email', a.email],
    ]
  } else {
    const c = codexClaims()
    rows = [['Version', version], ['Login method', (await out(bin, ['login', 'status'])).split('\n')[0]], ['Plan', c.plan && cap(c.plan)], ['Email', c.email]]
  }
  return rows.filter((r): r is [string, string] => !!r[1]).map(([label, value]) => ({ label, value }))
}

let ghLogin: string | null | undefined
/** GitHub login of the `gh` user, or null when gh is missing or logged out (cached until `fresh`). */
export async function githubLogin(fresh = false): Promise<string | null> {
  if (ghLogin !== undefined && !fresh) return ghLogin
  ghLogin = hasCommand('gh') ? (await out('gh', ['api', 'user', '-q', '.login'])).match(/^[A-Za-z0-9-]{1,39}$/)?.[0] ?? null : null
  return ghLogin
}

/** Profile shown on the Account page: git's configured identity plus the gh login. */
export async function gitIdentity(): Promise<{ name: string; email: string; login: string | null }> {
  const [name, email, login] = await Promise.all([out('git', ['config', '--global', 'user.name']), out('git', ['config', '--global', 'user.email']), githubLogin(true)])
  return { name, email, login }
}

/** Branch prefix for new worktrees per the Git page; the GitHub login falls back to the custom prefix. */
export async function branchPrefix(): Promise<string> {
  const s = getSettings()
  return s.branchPrefixMode === 'none' ? '' : s.branchPrefixMode === 'github' ? ((await githubLogin()) ?? s.branchPrefix) : s.branchPrefix
}
