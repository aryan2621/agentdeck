import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { git, gitEnv, safeRef } from './exec'
import { withTempIndex } from './checkpoints'

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
