import { describe, expect, it, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb } from './db'
import { setSettings } from './settings'
import { SessionManager } from './sessions'
import type { AgentEvent, ProviderAdapter } from '../shared/types'

function fakeAdapter() {
  let emit: (e: AgentEvent) => void = () => {}
  const started: unknown[] = []
  const a = {
    id: 'claude', permissionModes: ['supervised', 'plan'], listModels: async () => [], getLimits: async () => [],
    start: vi.fn(async (o, cb) => { started.push(o); emit = cb }),
    send: vi.fn(async () => { emit({ type: 'status', status: 'done' }) }),
    interrupt: async () => {}, respondToApproval: async () => {}, close: vi.fn(async () => {}),
    getResumeToken: () => 'tok',
  } as unknown as ProviderAdapter
  return { a, started }
}

describe('SessionManager', () => {
  it('persists events, status, title, resume token; resumes lazily after restart', async () => {
    const db = openDb(':memory:')
    db.addProject({ id: 'p', path: '/repo', name: 'repo' })
    const { a, started } = fakeAdapter()
    const sessions: string[] = []
    const mk = (ad: ProviderAdapter) =>
      new SessionManager({ db, adapters: { claude: ad, codex: ad }, worktreesDir: '/wt', emit: { event: () => {}, session: (s) => sessions.push(s.status) } })

    const m = mk(a)
    const s = await m.createSession({ projectId: 'p', provider: 'claude', permissionMode: 'supervised', useWorktree: false, firstMessage: 'hello world' })
    expect(s).toMatchObject({ title: 'hello world', status: 'done' })
    expect(started[0]).toMatchObject({ cwd: '/repo' })
    expect((await m.getEvents(s.id)).map((e) => e.type)).toEqual(['message', 'status'])
    expect(sessions).toContain('done')

    const second = fakeAdapter() // simulated restart
    await mk(second.a).sendMessage(s.id, 'again')
    expect(second.started[0]).toMatchObject({ resumeToken: 'tok' })

    expect(await m.renameSession(s.id, '  My name ')).toMatchObject({ title: 'My name' })
    await expect(m.renameSession(s.id, ' ')).rejects.toThrow('empty')

    await m.archiveSession(s.id, false)
    expect(a.close).toHaveBeenCalled()
    expect(await m.listSessions('p')).toEqual([])
  })

  it('records approval decisions as events', async () => {
    const db = openDb(':memory:')
    db.addProject({ id: 'p', path: '/repo', name: 'repo' })
    const { a } = fakeAdapter()
    const m = new SessionManager({ db, adapters: { claude: a, codex: a }, worktreesDir: '/wt', emit: { event: () => {}, session: () => {} } })
    const s = await m.createSession({ projectId: 'p', provider: 'claude', permissionMode: 'supervised', useWorktree: false })
    await m.respondToApproval(s.id, 'ap1', { allow: false })
    expect(await m.getEvents(s.id)).toContainEqual({ type: 'approval_decision', id: 'ap1', allow: false, ts: expect.any(Number) })
  })

  it('createSession stores the run group id', async () => {
    const db = openDb(':memory:')
    db.addProject({ id: 'p', path: '/repo', name: 'repo' })
    const { a } = fakeAdapter()
    const m = new SessionManager({ db, adapters: { claude: a, codex: a }, worktreesDir: '/wt', emit: { event: () => {}, session: () => {} } })
    const s = await m.createSession({ projectId: 'p', provider: 'claude', permissionMode: 'supervised', useWorktree: false, groupId: 'g1' })
    expect(s.groupId).toBe('g1')
    expect((await m.createSession({ projectId: 'p', provider: 'codex', permissionMode: 'supervised', useWorktree: false })).groupId).toBeUndefined()
  })

  it('switch agent shares the worktree, and archiving one keeps it for the other', async () => {
    const db = openDb(':memory:')
    db.addProject({ id: 'p', path: '/repo', name: 'repo' })
    const { a } = fakeAdapter()
    const m = new SessionManager({ db, adapters: { claude: a, codex: a }, worktreesDir: '/wt', emit: { event: () => {}, session: () => {} } })
    const s = await m.createSession({ projectId: 'p', provider: 'claude', permissionMode: 'supervised', useWorktree: false })
    db.updateSession(s.id, { worktreePath: '/wt/x', branch: 'b' })
    const n = await m.createSession({ projectId: 'p', provider: 'codex', permissionMode: 'supervised', useWorktree: true, shareWorktreeOf: s.id })
    expect(n.worktreePath).toBe('/wt/x')
    await m.archiveSession(n.id, true) // would throw on the fake path if it tried to remove it
    expect(db.listSessions('p').find((x) => x.id === s.id)?.worktreePath).toBe('/wt/x')
  })

  it('configureSession validates the mode, restarts the adapter, and keeps the chat', async () => {
    const db = openDb(':memory:')
    db.addProject({ id: 'p', path: '/repo', name: 'repo' })
    const { a, started } = fakeAdapter()
    const m = new SessionManager({ db, adapters: { claude: a, codex: a }, worktreesDir: '/wt', emit: { event: () => {}, session: () => {} } })
    const s = await m.createSession({ projectId: 'p', provider: 'claude', permissionMode: 'supervised', useWorktree: false, firstMessage: 'hi' })
    await expect(m.configureSession(s.id, { permissionMode: 'bypass' as never })).rejects.toThrow('no bypass mode')
    expect(await m.configureSession(s.id, { model: 'm2', permissionMode: 'plan' })).toMatchObject({ model: 'm2', permissionMode: 'plan' })
    expect(a.close).toHaveBeenCalled()
    await m.sendMessage(s.id, 'again')
    expect(started.at(-1)).toMatchObject({ model: 'm2', permissionMode: 'plan', resumeToken: 'tok' })
    db.updateSession(s.id, { status: 'working' })
    await expect(m.configureSession(s.id, { model: 'm3' })).rejects.toThrow('Stop the turn')
  })

  it('removeAccount is blocked while sessions use it, then deletes only inside accountsDir', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'acc-'))
    const outside = mkdtempSync(join(tmpdir(), 'outside-'))
    const db = openDb(':memory:')
    db.addProject({ id: 'p', path: '/repo', name: 'repo' })
    const { a } = fakeAdapter()
    const m = new SessionManager({ db, adapters: { claude: a, codex: a }, worktreesDir: '/wt', accountsDir: dir, emit: { event: () => {}, session: () => {} } })
    const acc = await m.addAccount('claude', 'work')
    const s = await m.createSession({ projectId: 'p', provider: 'claude', permissionMode: 'supervised', useWorktree: false, accountId: acc.id })
    await expect(m.removeAccount(acc.id)).rejects.toThrow('Move 1 session off this account first')
    await m.archiveSession(s.id, false)
    await expect(m.removeAccount(acc.id)).rejects.toThrow('Move 1 session') // archived rows still reference it
    db.updateSession(s.id, { accountId: null })
    await m.removeAccount(acc.id)
    expect(existsSync(join(dir, acc.id))).toBe(false)
    expect(await m.listAccounts()).toEqual([])
    db.addAccount({ id: 'x', provider: 'claude', label: 'x', configDir: outside })
    await m.removeAccount('x')
    expect(existsSync(outside)).toBe(true) // outside accountsDir: row removed, files untouched
  })

  it('resolveFile refuses paths outside the session folder', () => {
    const db = openDb(':memory:')
    db.addProject({ id: 'p', path: '/repo', name: 'repo' })
    const { a } = fakeAdapter()
    const m = new SessionManager({ db, adapters: { claude: a, codex: a }, worktreesDir: '/wt', emit: { event: () => {}, session: () => {} } })
    db.createSession({ id: 's1', projectId: 'p', provider: 'claude', accountId: null, model: null, permissionMode: 'supervised', worktreePath: null, branch: null, status: 'idle', resumeToken: null, createdAt: 1, title: 't', avatar: null } as never)
    expect(m.resolveFile('s1', 'src/a.ts')).toBe('/repo/src/a.ts')
    expect(() => m.resolveFile('s1', '../etc/passwd')).toThrow('outside')
    expect(() => m.resolveFile('s1', '/etc/passwd')).toThrow('outside')
  })
})

describe('resolveFile', () => {
  const setup = () => {
    const repo = mkdtempSync(join(tmpdir(), 'ad-rf-'))
    const outside = mkdtempSync(join(tmpdir(), 'ad-out-'))
    const db = openDb(':memory:')
    db.addProject({ id: 'p', path: repo, name: 'repo' })
    const { a } = fakeAdapter()
    const m = new SessionManager({ db, adapters: { claude: a, codex: a }, worktreesDir: '/wt', emit: { event: () => {}, session: () => {} } })
    return { repo, outside, m, create: () => m.createSession({ projectId: 'p', provider: 'claude', permissionMode: 'supervised', useWorktree: false }) }
  }

  it('accepts a file named ..foo, rejects ../ and symlink escapes', async () => {
    const { repo, outside, create, m } = setup()
    writeFileSync(join(repo, '..foo'), '')
    symlinkSync(outside, join(repo, 'link'))
    const s = await create()
    expect(m.resolveFile(s.id, '..foo')).toBe(join(repo, '..foo'))
    expect(() => m.resolveFile(s.id, '../x')).toThrow('outside')
    expect(() => m.resolveFile(s.id, 'link/secret')).toThrow('outside')
  })
})

describe('setup script trust', () => {
  it('does not create a worktree when the script is refused, and runs it when approved', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'ad-trust-'))
    const git = (...a: string[]) => execFileSync('git', a, { cwd: repo })
    git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't')
    writeFileSync(join(repo, 'agentdeck.json'), JSON.stringify({ setup: 'touch ran' }))
    git('add', '.'); git('commit', '-qm', 'i')
    const wts = mkdtempSync(join(tmpdir(), 'ad-wts-'))
    const db = openDb(':memory:')
    db.addProject({ id: 'p', path: repo, name: 'repo' })
    const { a } = fakeAdapter()
    const mk = (ok: boolean) => new SessionManager({ db, adapters: { claude: a, codex: a }, worktreesDir: wts, confirmSetup: async () => ok, emit: { event: () => {}, session: () => {} } })
    const input = { projectId: 'p', provider: 'claude' as const, permissionMode: 'supervised' as const, useWorktree: true }

    await expect(mk(false).createSession(input)).rejects.toThrow('not approved')
    expect(existsSync(join(wts, 'repo'))).toBe(false)

    const s = await mk(true).createSession(input)
    expect(existsSync(join(s.worktreePath!, 'ran'))).toBe(true)
  })
})

describe('parallel cap', () => {
  it('blocks a new turn when the cap is reached by other working sessions', async () => {
    const db = openDb(':memory:')
    db.addProject({ id: 'p', path: '/repo', name: 'repo' })
    const { a } = fakeAdapter()
    const m = new SessionManager({ db, adapters: { claude: a, codex: a }, worktreesDir: '/wt', emit: { event: () => {}, session: () => {} } })
    const mk = () => m.createSession({ projectId: 'p', provider: 'claude', permissionMode: 'supervised', useWorktree: false })
    const [s1, s2] = [await mk(), await mk()]
    db.updateSession(s1.id, { status: 'working' })
    setSettings({ maxParallel: 1 })
    try {
      await expect(m.sendMessage(s2.id, 'hi')).rejects.toThrow('Parallel limit')
      await expect(m.sendMessage(s1.id, 'hi')).resolves.toBeUndefined() // its own turn doesn't count against itself
    } finally { setSettings({ maxParallel: 0 }) }
  })
})

describe('createProject', () => {
  it('reports each step in order and makes a git repo (no GitHub)', async () => {
    const parent = mkdtempSync(join(tmpdir(), 'ad-proj-'))
    const steps: string[] = []
    const { a } = fakeAdapter()
    const m = new SessionManager({ db: openDb(':memory:'), adapters: { claude: a, codex: a }, worktreesDir: '/wt', emit: { event: () => {}, session: () => {}, progress: (s) => steps.push(s) } })
    const p = await m.createProject('demo', parent)
    expect(steps).toEqual(['folder', 'git', 'add'])
    expect(existsSync(join(parent, 'demo', '.git'))).toBe(true)
    expect(p?.name).toBe('demo')
  })
})

describe('repo git settings', () => {
  it('branches new worktrees from the configured base, and removeProject refuses while sessions exist', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'ad-base-'))
    const g = (...a: string[]) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' })
    g('init', '-q', '-b', 'main'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't')
    writeFileSync(join(repo, 'a'), '1'); g('add', '.'); g('commit', '-qm', 'one')
    g('branch', 'base'); g('checkout', '-q', '-b', 'other'); writeFileSync(join(repo, 'b'), '2'); g('add', '.'); g('commit', '-qm', 'two')
    const db = openDb(':memory:')
    db.addProject({ id: 'p', path: repo, name: 'repo' })
    setSettings({ repoGit: { p: { baseBranch: 'base', remote: '' } } })
    const { a } = fakeAdapter()
    const m = new SessionManager({ db, adapters: { claude: a, codex: a }, worktreesDir: mkdtempSync(join(tmpdir(), 'ad-wt-')), emit: { event: () => {}, session: () => {} } })
    const s = await m.createSession({ projectId: 'p', provider: 'claude', permissionMode: 'supervised', useWorktree: true })
    expect(existsSync(join(s.worktreePath!, 'b'))).toBe(false) // 'other' has b; 'base' does not
    expect((await m.listRefs('p')).branches).toContain('base')
    await expect(m.removeProject('p')).rejects.toThrow('Archive')
    await m.archiveSession(s.id, true)
    await m.removeProject('p')
    expect(await m.listProjects()).toEqual([])
  })
  it('archive removes the worktree and local branch when deleteBranchOnArchive is set, even if the caller passes false', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'ad-arch-'))
    const g = (...a: string[]): string => execFileSync('git', a, { cwd: repo }).toString()
    g('init', '-q', '-b', 'main'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't')
    writeFileSync(join(repo, 'a'), '1'); g('add', '.'); g('commit', '-qm', 'one')
    const db = openDb(':memory:')
    db.addProject({ id: 'p', path: repo, name: 'repo' })
    setSettings({ repoGit: { p: { baseBranch: '', remote: '' } }, deleteBranchOnArchive: true, branchPrefixMode: 'custom', branchPrefix: 'ad' })
    const { a } = fakeAdapter()
    const m = new SessionManager({ db, adapters: { claude: a, codex: a }, worktreesDir: mkdtempSync(join(tmpdir(), 'ad-wt-')), emit: { event: () => {}, session: () => {} } })
    const s = await m.createSession({ projectId: 'p', provider: 'claude', permissionMode: 'supervised', useWorktree: true })
    expect(s.branch).toMatch(/^ad\//)
    await m.archiveSession(s.id, false)
    expect(existsSync(s.worktreePath!)).toBe(false)
    expect(g('branch', '--list', s.branch!).trim()).toBe('')
  })
})
