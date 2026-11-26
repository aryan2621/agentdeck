import { describe, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb } from './db'
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
