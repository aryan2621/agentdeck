import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  addWorktree, branchStatus, commitAll, createCheckpoint, createPr, listCheckpoints, rewindPreview, listFiles, restoreCheckpoint, currentBranch, diff, isGitRepo, readAgentdeckConfig,
  removeWorktree, revertFile, revertHunk, setupWorktree
} from './git'

let tmp: string
let repo: string
const g = (cwd: string, ...a: string[]): string =>
  execFileSync('git', a, { cwd, encoding: 'utf8' })

beforeEach(() => {
  tmp = realpathSync(mkdtempSync(join(tmpdir(), 'agentdeck-git-')))
  repo = join(tmp, 'repo')
  mkdirSync(repo)
  g(repo, 'init', '-b', 'main')
  g(repo, 'config', 'user.email', 't@t.t')
  g(repo, 'config', 'user.name', 't')
  g(repo, 'config', 'commit.gpgsign', 'false')
})
afterEach(() => rmSync(tmp, { recursive: true, force: true }))

const initialCommit = (): void => {
  writeFileSync(join(repo, 'a.txt'), 'one\n')
  g(repo, 'add', '-A')
  g(repo, 'commit', '-m', 'init')
}

describe('git service', () => {
  it('detects repos and branch', async () => {
    expect(await isGitRepo(repo)).toBe(true)
    expect(await isGitRepo(tmp)).toBe(false)
    initialCommit()
    expect(await currentBranch(repo)).toBe('main')
  })

  it('throws readable error without commits', async () => {
    await expect(addWorktree(repo, 'x', join(tmp, 'wt'))).rejects.toThrow(/no commits/)
    await expect(diff(repo, 'uncommitted')).rejects.toThrow(/no commits/)
  })

  it('adds and removes a worktree with branch', async () => {
    initialCommit()
    const wt = await addWorktree(repo, 'feat/x', join(tmp, 'wt'))
    expect(existsSync(join(wt.path, 'a.txt'))).toBe(true)
    expect(await currentBranch(wt.path)).toBe('feat/x')
    await removeWorktree(repo, wt.path, 'feat/x')
    expect(existsSync(wt.path)).toBe(false)
    expect(g(repo, 'branch', '--list', 'feat/x').trim()).toBe('')
  })

  it('rejects option-like branch names', async () => {
    initialCommit()
    await expect(addWorktree(repo, '--evil', join(tmp, 'wt'))).rejects.toThrow(/Invalid/)
  })

  it('reads and validates config', async () => {
    expect(await readAgentdeckConfig(repo)).toEqual({})
    writeFileSync(join(repo, 'agentdeck.json'), '{"copy":[".env"],"setup":"echo hi"}')
    expect(await readAgentdeckConfig(repo)).toEqual({ copy: ['.env'], setup: 'echo hi' })
    writeFileSync(join(repo, 'agentdeck.json'), '{"copy":"nope"}')
    await expect(readAgentdeckConfig(repo)).rejects.toThrow(/copy/)
    writeFileSync(join(repo, 'agentdeck.json'), '{bad')
    await expect(readAgentdeckConfig(repo)).rejects.toThrow(/valid JSON/)
  })

  it('copies files, rejects escapes, runs setup', async () => {
    initialCommit()
    writeFileSync(join(repo, '.env'), 'SECRET=1')
    const wt = await addWorktree(repo, 'cfg', join(tmp, 'wt'))
    const r = await setupWorktree(repo, wt.path, { copy: ['.env', 'missing.txt'], setup: 'echo ran; pwd' })
    expect(readFileSync(join(wt.path, '.env'), 'utf8')).toBe('SECRET=1')
    expect(r.exitCode).toBe(0)
    expect(r.output).toContain('ran')
    expect(r.output).toContain(wt.path)
    await expect(setupWorktree(repo, wt.path, { copy: ['../secret'] })).rejects.toThrow(/escapes/)
    await expect(setupWorktree(repo, wt.path, { copy: ['/etc/passwd'] })).rejects.toThrow(/escapes/)
    const bad = await setupWorktree(repo, wt.path, { setup: 'echo oops >&2; exit 3' })
    expect(bad.exitCode).toBe(3)
    expect(bad.output).toContain('oops')
  })

  it('diffs uncommitted and against base', async () => {
    initialCommit()
    writeFileSync(join(repo, 'a.txt'), 'one\ntwo\n')
    const u = await diff(repo, 'uncommitted')
    expect(u.diff).toContain('+two')
    expect(u.files).toEqual([{ path: 'a.txt', status: 'M', additions: 1, deletions: 0 }])

    const wt = await addWorktree(repo, 'b', join(tmp, 'wt'))
    writeFileSync(join(wt.path, 'new.txt'), 'x\ny\n')
    await commitAll(wt.path, 'add new')
    const b = await diff(wt.path, { base: 'main' })
    expect(b.files).toEqual([{ path: 'new.txt', status: 'A', additions: 2, deletions: 0 }])
    expect(b.diff).toContain('+y')
    await expect(diff(wt.path, { base: '--x' })).rejects.toThrow(/Invalid/)
  })

  it('lists untracked files in the uncommitted diff', async () => {
    initialCommit()
    writeFileSync(join(repo, 'new.txt'), 'x\n')
    const d = await diff(repo, 'uncommitted')
    expect(d.files.map((f) => f.path)).toContain('new.txt')
  })

  it('checkpoint restores edits, deletions and new files without touching the branch or index', async () => {
    initialCommit()
    writeFileSync(join(repo, 'u.txt'), 'untracked\n')
    const head = g(repo, 'rev-parse', 'HEAD')
    await createCheckpoint(repo, 's1', 'first prompt')
    writeFileSync(join(repo, 'a.txt'), 'changed\n')
    rmSync(join(repo, 'u.txt'))
    writeFileSync(join(repo, 'extra.txt'), 'x\n')
    const [ck] = await listCheckpoints(repo, 's1')
    expect(ck.label).toBe('first prompt')
    await restoreCheckpoint(repo, 's1', ck.id)
    expect(readFileSync(join(repo, 'a.txt'), 'utf8')).toBe('one\n')
    expect(readFileSync(join(repo, 'u.txt'), 'utf8')).toBe('untracked\n')
    expect(existsSync(join(repo, 'extra.txt'))).toBe(false)
    expect(g(repo, 'rev-parse', 'HEAD')).toBe(head)
    expect(g(repo, 'status', '--porcelain')).toContain('?? u.txt')
    expect((await listCheckpoints(repo, 's1')).map((c) => c.label)).toContain('Before rewind')
  })

  it('rewindPreview lists the files a rewind would change', async () => {
    initialCommit()
    await createCheckpoint(repo, 's1', 'p')
    writeFileSync(join(repo, 'a.txt'), 'changed\n')
    writeFileSync(join(repo, 'extra.txt'), 'x\n')
    const [ck] = await listCheckpoints(repo, 's1')
    expect((await rewindPreview(repo, 's1', ck.id)).sort()).toEqual(['a.txt', 'extra.txt'])
  })

  it('a missing gh binary gives an install hint', async () => {
    initialCommit()
    const path = process.env.PATH
    process.env.PATH = ''
    try { await expect(createPr(repo, 't', 'b')).rejects.toThrow(/GitHub CLI \(gh\) not found/) } finally { process.env.PATH = path }
  })

  it('listFiles returns tracked and untracked files but not ignored ones', async () => {
    initialCommit()
    writeFileSync(join(repo, '.gitignore'), 'skip.txt\n')
    writeFileSync(join(repo, 'skip.txt'), 'x')
    writeFileSync(join(repo, 'new.txt'), 'x')
    const f = await listFiles(repo)
    expect(f).toEqual(expect.arrayContaining(['a.txt', 'new.txt']))
    expect(f).not.toContain('skip.txt')
  })
})

describe('branchStatus', () => {
  it('reports dirty and ahead (null without an upstream)', async () => {
    initialCommit()
    expect(await branchStatus(repo)).toEqual({ dirty: false, ahead: null })
    const remote = join(tmp, 'remote.git')
    g(tmp, 'init', '--bare', '-b', 'main', remote)
    g(repo, 'remote', 'add', 'origin', remote)
    g(repo, 'push', '-u', 'origin', 'HEAD')
    expect(await branchStatus(repo)).toEqual({ dirty: false, ahead: 0 })
    writeFileSync(join(repo, 'b.txt'), 'x')
    expect(await branchStatus(repo)).toEqual({ dirty: true, ahead: 0 })
    await commitAll(repo, 'two')
    expect(await branchStatus(repo)).toEqual({ dirty: false, ahead: 1 })
  })
})

describe('revertFile', () => {
  it('restores a modified file and deletes a new one', async () => {
    initialCommit()
    const first = listFiles(repo).then((f) => f[0])
    const name = await first
    writeFileSync(join(repo, name), 'changed')
    await revertFile(repo, name, join(repo, name))
    expect(g(repo, 'status', '--porcelain')).toBe('')
    writeFileSync(join(repo, 'new.txt'), 'x')
    g(repo, 'add', 'new.txt')
    await revertFile(repo, 'new.txt', join(repo, 'new.txt'))
    expect(existsSync(join(repo, 'new.txt'))).toBe(false)
    expect(g(repo, 'status', '--porcelain')).toBe('')
  })
})

describe('revertHunk', () => {
  it('reverts only the chosen hunk', async () => {
    const body = Array.from({ length: 40 }, (_, i) => `line${i}`).join('\n') + '\n'
    writeFileSync(join(repo, 'f.txt'), body)
    g(repo, 'add', '.'); g(repo, 'commit', '-m', 'init')
    writeFileSync(join(repo, 'f.txt'), body.replace('line2\n', 'TWO\n').replace('line35\n', 'THIRTYFIVE\n'))
    await revertHunk(repo, 'f.txt', 1)
    const now = readFileSync(join(repo, 'f.txt'), 'utf8')
    expect(now).toContain('TWO')
    expect(now).toContain('line35')
    await expect(revertHunk(repo, 'f.txt', 5)).rejects.toThrow(/no longer exists/)
  })
})
