import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { Account, Db, Session } from './db'
import * as git from './git'
import * as history from './history'
import { configEnv, copyTranscript, defaultConfigDir, loginCommand } from './accounts'
import type { PtyManager } from './pty'
import type { AccountInfo, AgentDeckApi, ModelInfo, NewSessionInput, ProjectInfo, SessionInfo } from '../shared/ipc'
import type { AgentEvent, ApprovalDecision, ImageAttachment, LimitWindow, PermissionMode, ProviderAdapter, ProviderId, SessionStatus } from '../shared/types'

export interface Emitter {
  event(sessionId: string, e: AgentEvent): void
  session(s: SessionInfo): void
}
export interface SessionManagerDeps {
  db: Db
  adapters: Record<ProviderId, ProviderAdapter>
  worktreesDir: string
  /** Each account gets a subfolder here as its CLAUDE_CONFIG_DIR / CODEX_HOME. */
  accountsDir?: string
  emit: Emitter
  /** Electron-only: folder picker. Returns the chosen path or null. */
  pickFolder?: () => Promise<string | null>
  /** Optional so tests don't spawn shells. */
  pty?: PtyManager
}

const TITLE_MAX = 60
const truncate = (t: string): string => (t.length > TITLE_MAX ? t.slice(0, TITLE_MAX - 1) + '…' : t)

export class SessionManager implements Omit<AgentDeckApi, 'onEvent' | 'onSessionUpdated' | 'getSettings' | 'setSettings' | 'onTermData' | 'onSelectSession'> {
  private active = new Set<string>() // sessions whose adapter is started this run
  private titles = new Map<string, string>()

  constructor(private d: SessionManagerDeps) {}

  async addProject(): Promise<ProjectInfo | null> {
    const path = await this.d.pickFolder?.()
    if (!path) return null
    if (!(await git.isGitRepo(path))) throw new Error(`${path} is not a git repository`)
    const existing = this.d.db.listProjects().find((p) => p.path === path)
    if (existing) return existing
    const p = { id: randomUUID(), path, name: basename(path) }
    this.d.db.addProject(p)
    return p
  }
  async listProjects(): Promise<ProjectInfo[]> { return this.d.db.listProjects() }
  async listSessions(projectId: string): Promise<SessionInfo[]> {
    return this.d.db.listSessions(projectId).filter((s) => s.status !== ARCHIVED).map((s) => this.info(s))
  }
  async listModels(provider: ProviderId): Promise<ModelInfo[]> { return this.d.adapters[provider].listModels() }
  async providerModes(provider: ProviderId): Promise<PermissionMode[]> { return [...this.d.adapters[provider].permissionModes] }
  async getEvents(sessionId: string): Promise<AgentEvent[]> { return this.d.db.listEvents(sessionId) }
  async getLimits(provider: ProviderId): Promise<LimitWindow[]> { return this.d.adapters[provider].getLimits() }

  async createSession(input: NewSessionInput): Promise<SessionInfo> {
    const project = this.d.db.listProjects().find((p) => p.id === input.projectId)
    if (!project) throw new Error(`unknown project ${input.projectId}`)
    if (input.accountId) this.account(input.accountId, input.provider)
    const id = randomUUID()
    let worktreePath: string | null = null
    let branch: string | null = null
    if (input.useWorktree) {
      const wt = await git.addWorktree(project.path, `agentdeck/${id.slice(0, 8)}`, join(this.d.worktreesDir, project.name))
      worktreePath = wt.path
      branch = wt.branch
      try {
        const setup = await git.setupWorktree(project.path, wt.path, await git.readAgentdeckConfig(project.path))
        if (setup.exitCode !== 0) throw new Error(`agentdeck.json setup failed (exit ${setup.exitCode}): ${setup.output}`)
      } catch (e) {
        await git.removeWorktree(project.path, wt.path, wt.branch).catch(() => {}) // don't leave a half-set-up worktree behind
        throw e
      }
    }
    const row: Session = {
      id, projectId: project.id, provider: input.provider, accountId: input.accountId ?? null, model: input.model ?? null,
      permissionMode: input.permissionMode, worktreePath, branch, status: 'idle', resumeToken: null, createdAt: Date.now(), title: null,
    }
    this.d.db.createSession(row)
    await this.start(row)
    if (input.firstMessage) await this.sendMessage(id, input.firstMessage)
    return this.info(this.row(id))
  }

  async sendMessage(sessionId: string, text: string, images?: ImageAttachment[]): Promise<void> {
    const row = this.row(sessionId)
    if (!this.active.has(sessionId)) await this.start(row) // lazy resume after app restart
    if (!this.titles.has(sessionId) && !this.d.db.listEvents(sessionId).some((e) => e.type === 'message' && e.role === 'user')) {
      this.titles.set(sessionId, truncate(text))
      this.d.emit.session(this.info(row))
    }
    // shortcut: best-effort snapshot; a failure must not block the prompt. Upgrade to surfacing the error if rewinds go missing.
    await git.createCheckpoint(this.cwd(row), sessionId, text).catch(() => {})
    this.record(sessionId, { type: 'message', role: 'user', text, ...(images?.length ? { images } : {}) })
    await this.d.adapters[row.provider].send(sessionId, text, images)
  }
  async interrupt(sessionId: string): Promise<void> {
    if (this.active.has(sessionId)) await this.d.adapters[this.row(sessionId).provider].interrupt(sessionId)
  }
  async respondToApproval(sessionId: string, approvalId: string, decision: ApprovalDecision): Promise<void> {
    await this.d.adapters[this.row(sessionId).provider].respondToApproval(sessionId, approvalId, decision)
    this.record(sessionId, { type: 'approval_decision', id: approvalId, allow: decision.allow }) // survives reload
  }

  async renameSession(sessionId: string, title: string): Promise<SessionInfo> {
    const t = title.trim()
    if (!t) throw new Error('Name is empty')
    this.d.db.updateSession(sessionId, { title: t })
    const info = this.info(this.row(sessionId))
    this.d.emit.session(info)
    return info
  }

  async archiveSession(sessionId: string, removeWorktree: boolean): Promise<void> {
    const row = this.row(sessionId)
    if (this.active.delete(sessionId)) await this.d.adapters[row.provider].close(sessionId)
    this.d.pty?.close(sessionId)
    if (removeWorktree && row.worktreePath) {
      const project = this.d.db.listProjects().find((p) => p.id === row.projectId)
      if (project) await git.removeWorktree(project.path, row.worktreePath, row.branch ?? undefined)
    }
    this.d.db.updateSession(sessionId, { status: ARCHIVED, ...(removeWorktree ? { worktreePath: null } : {}) })
  }

  private cwd(row: Session): string {
    const cwd = row.worktreePath ?? this.d.db.listProjects().find((p) => p.id === row.projectId)?.path
    if (!cwd) throw new Error(`no working directory for session ${row.id}`)
    return cwd
  }

  private async project(row: Session): Promise<ProjectInfo> {
    const p = this.d.db.listProjects().find((p) => p.id === row.projectId)
    if (!p) throw new Error(`unknown project ${row.projectId}`)
    return p
  }
  async sessionDiff(sessionId: string, scope: 'uncommitted' | 'branch'): Promise<git.DiffResult> {
    const row = this.row(sessionId)
    return git.diff(this.cwd(row), scope === 'uncommitted' ? 'uncommitted' : { base: await git.currentBranch((await this.project(row)).path) })
  }
  async commitSession(sessionId: string, message: string): Promise<void> {
    if (!message.trim()) throw new Error('Commit message is empty')
    await git.commitAll(this.cwd(this.row(sessionId)), message)
  }
  async searchSessions(query: string): Promise<{ sessionId: string; text: string }[]> {
    return query.trim() ? this.d.db.searchMessages(query.trim()) : []
  }
  async listHistory(projectId: string): Promise<history.HistoryItem[]> { return history.listHistory(this.projectPath(projectId)) }
  async listMcp(projectId: string): Promise<history.McpServer[]> { return history.listMcp(this.projectPath(projectId)) }
  async importHistory(projectId: string, provider: 'claude' | 'codex', token: string): Promise<SessionInfo> {
    const events = await history.readHistory(this.projectPath(projectId), provider, token)
    const row: Session = {
      id: randomUUID(), projectId, provider, accountId: null, model: null, permissionMode: 'supervised',
      worktreePath: null, branch: null, status: 'idle', resumeToken: token, createdAt: Date.now(), title: null,
    }
    this.d.db.createSession(row)
    events.forEach((e) => this.d.db.appendEvent(row.id, e))
    return this.info(row)
  }
  private projectPath(projectId: string): string {
    const p = this.d.db.listProjects().find((p) => p.id === projectId)
    if (!p) throw new Error(`unknown project ${projectId}`)
    return p.path
  }
  async listFiles(sessionId: string): Promise<string[]> { return git.listFiles(this.cwd(this.row(sessionId))) }
  async listCheckpoints(sessionId: string): Promise<git.Checkpoint[]> { return git.listCheckpoints(this.cwd(this.row(sessionId)), sessionId) }
  async rewindSession(sessionId: string, checkpointId: string): Promise<void> {
    const row = this.row(sessionId)
    if (row.status === 'working') throw new Error('Stop the session before rewinding')
    await git.restoreCheckpoint(this.cwd(row), sessionId, checkpointId)
  }
  async pushSession(sessionId: string): Promise<string> { return git.push(this.cwd(this.row(sessionId))) }
  async createPr(sessionId: string, title: string, body: string): Promise<string> {
    if (!title.trim()) throw new Error('PR title is empty')
    return git.createPr(this.cwd(this.row(sessionId)), title, body)
  }

  private account(id: string, provider?: ProviderId): Account {
    const a = this.d.db.listAccounts().find((a) => a.id === id)
    if (!a || (provider && a.provider !== provider)) throw new Error(`unknown ${provider ?? ''} account ${id}`)
    return a
  }
  private configDir(row: Session): string | undefined {
    return row.accountId ? (this.account(row.accountId).configDir ?? undefined) : undefined
  }

  async listAccounts(): Promise<AccountInfo[]> {
    return this.d.db.listAccounts().map(({ id, provider, label }) => ({ id, provider, label }))
  }
  async addAccount(provider: ProviderId, label: string): Promise<AccountInfo> {
    if (!label.trim()) throw new Error('Account name is empty')
    if (!this.d.accountsDir) throw new Error('accounts unavailable')
    const id = randomUUID()
    const configDir = join(this.d.accountsDir, id)
    await mkdir(configDir, { recursive: true })
    this.d.db.addAccount({ id, provider, label: label.trim(), configDir })
    return { id, provider, label: label.trim() }
  }
  async accountLogin(accountId: string): Promise<string> {
    const a = this.account(accountId)
    if (!this.d.pty || !a.configDir) throw new Error('terminal unavailable')
    const key = `login-${accountId}`
    this.d.pty.open(key, a.configDir, configEnv(a.provider, a.configDir), loginCommand(a.provider))
    return key
  }
  async moveSession(sessionId: string, accountId: string | null): Promise<SessionInfo> {
    const row = this.row(sessionId)
    const to = accountId ? this.account(accountId, row.provider) : null
    if (row.status === 'working') throw new Error('Stop the session before moving it')
    const from = this.configDir(row) ?? defaultConfigDir(row.provider)
    const dest = to?.configDir ?? defaultConfigDir(row.provider)
    if (this.active.delete(sessionId)) await this.d.adapters[row.provider].close(sessionId)
    if (row.resumeToken && from !== dest && !(await copyTranscript(row.resumeToken, from, dest)))
      this.d.db.updateSession(sessionId, { resumeToken: null }) // transcript not found: start fresh rather than fail to resume
    this.d.db.updateSession(sessionId, { accountId })
    const next = this.row(sessionId)
    this.d.emit.session(this.info(next))
    return this.info(next)
  }
  async sessionUsage(sessionId: string) { return this.d.db.getUsage(sessionId) }

  async termOpen(sessionId: string): Promise<string> {
    if (!this.d.pty) throw new Error('terminal unavailable')
    if (sessionId.startsWith('login-')) return this.d.pty.open(sessionId, '') // already started by accountLogin
    return this.d.pty.open(sessionId, this.cwd(this.row(sessionId)))
  }
  async termWrite(sessionId: string, data: string): Promise<void> { this.d.pty?.write(sessionId, data) }
  async termResize(sessionId: string, cols: number, rows: number): Promise<void> { this.d.pty?.resize(sessionId, cols, rows) }

  private async start(row: Session): Promise<void> {
    const cwd = this.cwd(row)
    this.active.add(row.id)
    try {
      await this.d.adapters[row.provider].start(
        { sessionId: row.id, cwd, model: row.model ?? undefined, permissionMode: row.permissionMode, resumeToken: row.resumeToken ?? undefined, configDir: this.configDir(row) },
        (e) => this.onAdapterEvent(row.id, e),
      )
    } catch (e) {
      this.active.delete(row.id)
      throw e
    }
  }

  private record(sessionId: string, e: AgentEvent): void {
    this.d.db.appendEvent(sessionId, e)
    this.d.emit.event(sessionId, e)
  }

  private onAdapterEvent(sessionId: string, e: AgentEvent): void {
    this.record(sessionId, e)
    if (e.type === 'usage') this.d.db.addUsage(sessionId, e)
    if (e.type !== 'status') return
    const row = this.row(sessionId)
    const token = this.d.adapters[row.provider].getResumeToken(sessionId)
    this.d.db.updateSession(sessionId, { status: e.status, ...(token ? { resumeToken: token } : {}) })
    this.d.emit.session(this.info(this.row(sessionId)))
  }

  private projectOf = new Map<string, string>() // session id -> project id, so row() reads one project, not all

  private row(id: string): Session {
    const hit = this.projectOf.get(id)
    const s = hit && this.d.db.listSessions(hit).find((s) => s.id === id)
    if (s) return s
    for (const p of this.d.db.listProjects()) {
      const s = this.d.db.listSessions(p.id).find((s) => s.id === id)
      if (s) { this.projectOf.set(id, p.id); return s }
    }
    throw new Error(`unknown session ${id}`)
  }

  private info(s: Session): SessionInfo {
    let title = s.title ?? this.titles.get(s.id)
    if (!title) {
      const first = this.d.db.listEvents(s.id).find((e) => e.type === 'message' && e.role === 'user')
      title = first && first.type === 'message' ? truncate(first.text) : 'New session'
      this.titles.set(s.id, title)
    }
    return {
      id: s.id, projectId: s.projectId, provider: s.provider, model: s.model ?? undefined, permissionMode: s.permissionMode,
      accountId: s.accountId ?? undefined, worktreePath: s.worktreePath ?? undefined, branch: s.branch ?? undefined, status: s.status, title, createdAt: s.createdAt,
    }
  }
}

// shortcut: no archived column in the DB schema, so archived is a status value hidden from lists; add a column if it needs to be queryable.
const ARCHIVED = 'archived' as SessionStatus
