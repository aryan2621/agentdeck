import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

const execFileP = promisify(execFile)

export interface AgentdeckAction { name: string; command: string }
export interface AgentdeckConfig {
  copy?: string[]
  setup?: string
  archive?: string
  actions?: AgentdeckAction[]
}
interface ChangedFile {
  path: string
  status: string
  additions: number
  deletions: number
}
export interface DiffResult {
  diff: string
  files: ChangedFile[]
}
export interface SetupResult {
  output: string
  exitCode: number
  /** Files/folders copied from agentdeck.json `copy`. */
  copied?: number
}

async function run(cwd: string, cmd: string, args: string[], env?: NodeJS.ProcessEnv): Promise<string> {
  try {
    const { stdout } = await execFileP(cmd, args, { cwd, maxBuffer: 64 * 1024 * 1024, env: env ? { ...process.env, ...env } : undefined })
    return stdout
  } catch (e) {
    const err = e as { stderr?: string; message: string; code?: string }
    if (err.code === 'ENOENT') throw new Error(cmd === 'gh' ? 'GitHub CLI (gh) not found. Install it from cli.github.com, then try again.' : `${cmd} not found. Install it and make sure it is on your PATH.`)
    throw new Error(`${cmd} ${args.join(' ')} failed: ${(err.stderr || err.message).trim()}`)
  }
}
const git = (cwd: string, ...args: string[]): Promise<string> => run(cwd, 'git', args)
const gitEnv = (cwd: string, env: NodeJS.ProcessEnv, ...args: string[]): Promise<string> => run(cwd, 'git', args, env)

function safeRef(ref: string, what: string): string {
  if (!ref || ref.startsWith('-')) throw new Error(`Invalid ${what}: "${ref}"`)
  return ref
}

async function requireCommits(path: string): Promise<void> {
  try {
    await git(path, 'rev-parse', '--verify', 'HEAD')
  } catch {
    throw new Error('Repository has no commits yet; make an initial commit first')
  }
}

/** Tracked and untracked (non-ignored) files, relative to cwd, for @mentions. */
export async function listFiles(cwd: string): Promise<string[]> {
  return (await git(cwd, 'ls-files', '-z', '--cached', '--others', '--exclude-standard')).split('\0').filter(Boolean)
}

/** Files under the worktree's `.context` folder (agent notes and artifacts), relative to it. */
export async function listArtifacts(cwd: string): Promise<string[]> {
  const entries = await readdir(join(cwd, '.context'), { recursive: true, withFileTypes: true }).catch(() => [])
  return entries.filter((e) => e.isFile()).map((e) => relative(join(cwd, '.context'), join(e.parentPath, e.name))).sort()
}

export async function isGitRepo(path: string): Promise<boolean> {
  try {
    return (await git(path, 'rev-parse', '--is-inside-work-tree')).trim() === 'true'
  } catch {
    return false
  }
}

/** Turns a plain folder into a repo with one commit; optionally creates the GitHub repo (via the logged-in gh) and pushes. */
export async function initRepo(path: string, github?: 'private' | 'public'): Promise<void> {
  await git(path, 'init')
  await git(path, 'add', '-A')
  await git(path, 'commit', '--allow-empty', '-m', 'Initial commit')
  if (github) await publishRepo(path, github)
}

const SLUG = /^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9._-]+$/
/** `slug` is owner/name; default is the folder name under the logged-in account. */
export const publishRepo = (path: string, visibility: 'private' | 'public', slug?: string): Promise<unknown> => {
  if (slug && !SLUG.test(slug)) throw new Error(`Invalid repository name: "${slug}"`)
  return run(path, 'gh', ['repo', 'create', slug ?? basename(path), `--${visibility}`, '--source', '.', '--push'])
}
/** The logged-in GitHub user plus their organisations, for the Owner picker. */
export async function githubOwners(): Promise<string[]> {
  const me = (await run('.', 'gh', ['api', 'user', '--jq', '.login'])).trim()
  const orgs = (await run('.', 'gh', ['api', 'user/orgs', '--jq', '.[].login']).catch(() => '')).split('\n').map((o) => o.trim()).filter(Boolean)
  return [me, ...orgs]
}
/** True when owner/name does not exist yet (gh repo view fails). */
export const repoAvailable = (slug: string): Promise<boolean> => SLUG.test(slug) ? run('.', 'gh', ['repo', 'view', slug]).then(() => false, () => true) : Promise.resolve(false)
/** A PR number becomes its head (fetched from origin); anything else is taken as a branch/ref name. */
export async function resolveBase(repo: string, ref: string): Promise<string> {
  const t = ref.trim().replace(/^#/, '')
  if (!/^\d+$/.test(t)) return safeRef(ref.trim(), 'branch name')
  await git(repo, 'fetch', 'origin', `pull/${t}/head`)
  return 'FETCH_HEAD'
}

/** Clones `repo` (URL or owner/name, via the logged-in gh) into `parent/<name>` and returns that path. */
export async function cloneRepo(repo: string, parent: string): Promise<string> {
  const name = basename(repo.trim().replace(/\.git$/, '').replace(/\/+$/, ''))
  if (!name || name.startsWith('-') || repo.trim().startsWith('-')) throw new Error(`Not a repository: "${repo}"`)
  await run(parent, 'gh', ['repo', 'clone', repo.trim(), name])
  return join(parent, name)
}

export async function currentBranch(path: string): Promise<string> {
  // symbolic-ref also resolves the branch name before its first commit.
  return (await git(path, 'symbolic-ref', '--quiet', '--short', 'HEAD').catch(() => git(path, 'rev-parse', '--abbrev-ref', 'HEAD'))).trim()
}

export async function addWorktree(
  repo: string,
  branch: string,
  baseDir: string,
  base?: string
): Promise<{ path: string; branch: string }> {
  safeRef(branch, 'branch name')
  await requireCommits(repo)
  const path = join(baseDir, branch.replace(/[/\\]/g, '-'))
  await mkdir(baseDir, { recursive: true })
  await git(repo, 'worktree', 'add', '-b', branch, path, ...(base ? [safeRef(base, 'base branch')] : []))
  return { path, branch }
}

export async function removeWorktree(
  repo: string,
  path: string,
  deleteBranch?: string
): Promise<void> {
  await git(repo, 'worktree', 'remove', '--force', path)
  if (deleteBranch) await git(repo, 'branch', '-D', safeRef(deleteBranch, 'branch name'))
}

export async function readAgentdeckConfig(repo: string): Promise<AgentdeckConfig> {
  let raw: string
  try {
    raw = await readFile(join(repo, 'agentdeck.json'), 'utf8')
  } catch {
    return {}
  }
  let cfg: unknown
  try {
    cfg = JSON.parse(raw)
  } catch (e) {
    throw new Error(`agentdeck.json is not valid JSON: ${(e as Error).message}`)
  }
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg))
    throw new Error('agentdeck.json must be an object')
  const { copy, setup, archive, actions } = cfg as Record<string, unknown>
  if (copy !== undefined && !(Array.isArray(copy) && copy.every((c) => typeof c === 'string')))
    throw new Error('agentdeck.json: "copy" must be an array of strings')
  if (setup !== undefined && typeof setup !== 'string')
    throw new Error('agentdeck.json: "setup" must be a string')
  if (archive !== undefined && typeof archive !== 'string')
    throw new Error('agentdeck.json: "archive" must be a string')
  if (actions !== undefined && !(Array.isArray(actions) && actions.every((a) => a && typeof a.name === 'string' && typeof a.command === 'string')))
    throw new Error('agentdeck.json: "actions" must be an array of { name, command }')
  return { copy: copy as string[] | undefined, setup: setup as string | undefined, archive: archive as string | undefined, actions: actions as AgentdeckAction[] | undefined }
}

/** Mirror of readAgentdeckConfig: empty config removes the file. */
export async function writeAgentdeckConfig(repo: string, cfg: AgentdeckConfig): Promise<void> {
  const copy = (cfg.copy ?? []).map((c) => c.trim()).filter(Boolean)
  copy.forEach((c) => inside(repo, c))
  const setup = cfg.setup?.trim()
  const archive = cfg.archive?.trim()
  const file = join(repo, 'agentdeck.json')
  const actions = (cfg.actions ?? []).map((a) => ({ name: a.name.trim(), command: a.command.trim() })).filter((a) => a.name && a.command)
  if (!copy.length && !setup && !archive && !actions.length) return rm(file, { force: true })
  await writeFile(file, JSON.stringify({ ...(copy.length && { copy }), ...(setup && { setup }), ...(archive && { archive }), ...(actions.length && { actions }) }, null, 2) + '\n')
}

/** Resolve `rel` under `root`, rejecting absolute paths and `..` escapes. */
function inside(root: string, rel: string): string {
  const full = resolve(root, rel)
  const r = relative(resolve(root), full)
  if (isAbsolute(rel) || r === '' || r === '..' || r.startsWith('..' + sep) || isAbsolute(r))
    throw new Error(`Path escapes the repo root: "${rel}"`)
  return full
}

export async function setupWorktree(
  repo: string,
  worktreePath: string,
  cfg: AgentdeckConfig,
  env: Record<string, string> = {}
): Promise<SetupResult> {
  // Validate every path before touching anything.
  const pairs = (cfg.copy ?? []).map((rel) => [inside(repo, rel), inside(worktreePath, rel)])
  let copied = 0
  for (const [src, dst] of pairs) {
    // Missing sources (e.g. optional .env) are skipped.
    if (!(await stat(src).catch(() => null))) continue
    await mkdir(dirname(dst), { recursive: true })
    await cp(src, dst, { recursive: true })
    copied++
  }
  return { ...(cfg.setup ? await runScript(cfg.setup, worktreePath, env) : { output: '', exitCode: 0 }), copied }
}

/** Runs a shell command in `cwd`; never throws, reports the exit code. */
export async function runScript(command: string, cwd: string, env: Record<string, string> = {}): Promise<SetupResult> {
  const win = process.platform === 'win32'
  try {
    const { stdout, stderr } = await execFileP(win ? (process.env.ComSpec || 'cmd.exe') : process.env.SHELL || '/bin/sh', [win ? '/c' : '-c', command], {
      cwd,
      env: { ...process.env, ...env },
      maxBuffer: 64 * 1024 * 1024
    })
    return { output: stdout + stderr, exitCode: 0 }
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; code?: number | string; message: string }
    return {
      output: (err.stdout ?? '') + (err.stderr ?? '') || err.message,
      exitCode: typeof err.code === 'number' ? err.code : 1
    }
  }
}

// `git add -N` takes index.lock, so concurrent diffs (panel + sidebar stats) must run one at a time.
// shortcut: one global queue, not per repo; fine for a handful of sessions.
let diffQueue: Promise<unknown> = Promise.resolve()
export function diff(path: string, scope: 'uncommitted' | { base: string }): Promise<DiffResult> {
  const next = diffQueue.then(() => diffNow(path, scope))
  diffQueue = next.catch(() => {})
  return next
}

async function diffNow(path: string, scope: 'uncommitted' | { base: string }): Promise<DiffResult> {
  const hasHead = await git(path, 'rev-parse', '--verify', '--quiet', 'HEAD').then(() => true, () => false)
  if (!hasHead) {
    // An unborn branch has no committed branch changes. Show its working files as
    // additions against an empty tree, using an isolated index to preserve staging.
    if (scope !== 'uncommitted') return { diff: '', files: [] }
    return withTempIndex(async (env) => {
      await gitEnv(path, env, 'read-tree', '--empty')
      const emptyTree = (await gitEnv(path, env, 'write-tree')).trim()
      await gitEnv(path, env, 'add', '-N', '.')
      return readDiff(path, [emptyTree], env)
    })
  }
  if (scope === 'uncommitted') await git(path, 'add', '-N', '.')
  return readDiff(path, scope === 'uncommitted' ? ['HEAD'] : [`${safeRef(scope.base, 'base ref')}...HEAD`])
}

async function readDiff(path: string, range: string[], env?: NodeJS.ProcessEnv): Promise<DiffResult> {
  const d = (...flags: string[]): Promise<string> =>
    gitEnv(path, env ?? {}, 'diff', '--no-renames', ...flags, ...range, '--')
  const [text, numstat, names] = await Promise.all([d(), d('--numstat'), d('--name-status')])
  const status = new Map<string, string>()
  for (const l of names.split('\n').filter(Boolean)) {
    const [s, ...p] = l.split('\t')
    status.set(p.join('\t'), s)
  }
  const files = numstat
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [a, del, ...p] = l.split('\t')
      const file = p.join('\t')
      // Binary files report "-" counts.
      return {
        path: file,
        status: status.get(file) ?? 'M',
        additions: a === '-' ? 0 : Number(a),
        deletions: del === '-' ? 0 : Number(del)
      }
    })
  return { diff: text, files }
}

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

/** Discards one file's uncommitted changes: restores it from HEAD, or deletes it if HEAD doesn't have it. `full` must already be inside the repo. */
export async function revertFile(cwd: string, rel: string, full: string): Promise<void> {
  const inHead = await git(cwd, 'cat-file', '-e', `HEAD:${rel}`).then(() => true, () => false)
  if (inHead) await git(cwd, 'checkout', 'HEAD', '--', rel)
  else { await git(cwd, 'rm', '-r', '-f', '--cached', '--ignore-unmatch', '--', rel); await rm(full, { recursive: true, force: true }) }
}

/** Discards one hunk (0-based, as shown in the uncommitted diff) of a file by reverse-applying it. The patch is rebuilt here from git, never taken from the renderer. */
export async function revertHunk(cwd: string, rel: string, index: number): Promise<void> {
  const file = (await diff(cwd, 'uncommitted')).diff.split(/^(?=diff --git )/m).find((c) => c.startsWith(`diff --git a/${rel} b/${rel}\n`))
  const [head, ...hunks] = (file ?? '').split(/^(?=@@ )/m)
  if (!hunks[index]) throw new Error('That change no longer exists; refresh the diff')
  const dir = await mkdtemp(join(tmpdir(), 'agentdeck-hunk-'))
  try {
    const patch = join(dir, 'p.diff')
    await writeFile(patch, head + hunks[index])
    await git(cwd, 'apply', '-R', '--recount', patch)
  } finally { await rm(dir, { recursive: true, force: true }) }
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

export interface PrCheck { name: string; state: 'pass' | 'fail' | 'pending' }
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

// ---- checkpoints: hidden refs/agentdeck/<session>/<time> commits of the whole worktree, taken before each prompt ----
export interface Checkpoint { id: string; label: string; createdAt: number }

const AUTHOR = { GIT_AUTHOR_NAME: 'AgentDeck', GIT_AUTHOR_EMAIL: 'agentdeck@localhost', GIT_COMMITTER_NAME: 'AgentDeck', GIT_COMMITTER_EMAIL: 'agentdeck@localhost' }
const ckPrefix = (sessionId: string): string => `refs/agentdeck/${sessionId}/`

/** Runs `fn` with a throwaway index so the user's real index and branch are never touched. */
async function withTempIndex<T>(fn: (env: NodeJS.ProcessEnv) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'agentdeck-idx-'))
  try { return await fn({ GIT_INDEX_FILE: join(dir, 'index'), ...AUTHOR }) } finally { await rm(dir, { recursive: true, force: true }) }
}

const MAX_CHECKPOINTS = 50

/** Snapshots tracked + untracked (non-ignored) files. `label` is the prompt that follows. */
export async function createCheckpoint(cwd: string, sessionId: string, label: string): Promise<void> {
  await withTempIndex(async (env) => {
    await gitEnv(cwd, env, 'add', '-A')
    const tree = (await gitEnv(cwd, env, 'write-tree')).trim()
    const commit = (await gitEnv(cwd, env, 'commit-tree', tree, '-m', label.split('\n')[0].slice(0, 200) || 'checkpoint')).trim()
    await git(cwd, 'update-ref', `${ckPrefix(sessionId)}${String(Date.now()).padStart(15, '0')}`, commit)
  })
  // Keep the newest MAX_CHECKPOINTS per session; older snapshots become unreachable and git gc reclaims them.
  const refs = (await git(cwd, 'for-each-ref', '--sort=refname', '--format=%(refname)', ckPrefix(sessionId))).split('\n').filter(Boolean)
  for (const r of refs.slice(0, -MAX_CHECKPOINTS)) await git(cwd, 'update-ref', '-d', r)
}

export async function listCheckpoints(cwd: string, sessionId: string): Promise<Checkpoint[]> {
  const prefix = ckPrefix(sessionId)
  const out = await git(cwd, 'for-each-ref', '--sort=refname', '--format=%(refname)%09%(committerdate:unix)%09%(contents:subject)', prefix)
  return out.split('\n').filter(Boolean).map((l) => {
    const [ref, ts, ...label] = l.split('\t')
    return { id: ref.slice(prefix.length), label: label.join('\t'), createdAt: Number(ts) * 1000 }
  })
}

const lines = (s: string): string[] => s.split('\0').filter(Boolean)

/** Files a rewind to checkpoint `id` would change (modified, deleted or removed), compared with the current worktree. */
export async function rewindPreview(cwd: string, sessionId: string, id: string): Promise<string[]> {
  if (!/^\d+$/.test(id)) throw new Error(`Invalid checkpoint: "${id}"`)
  const ref = `${ckPrefix(sessionId)}${id}`
  return withTempIndex(async (env) => {
    await gitEnv(cwd, env, 'add', '-A')
    const tree = (await gitEnv(cwd, env, 'write-tree')).trim()
    return lines(await git(cwd, 'diff-tree', '-r', '-z', '--name-only', ref, tree))
  })
}

/** Restores the worktree files to a checkpoint (files only: branch, index and chat are untouched). Snapshots the current state first so a rewind can be undone. */
export async function restoreCheckpoint(cwd: string, sessionId: string, id: string): Promise<void> {
  if (!/^\d+$/.test(id)) throw new Error(`Invalid checkpoint: "${id}"`)
  const ref = `${ckPrefix(sessionId)}${id}`
  await git(cwd, 'rev-parse', '--verify', ref)
  await createCheckpoint(cwd, sessionId, 'Before rewind')
  const keep = new Set(lines(await git(cwd, 'ls-tree', '-r', '-z', '--name-only', ref)))
  const current = lines(await git(cwd, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'))
  await Promise.all(current.filter((f) => !keep.has(f)).map((f) => rm(join(cwd, f), { force: true })))
  await withTempIndex(async (env) => {
    await gitEnv(cwd, env, 'read-tree', ref)
    await gitEnv(cwd, env, 'checkout-index', '-a', '-f')
  })
}
