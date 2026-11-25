import { describe, expect, it, vi } from 'vitest'
import { openDb } from './db'
import { SessionManager } from './sessions'
import type { AgentEvent, ProviderAdapter } from '../shared/types'

function fakeAdapter() {
  let emit: (e: AgentEvent) => void = () => {}
  const started: unknown[] = []
  const a = {
    id: 'claude', permissionModes: ['supervised'], listModels: async () => [], getLimits: async () => [],
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
      new SessionManager({ db, adapters: { claude: ad, codex: ad, opencode: ad, gemini: ad }, worktreesDir: '/wt', emit: { event: () => {}, session: (s) => sessions.push(s.status) } })

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
    const m = new SessionManager({ db, adapters: { claude: a, codex: a, opencode: a, gemini: a }, worktreesDir: '/wt', emit: { event: () => {}, session: () => {} } })
    const s = await m.createSession({ projectId: 'p', provider: 'claude', permissionMode: 'supervised', useWorktree: false })
    await m.respondToApproval(s.id, 'ap1', { allow: false })
    expect(await m.getEvents(s.id)).toContainEqual({ type: 'approval_decision', id: 'ap1', allow: false })
  })
})
