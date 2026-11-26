import { git, run, safeRef } from './exec'

export async function commitAll(path: string, message: string): Promise<void> {
  await git(path, 'add', '-A')
  await git(path, 'commit', '-m', message)
}

export async function push(path: string, remote = 'origin', upstream = true): Promise<string> {
  return git(path, 'push', ...(upstream ? ['-u'] : []), safeRef(remote, 'remote'), 'HEAD')
}

/** Local and remote-tracking branch names plus remote names, for the repo Git settings. */
export async function listRefs(path: string): Promise<{ branches: string[]; remotes: string[] }> {
  const lines = async (...a: string[]): Promise<string[]> => (await git(path, ...a)).split('\n').map((l) => l.trim()).filter(Boolean)
  const branches = await lines('for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes')
  return { branches: branches.filter((b) => !b.endsWith('/HEAD')), remotes: await lines('remote') }
}

/** dirty = uncommitted files; ahead = commits not on the upstream (null = no upstream, never pushed). */
export async function branchStatus(path: string): Promise<{ dirty: boolean; ahead: number | null }> {
  const dirty = (await git(path, 'status', '--porcelain')).trim() !== ''
  const ahead = await git(path, 'rev-list', '--count', '@{u}..HEAD').then((n) => Number(n.trim()), () => null)
  return { dirty, ahead }
}

/** The browsable https URL for a git remote (ssh or https), or null when it is not a web remote. */
export function remoteWebUrl(remote: string): string | null {
  const m = remote.trim().match(/^(?:git@|ssh:\/\/git@|https?:\/\/)([^:/]+)[:/](.+?)(?:\.git)?\/?$/)
  return m ? `https://${m[1]}/${m[2]}` : null
}

export async function remoteUrl(path: string): Promise<string | null> {
  return remoteWebUrl(await git(path, 'remote', 'get-url', 'origin').catch(() => ''))
}

export async function createPr(path: string, title: string, body: string): Promise<string> {
  return (await run(path, 'gh', ['pr', 'create', '--title', title, '--body', body])).trim()
}

/** Branch-name-safe slug of a prompt: lowercase words joined by '-', at most 40 chars; '' when nothing usable. */
export function branchSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/^-+|-+$/g, '')
}

/** Renames the checked-out branch. */
export async function renameBranch(cwd: string, name: string): Promise<void> {
  await git(cwd, 'check-ref-format', '--branch', safeRef(name, 'branch name'))
  await git(cwd, 'branch', '-m', name)
}

/** Squash-merges the branch's PR, or enables automerge (merges once checks pass) when `auto`. */
export async function mergePr(path: string, auto: boolean): Promise<string> {
  return (await run(path, 'gh', ['pr', 'merge', '--squash', ...(auto ? ['--auto'] : [])])).trim()
}

interface PrCheck { name: string; state: 'pass' | 'fail' | 'pending' }

export interface PrStatus { number: number; url: string; state: string; checks: PrCheck[]; conflicts: boolean }

/** Maps gh's statusCheckRollup entries (CheckRun or StatusContext) to pass/fail/pending. */
export function parsePrStatus(json: string): PrStatus {
  const j = JSON.parse(json)
  const checks: PrCheck[] = (j.statusCheckRollup ?? []).map((c: { name?: string; context?: string; status?: string; conclusion?: string; state?: string }) => {
    const v = (c.conclusion || c.state || c.status || '').toUpperCase()
    return { name: c.name || c.context || 'check', state: ['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(v) ? 'pass' : ['FAILURE', 'ERROR', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED'].includes(v) ? 'fail' : 'pending' }
  })
  return { number: j.number, url: j.url, state: j.state, checks, conflicts: j.mergeable === 'CONFLICTING' }
}

/** The PR for the current branch, or null when there is none (or gh is unavailable / not logged in). */
export async function prStatus(path: string): Promise<PrStatus | null> {
  try { return parsePrStatus(await run(path, 'gh', ['pr', 'view', '--json', 'number,url,state,statusCheckRollup,mergeable'])) } catch { return null }
}
