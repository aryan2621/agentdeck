import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { cp, mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

const execFileP = promisify(execFile)

export interface AgentdeckConfig {
  copy?: string[]
  setup?: string
}
export interface ChangedFile {
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
}

async function run(cwd: string, cmd: string, args: string[], env?: NodeJS.ProcessEnv): Promise<string> {
  try {
    const { stdout } = await execFileP(cmd, args, { cwd, maxBuffer: 64 * 1024 * 1024, env: env ? { ...process.env, ...env } : undefined })
    return stdout
  } catch (e) {
    const err = e as { stderr?: string; message: string }
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

export async function isGitRepo(path: string): Promise<boolean> {
  try {
    return (await git(path, 'rev-parse', '--is-inside-work-tree')).trim() === 'true'
  } catch {
    return false
  }
}

export async function currentBranch(path: string): Promise<string> {
  await requireCommits(path)
  return (await git(path, 'rev-parse', '--abbrev-ref', 'HEAD')).trim()
}

export async function addWorktree(
  repo: string,
  branch: string,
  baseDir: string
): Promise<{ path: string; branch: string }> {
  safeRef(branch, 'branch name')
  await requireCommits(repo)
  const path = join(baseDir, branch.replace(/[/\\]/g, '-'))
  await mkdir(baseDir, { recursive: true })
  await git(repo, 'worktree', 'add', '-b', branch, path)
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
  const { copy, setup } = cfg as Record<string, unknown>
  if (copy !== undefined && !(Array.isArray(copy) && copy.every((c) => typeof c === 'string')))
    throw new Error('agentdeck.json: "copy" must be an array of strings')
  if (setup !== undefined && typeof setup !== 'string')
    throw new Error('agentdeck.json: "setup" must be a string')
  return { copy: copy as string[] | undefined, setup: setup as string | undefined }
}

/** Resolve `rel` under `root`, rejecting absolute paths and `..` escapes. */
function inside(root: string, rel: string): string {
  const full = resolve(root, rel)
  const r = relative(resolve(root), full)
  if (isAbsolute(rel) || r === '' || r.startsWith('..') || isAbsolute(r))
    throw new Error(`Path escapes the repo root: "${rel}"`)
  return full
}

export async function setupWorktree(
  repo: string,
  worktreePath: string,
  cfg: AgentdeckConfig
): Promise<SetupResult> {
  // Validate every path before touching anything.
  const pairs = (cfg.copy ?? []).map((rel) => [inside(repo, rel), inside(worktreePath, rel)])
  for (const [src, dst] of pairs) {
    // Missing sources (e.g. optional .env) are skipped.
    if (!(await stat(src).catch(() => null))) continue
    await mkdir(dirname(dst), { recursive: true })
    await cp(src, dst, { recursive: true })
  }
  if (!cfg.setup) return { output: '', exitCode: 0 }
  const win = process.platform === 'win32'
  try {
    const { stdout, stderr } = await execFileP(win ? (process.env.ComSpec || 'cmd.exe') : process.env.SHELL || '/bin/sh', [win ? '/c' : '-c', cfg.setup], {
      cwd: worktreePath,
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

export async function diff(path: string, scope: 'uncommitted' | { base: string }): Promise<DiffResult> {
  await requireCommits(path)
  if (scope === 'uncommitted') await git(path, 'add', '-N', '.') // intent-to-add so untracked files show; index-only, commitAll stages everything anyway
  const range =
    scope === 'uncommitted' ? ['HEAD'] : [`${safeRef(scope.base, 'base ref')}...HEAD`]
  const d = (...flags: string[]): Promise<string> =>
    git(path, 'diff', '--no-renames', ...flags, ...range, '--')
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

export async function push(path: string): Promise<string> {
  return git(path, 'push', '-u', 'origin', 'HEAD')
}

export async function createPr(path: string, title: string, body: string): Promise<string> {
  return (await run(path, 'gh', ['pr', 'create', '--title', title, '--body', body])).trim()
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
