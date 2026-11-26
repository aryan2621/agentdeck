import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { git, gitEnv } from './exec'

// ---- checkpoints: hidden refs/agentdeck/<session>/<time> commits of the whole worktree, taken before each prompt ----
export interface Checkpoint { id: string; label: string; createdAt: number }

const AUTHOR = { GIT_AUTHOR_NAME: 'AgentDeck', GIT_AUTHOR_EMAIL: 'agentdeck@localhost', GIT_COMMITTER_NAME: 'AgentDeck', GIT_COMMITTER_EMAIL: 'agentdeck@localhost' }

const ckPrefix = (sessionId: string): string => `refs/agentdeck/${sessionId}/`

/** Runs `fn` with a throwaway index so the user's real index and branch are never touched. */
export async function withTempIndex<T>(fn: (env: NodeJS.ProcessEnv) => Promise<T>): Promise<T> {
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
