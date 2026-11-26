import { DatabaseSync } from 'node:sqlite'
import type { AgentEvent, PermissionMode, ProviderId, SessionStatus } from '../shared/types'

export interface Project { id: string; path: string; name: string }
export interface Account { id: string; provider: ProviderId; label: string; configDir: string | null }
export interface UsageRow { sessionId: string; title: string | null; projectId: string; provider: string; model: string | null; createdAt: number; inputTokens: number; outputTokens: number; costUsd: number }
export interface Session {
  id: string
  projectId: string
  provider: ProviderId
  accountId: string | null
  model: string | null
  permissionMode: PermissionMode
  worktreePath: string | null
  branch: string | null
  status: SessionStatus
  resumeToken: string | null
  createdAt: number
  title: string | null // user-chosen name; null = derived from the first message
  avatar?: string | null // JSON AvatarChoice; null = look derived from the id
  effort?: string | null // reasoning effort; null = provider default
  groupId?: string | null // sessions started from one prompt share this; null = standalone
}
export interface Usage { inputTokens: number; outputTokens: number; costUsd: number }

// Append-only: MIGRATIONS[i] upgrades user_version i to i+1. Never edit a shipped step.
const MIGRATIONS = ['ALTER TABLE sessions ADD COLUMN title TEXT', 'ALTER TABLE sessions ADD COLUMN avatar TEXT', 'ALTER TABLE sessions ADD COLUMN effort TEXT', 'ALTER TABLE sessions ADD COLUMN groupId TEXT']
const SCHEMA_VERSION = MIGRATIONS.length + 1
const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, path TEXT NOT NULL, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, provider TEXT NOT NULL, label TEXT NOT NULL, configDir TEXT);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, projectId TEXT NOT NULL, provider TEXT NOT NULL, accountId TEXT, model TEXT,
  permissionMode TEXT NOT NULL, worktreePath TEXT, branch TEXT, status TEXT NOT NULL,
  resumeToken TEXT, createdAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, sessionId TEXT NOT NULL, ts INTEGER NOT NULL, json TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS events_session ON events(sessionId, id);
CREATE TABLE IF NOT EXISTS usage (
  sessionId TEXT PRIMARY KEY, inputTokens INTEGER NOT NULL DEFAULT 0,
  outputTokens INTEGER NOT NULL DEFAULT 0, costUsd REAL NOT NULL DEFAULT 0
);`

const SESSION_COLS = ['projectId', 'provider', 'accountId', 'model', 'permissionMode', 'worktreePath', 'branch', 'status', 'resumeToken', 'createdAt', 'title', 'avatar', 'effort', 'groupId'] as const

export function openDb(path: string) {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL') // no-op for :memory:
  db.exec(SCHEMA)
  const from = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version
  MIGRATIONS.slice(Math.max(from, 1) - 1).forEach((m) => db.exec(m))
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
  // No agent survives a restart; a crash would otherwise leave sessions stuck on 'working' and block revert/rewind/quit.
  db.exec("UPDATE sessions SET status = 'idle' WHERE status IN ('working', 'needs-you')")

  const all = <T>(sql: string, ...p: (string | number | null)[]) => db.prepare(sql).all(...p) as T[]
  const run = (sql: string, ...p: (string | number | null)[]) => db.prepare(sql).run(...p)

  return {
    close: () => db.close(),
    addProject: (p: Project) => void run('INSERT INTO projects (id, path, name) VALUES (?, ?, ?)', p.id, p.path, p.name),
    listProjects: () => all<Project>('SELECT * FROM projects'),
    removeProject: (id: string) => void run('DELETE FROM projects WHERE id = ?', id),
    addAccount: (a: Account) =>
      void run('INSERT INTO accounts (id, provider, label, configDir) VALUES (?, ?, ?, ?)', a.id, a.provider, a.label, a.configDir),
    listAccounts: () => all<Account>('SELECT * FROM accounts'),
    removeAccount: (id: string) => void run('DELETE FROM accounts WHERE id = ?', id),
    /** All sessions (any project) that use the account. */
    countAccountSessions: (id: string) => (all<{ n: number }>('SELECT COUNT(*) AS n FROM sessions WHERE accountId = ?', id)[0]?.n ?? 0),
    createSession: (s: Session) =>
      void run(`INSERT INTO sessions (id, ${SESSION_COLS.join(', ')}) VALUES (?${', ?'.repeat(SESSION_COLS.length)})`, s.id, ...SESSION_COLS.map((c) => s[c] ?? null)),
    updateSession(id: string, patch: Partial<Omit<Session, 'id'>>) {
      const keys = SESSION_COLS.filter((c) => c in patch) // whitelist: column names never come from the caller
      if (!keys.length) return
      run(`UPDATE sessions SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...keys.map((k) => patch[k] ?? null), id)
    },
    listSessions: (projectId: string) => all<Session>('SELECT * FROM sessions WHERE projectId = ? ORDER BY createdAt, rowid', projectId),
    appendEvent: (sessionId: string, e: AgentEvent) =>
      void run('INSERT INTO events (sessionId, ts, json) VALUES (?, ?, ?)', sessionId, Date.now(), JSON.stringify(e)),
    listEvents: (sessionId: string) =>
      all<{ json: string; ts: number }>('SELECT json, ts FROM events WHERE sessionId = ? ORDER BY id', sessionId).flatMap((r) => {
        try { return [{ ...JSON.parse(r.json), ts: r.ts } as AgentEvent] } catch { return [] } // one corrupt row must not hide the transcript
      }),
    /** Time of the session's newest event, or null before it has any. */
    lastEventTs: (sessionId: string) => all<{ ts: number }>('SELECT ts FROM events WHERE sessionId = ? ORDER BY id DESC LIMIT 1', sessionId)[0]?.ts ?? null,
    /** Chat messages (not streaming partials) containing `q`, newest first. */
    searchMessages: (q: string, limit = 50) =>
      all<{ sessionId: string; text: string }>(
        `SELECT sessionId, json_extract(json, '$.text') AS text FROM events
         WHERE json_extract(json, '$.type') = 'message' AND json_extract(json, '$.partial') IS NULL
           AND json_extract(json, '$.text') LIKE ? ESCAPE '\\' ORDER BY id DESC LIMIT ?`,
        `%${q.replace(/[\\%_]/g, '\\$&')}%`, limit,
      ),
    /** Accumulates onto the session's running totals. */
    addUsage: (sessionId: string, u: Partial<Usage>) =>
      void run(
        `INSERT INTO usage (sessionId, inputTokens, outputTokens, costUsd) VALUES (?, ?, ?, ?)
         ON CONFLICT(sessionId) DO UPDATE SET inputTokens = inputTokens + excluded.inputTokens,
           outputTokens = outputTokens + excluded.outputTokens, costUsd = costUsd + excluded.costUsd`,
        sessionId, u.inputTokens ?? 0, u.outputTokens ?? 0, u.costUsd ?? 0,
      ),
    /** Every session that has spent anything, for the cost view. */
    listUsage: () =>
      all<UsageRow>('SELECT u.sessionId, s.title, s.projectId, s.provider, s.model, s.createdAt, u.inputTokens, u.outputTokens, u.costUsd FROM usage u JOIN sessions s ON s.id = u.sessionId ORDER BY u.costUsd DESC'),
    getUsage: (sessionId: string): Usage =>
      all<Usage>('SELECT inputTokens, outputTokens, costUsd FROM usage WHERE sessionId = ?', sessionId)[0] ?? { inputTokens: 0, outputTokens: 0, costUsd: 0 },
  }
}

export type Db = ReturnType<typeof openDb>
