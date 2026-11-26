import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { openDb, type Session } from './db'

const session: Session = {
  id: 's1', projectId: 'p1', provider: 'claude', accountId: 'a1', model: 'opus', permissionMode: 'supervised',
  worktreePath: '/wt', branch: 'feat', status: 'idle', resumeToken: null, createdAt: 1, title: null, avatar: null,
}

describe('db', () => {
  it('round-trips projects, accounts, sessions, usage', () => {
    const db = openDb(':memory:')
    db.addProject({ id: 'p1', path: '/repo', name: 'repo' })
    db.addAccount({ id: 'a1', provider: 'claude', label: 'work', configDir: '/cfg' })
    db.createSession(session)
    db.createSession({ ...session, id: 's2', projectId: 'p2' })
    db.updateSession('s1', { status: 'working', resumeToken: 'tok' })
    db.addUsage('s1', { inputTokens: 10, outputTokens: 5, costUsd: 0.5 })
    db.addUsage('s1', { inputTokens: 1 })

    expect(db.listProjects()).toEqual([{ id: 'p1', path: '/repo', name: 'repo' }])
    expect(db.listAccounts()).toEqual([{ id: 'a1', provider: 'claude', label: 'work', configDir: '/cfg' }])
    expect(db.listSessions('p1')).toEqual([{ ...session, status: 'working', resumeToken: 'tok' }])
    expect(db.getUsage('s1')).toEqual({ inputTokens: 11, outputTokens: 5, costUsd: 0.5 })
    expect(db.getUsage('none')).toEqual({ inputTokens: 0, outputTokens: 0, costUsd: 0 })
  })

  it('searches message text across sessions, escaping wildcards and skipping partials', () => {
    const db = openDb(':memory:')
    db.appendEvent('s1', { type: 'message', role: 'user', text: 'fix the Login bug' })
    db.appendEvent('s2', { type: 'message', role: 'assistant', text: '100% done', partial: true })
    db.appendEvent('s2', { type: 'message', role: 'assistant', text: '100% done' })
    db.appendEvent('s2', { type: 'message', role: 'assistant', text: '1000 done' })
    expect(db.searchMessages('login').map((r) => r.sessionId)).toEqual(['s1'])
    expect(db.searchMessages('100%')).toEqual([{ sessionId: 's2', text: '100% done' }])
  })

  it('replays events in append order', () => {
    const db = openDb(':memory:')
    const evs = [
      { type: 'message', role: 'user', text: 'hi' },
      { type: 'tool_call', id: 't', name: 'ls', input: { a: 1 } },
      { type: 'status', status: 'done' },
    ] as const
    evs.forEach((e) => db.appendEvent('s1', e))
    db.appendEvent('other', { type: 'status', status: 'idle' })
    expect(db.listEvents('s1')).toEqual(evs.map((e) => ({ ...e, ts: expect.any(Number) })))
  })

  it('migrates a v1 database (no title column) without losing sessions', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'agentdeck-db-')), 'v1.db')
    const old = new DatabaseSync(path)
    old.exec(`CREATE TABLE sessions (id TEXT PRIMARY KEY, projectId TEXT NOT NULL, provider TEXT NOT NULL, accountId TEXT, model TEXT,
      permissionMode TEXT NOT NULL, worktreePath TEXT, branch TEXT, status TEXT NOT NULL, resumeToken TEXT, createdAt INTEGER NOT NULL);
      INSERT INTO sessions (id, projectId, provider, permissionMode, status, createdAt) VALUES ('s1', 'p1', 'claude', 'supervised', 'idle', 1);
      PRAGMA user_version = 1;`)
    old.close()
    const db = openDb(path)
    db.updateSession('s1', { title: 'renamed', avatar: '{"color":2,"shape":3}' })
    expect(db.listSessions('p1')[0]).toMatchObject({ id: 's1', title: 'renamed', avatar: '{"color":2,"shape":3}' })
    db.close()
    openDb(path).close() // reopening at the current version must not re-run the migration
  })

  it('resets stuck sessions on open and skips corrupt event rows', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'ad-db-')), 'a.db')
    const db = openDb(path)
    db.addProject({ id: 'p', name: 'p', path: '/p' })
    db.createSession({ ...session, id: 's', projectId: 'p', status: 'working' })
    db.appendEvent('s', { type: 'message', role: 'user', text: 'hi' })
    db.close()
    const raw = new DatabaseSync(path)
    raw.exec("INSERT INTO events (sessionId, ts, json) VALUES ('s', 1, '{bad')")
    raw.close()
    const re = openDb(path)
    expect(re.listSessions('p')[0].status).toBe('idle')
    expect(re.listEvents('s')).toHaveLength(1)
    re.close()
  })
})

describe('listUsage', () => {
  it('lists spending sessions, biggest first', () => {
    const db = openDb(':memory:')
    for (const id of ['a', 'b']) db.createSession({ ...session, id })
    db.addUsage('a', { costUsd: 1, inputTokens: 5 })
    db.addUsage('b', { costUsd: 3 })
    expect(db.listUsage().map((r) => r.sessionId)).toEqual(['b', 'a'])
  })
})
