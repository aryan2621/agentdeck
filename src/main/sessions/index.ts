import { randomUUID } from 'node:crypto'
import { join, relative, resolve } from 'node:path'
import type { Session } from '../db'
import * as git from '../git'
import * as history from '../history'
import { getSettings, setSettings, userEnv } from '../settings'
import { transcriptMarkdown } from '../transcript'
import { agentInfo, branchPrefix, checkTool } from '../tools'
import { copyTranscript, defaultConfigDir } from '../accounts'
import { type AccountInfo, type AvatarChoice, type AgentDeckApi, type ModelInfo, type NewSessionInput, type ProjectInfo, type SessionInfo } from '../../shared/ipc'
import { ARCHIVED, type SessionManagerDeps } from './deps'
import { ProjectService } from './projects'
import { AccountService } from './accountService'
import { resolveInside } from './paths'
import { sessionPort } from '../../shared/types'
import { CITIES, pickCity } from '../../shared/cities'
import type { AgentEvent, ApprovalDecision, ImageAttachment, LimitWindow, PermissionMode, ProviderId } from '../../shared/types'

export type { SessionManagerDeps }

const TITLE_MAX = 60
const CITY_SET = new Set(CITIES)
const truncate = (t: string): string => (t.length > TITLE_MAX ? t.slice(0, TITLE_MAX - 1) + '…' : t)

export class SessionManager implements Omit<AgentDeckApi, 'onEvent' | 'onSessionUpdated' | 'onProjectProgress' | 'getSettings' | 'setSettings' | 'onTermData' | 'onSelectSession' | 'pathForFile' | 'openFile' | 'playSound' | 'addSound' | 'listSounds' | 'fullDiskAccess' | 'openDiskAccessSettings' | 'gitIdentity' | 'apiKeyStatus' | 'setApiKey' | 'openClaudeSettings'> {
  private active = new Set<string>() // sessions whose adapter is started this run
  private titles = new Map<string, string>()

  private projects: ProjectService
  private accounts: AccountService

  constructor(private d: SessionManagerDeps) {
    this.projects = new ProjectService(d)
    this.accounts = new AccountService(d)
  }

  async addProject(dropped?: string): Promise<ProjectInfo | null> { return this.projects.add(dropped) }
  async initProject(path: string, github?: 'private' | 'public'): Promise<ProjectInfo | null> { return this.projects.init(path, github) }
  private worktreesRoot(): string { return getSettings().worktreesDir || this.d.worktreesDir }
  async getWorktreesRoot(): Promise<string> { return this.worktreesRoot() }
  async pickDirectory(): Promise<string | null> { return (await this.d.pickFolder?.()) ?? null }
  async githubOwners(): Promise<string[]> { return git.githubOwners() }
  async githubRepoAvailable(slug: string): Promise<boolean> { return git.repoAvailable(slug) }
  async createProject(name: string, parent: string, github?: 'private' | 'public', repo?: string): Promise<ProjectInfo | null> { return this.projects.create(name, parent, github, repo) }
  async cloneProject(repo: string, parent: string): Promise<ProjectInfo | null> { return this.addProject(await git.cloneRepo(repo, parent)) }
  /** Sessions mid-turn, not counting `except` (so a follow-up in a busy session isn't blocked by itself). */
  private running(except: string): number { return this.d.db.listProjects().flatMap((p) => this.d.db.listSessions(p.id)).filter((s) => s.status === 'working' && s.id !== except).length }
  hasWorking(): boolean { return this.d.db.listProjects().some((p) => this.d.db.listSessions(p.id).some((s) => s.status === 'working')) }
  async listProjects(): Promise<ProjectInfo[]> { return this.d.db.listProjects() }
  async listSessions(projectId: string): Promise<SessionInfo[]> {
    return this.d.db.listSessions(projectId).filter((s) => s.status !== ARCHIVED).map((s) => this.info(s))
  }
  async listArchived(): Promise<SessionInfo[]> {
    return this.d.db.listProjects().flatMap((p) => this.d.db.listSessions(p.id)).filter((s) => s.status === ARCHIVED).map((s) => this.info(s))
  }
  async restoreSession(sessionId: string): Promise<SessionInfo> {
    this.d.db.updateSession(sessionId, { status: 'idle' })
    return this.info(this.row(sessionId))
  }
  async listModels(provider: ProviderId): Promise<ModelInfo[]> { return this.d.adapters[provider].listModels() }
  async providerModes(provider: ProviderId): Promise<PermissionMode[]> { return this.d.adapters[provider].permissionModes.filter((m) => m !== 'auto' || getSettings().autoMode) }
  async getEvents(sessionId: string): Promise<AgentEvent[]> { return this.d.db.listEvents(sessionId) }
  async getLimits(provider: ProviderId): Promise<LimitWindow[]> { return this.d.adapters[provider].getLimits() }

  async createSession(input: NewSessionInput): Promise<SessionInfo> {
    const project = this.d.db.listProjects().find((p) => p.id === input.projectId)
    if (!project) throw new Error(`unknown project ${input.projectId}`)
    if (input.accountId) this.accounts.get(input.accountId, input.provider)
    const id = randomUUID()
    const src = input.shareWorktreeOf ? this.row(input.shareWorktreeOf) : undefined
    const cfg = input.useWorktree && !src ? await git.readAgentdeckConfig(project.path) : {}
    if (cfg.setup && this.d.confirmSetup && !(await this.d.confirmSetup(project.path, cfg.setup))) throw new Error('Setup script not approved')
    let worktreePath: string | null = src?.worktreePath ?? null
    let branch: string | null = src?.branch ?? null
    if (input.useWorktree && !src) {
      const wt = await git.addWorktree(project.path, [await branchPrefix(), id.slice(0, 8)].filter(Boolean).join('/'), join(this.worktreesRoot(), project.name), input.baseRef ? await git.resolveBase(project.path, input.baseRef) : getSettings().repoGit[project.id]?.baseBranch || undefined)
      worktreePath = wt.path
      branch = wt.branch
      try {
        const setup = await git.setupWorktree(project.path, wt.path, cfg, { ...userEnv(project.id), AGENTDECK_PORT: String(sessionPort(id)) })
        this.setupLog.set(id, { output: setup.output, copied: setup.copied ?? 0 })
        if (setup.exitCode !== 0) throw new Error(`agentdeck.json setup failed (exit ${setup.exitCode}): ${setup.output}`)
      } catch (e) {
        await git.removeWorktree(project.path, wt.path, wt.branch).catch(() => {}) // don't leave a half-set-up worktree behind
        throw e
      }
    }
    const row: Session = {
      id, projectId: project.id, provider: input.provider, accountId: input.accountId ?? null, model: input.model ?? null,
      permissionMode: input.permissionMode, worktreePath, branch, status: 'idle', resumeToken: null, createdAt: Date.now(), title: input.title?.trim() || this.nextCity(),
      avatar: input.avatar ? JSON.stringify(input.avatar) : null, groupId: input.groupId ?? null,
    }
    this.d.db.createSession(row)
    await this.start(row)
    if (input.firstMessage) await this.sendMessage(id, input.firstMessage)
    return this.info(this.row(id))
  }

  /** Default name for a new session: a city no live session uses; prefers one never used before. */
  private nextCity(): string {
    const taken = this.d.db.listProjects().flatMap((p) => this.d.db.listSessions(p.id)).filter((s) => s.status !== ARCHIVED).map((s) => s.title ?? '')
    const visited = getSettings().citiesVisited
    const city = pickCity(taken, visited)
    const base = city.replace(/ \d+$/, '')
    if (!visited.includes(base)) setSettings({ citiesVisited: [...visited, base] })
    return city
  }

  async sendMessage(sessionId: string, text: string, images?: ImageAttachment[]): Promise<void> {
    const row = this.row(sessionId)
    const cap = getSettings().maxParallel
    if (cap > 0 && this.running(sessionId) >= cap) throw new Error(`Parallel limit reached (${cap}). Wait for a running session to finish, or raise the limit in Settings.`)
    if (!this.active.has(sessionId)) await this.start(row) // lazy resume after app restart
    if (!this.d.db.listEvents(sessionId).some((e) => e.type === 'message' && e.role === 'user')) {
      // First prompt names the session, unless the user already renamed it (anything but the default city).
      if (row.title === null || CITY_SET.has(row.title.replace(/ \d+$/, ''))) this.d.db.updateSession(sessionId, { title: truncate(text) })
      this.titles.set(sessionId, truncate(text))
      await this.autoRenameBranch(row, text)
      this.d.emit.session(this.info(this.row(sessionId)))
    }
    // shortcut: a failed snapshot is only logged (the event model has no notice type); add a UI notice if rewinds go missing.
    await git.createCheckpoint(this.cwd(row), sessionId, text).catch((e) => console.error('checkpoint failed:', e))
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

  async archiveSession(sessionId: string, removeWorktreeArg: boolean): Promise<void> {
    const row = this.row(sessionId)
    const shared = !!row.worktreePath && this.d.db.listSessions(row.projectId).some((s) => s.id !== sessionId && s.status !== ARCHIVED && s.worktreePath === row.worktreePath)
    const removeWorktree = !shared && (removeWorktreeArg || getSettings().deleteBranchOnArchive) // deleting the branch needs the worktree gone first; another live session may still use it
    if (this.active.delete(sessionId)) await this.d.adapters[row.provider].close(sessionId)
    this.d.pty?.close(sessionId)
    if (row.worktreePath && !shared) {
      const project = this.d.db.listProjects().find((p) => p.id === row.projectId)
      const archive = project && (await git.readAgentdeckConfig(project.path)).archive
      if (archive) {
        const r = await git.runScript(archive, row.worktreePath, { ...userEnv(row.projectId), AGENTDECK_PORT: String(sessionPort(sessionId)) })
        if (r.exitCode !== 0) throw new Error(`Archive script failed (exit ${r.exitCode}): ${r.output}`)
      }
    }
    if (removeWorktree && row.worktreePath) {
      const project = this.d.db.listProjects().find((p) => p.id === row.projectId)
      if (project) await git.removeWorktree(project.path, row.worktreePath, getSettings().deleteBranchOnArchive ? row.branch ?? undefined : undefined)
    }
    this.d.db.updateSession(sessionId, { status: ARCHIVED, ...(removeWorktree ? { worktreePath: null } : {}) })
  }

  private cwd(row: Session): string {
    const cwd = row.worktreePath ?? this.d.db.listProjects().find((p) => p.id === row.projectId)?.path
    if (!cwd) throw new Error(`no working directory for session ${row.id}`)
    return cwd
  }

  async sessionDiff(sessionId: string, scope: 'uncommitted' | 'branch'): Promise<git.DiffResult> {
    const row = this.row(sessionId)
    return git.diff(this.cwd(row), scope === 'uncommitted' ? 'uncommitted' : { base: await git.currentBranch(this.projects.get(row.projectId).path) })
  }
  async commitSession(sessionId: string, message: string): Promise<void> {
    if (!message.trim()) throw new Error('Commit message is empty')
    await git.commitAll(this.cwd(this.row(sessionId)), message)
  }
  async searchSessions(query: string): Promise<{ sessionId: string; text: string }[]> {
    return query.trim() ? this.d.db.searchMessages(query.trim()) : []
  }
  async listHistory(projectId: string): Promise<history.HistoryItem[]> { return history.listHistory(this.projects.get(projectId).path) }
  async listMcp(projectId: string): Promise<history.McpServer[]> { return history.listMcp(this.projects.get(projectId).path) }
  async importHistory(projectId: string, provider: 'claude' | 'codex', token: string): Promise<SessionInfo> {
    const events = await history.readHistory(this.projects.get(projectId).path, provider, token)
    const row: Session = {
      id: randomUUID(), projectId, provider, accountId: null, model: null, permissionMode: 'supervised',
      worktreePath: null, branch: null, status: 'idle', resumeToken: token, createdAt: Date.now(), title: null,
    }
    this.d.db.createSession(row)
    events.forEach((e) => this.d.db.appendEvent(row.id, e))
    return this.info(row)
  }
  async getProjectConfig(projectId: string): Promise<git.AgentdeckConfig> { return git.readAgentdeckConfig(this.projects.get(projectId).path) }
  async setProjectConfig(projectId: string, cfg: git.AgentdeckConfig): Promise<void> { await git.writeAgentdeckConfig(this.projects.get(projectId).path, cfg) }
  async listFiles(sessionId: string): Promise<string[]> { return git.listFiles(this.cwd(this.row(sessionId))) }
  async listCheckpoints(sessionId: string): Promise<git.Checkpoint[]> { return git.listCheckpoints(this.cwd(this.row(sessionId)), sessionId) }
  async checkTool(id: ProviderId | 'gh'): Promise<boolean> { return checkTool(id) }
  agentInfo(id: ProviderId): ReturnType<typeof agentInfo> { return agentInfo(id) }
  async rewindPreview(sessionId: string, checkpointId: string): Promise<string[]> { return git.rewindPreview(this.cwd(this.row(sessionId)), sessionId, checkpointId) }
  async rewindSession(sessionId: string, checkpointId: string): Promise<void> {
    const row = this.row(sessionId)
    if (row.status === 'working') throw new Error('Stop the session before rewinding')
    await git.restoreCheckpoint(this.cwd(row), sessionId, checkpointId)
  }
  async pushSession(sessionId: string): Promise<string> {
    const row = this.row(sessionId)
    return git.push(this.cwd(row), getSettings().repoGit[row.projectId]?.remote || undefined, getSettings().repoPrefs[row.projectId]?.setUpstream ?? true)
  }
  async listRefs(projectId: string): Promise<{ branches: string[]; remotes: string[] }> { return git.listRefs(this.projects.get(projectId).path) }
  async removeProject(projectId: string): Promise<void> { this.projects.remove(projectId) }
  private setupLog = new Map<string, { output: string; copied: number }>()
  async listArtifacts(sessionId: string): Promise<string[]> { return git.listArtifacts(this.cwd(this.row(sessionId))) }
  async setupOutput(sessionId: string): Promise<{ output: string; copied: number }> { return this.setupLog.get(sessionId) ?? { output: '', copied: 0 } }
  async projectRemoteUrl(projectId: string): Promise<string | null> { return git.remoteUrl(this.projects.get(projectId).path) }
  async prStatus(sessionId: string): Promise<git.PrStatus | null> {
    const row = this.row(sessionId)
    await this.syncBranch(row)
    const pr = await git.prStatus(this.cwd(row))
    const s = getSettings()
    if (pr?.state === 'MERGED' && row.status !== ARCHIVED && (s.archiveOnMerge || s.repoPrefs[row.projectId]?.archiveOnMerge)) {
      await this.archiveSession(sessionId, false)
      this.d.emit.session(this.info(this.row(sessionId)))
    }
    return pr
  }
  async mergePr(sessionId: string, auto: boolean): Promise<string> {
    if (auto && !getSettings().automerge) throw new Error('Automerge is turned off in Settings > Git')
    return git.mergePr(this.cwd(this.row(sessionId)), auto)
  }
  /** Settings > Git "Automatically rename new branches": the first prompt names the worktree branch (prefix kept). */
  private async autoRenameBranch(row: Session, text: string): Promise<void> {
    const slug = git.branchSlug(text)
    if (!getSettings().autoRenameBranches || !row.worktreePath || !row.branch || !slug) return
    const name = [...row.branch.split('/').slice(0, -1), slug].join('/')
    try { await git.renameBranch(row.worktreePath, name); this.d.db.updateSession(row.id, { branch: name }) } catch { /* name taken: keep the id branch */ }
  }
  /** Picks up a branch the agent renamed; "Rename session when branch is named" then retitles the session after it. */
  private async syncBranch(row: Session): Promise<void> {
    if (!row.worktreePath || !row.branch) return
    const now = await git.currentBranch(row.worktreePath).catch(() => row.branch as string)
    if (now === row.branch || now === 'HEAD') return
    this.d.db.updateSession(row.id, { branch: now, ...(getSettings().renameSessionOnBranch ? { title: now.split('/').pop() } : {}) })
    this.d.emit.session(this.info(this.row(row.id)))
  }
  async createPr(sessionId: string, title: string, body: string): Promise<string> {
    if (!title.trim()) throw new Error('PR title is empty')
    return git.createPr(this.cwd(this.row(sessionId)), title, body)
  }


  async listAccounts(): Promise<AccountInfo[]> { return this.accounts.list() }
  async addAccount(provider: ProviderId, label: string): Promise<AccountInfo> { return this.accounts.add(provider, label) }
  async accountLogin(accountId: string): Promise<string> { return this.accounts.login(accountId) }
  async moveSession(sessionId: string, accountId: string | null): Promise<SessionInfo> {
    const row = this.row(sessionId)
    const to = accountId ? this.accounts.get(accountId, row.provider) : null
    if (row.status === 'working') throw new Error('Stop the session before moving it')
    const from = this.accounts.configDir(row) ?? defaultConfigDir(row.provider)
    const dest = to?.configDir ?? defaultConfigDir(row.provider)
    if (this.active.delete(sessionId)) await this.d.adapters[row.provider].close(sessionId)
    if (row.resumeToken && from !== dest && !(await copyTranscript(row.resumeToken, from, dest)))
      this.d.db.updateSession(sessionId, { resumeToken: null }) // transcript not found: start fresh rather than fail to resume
    this.d.db.updateSession(sessionId, { accountId })
    const next = this.row(sessionId)
    this.d.emit.session(this.info(next))
    return this.info(next)
  }
  async removeAccount(accountId: string): Promise<void> { await this.accounts.remove(accountId) }
  /** Change model and/or permission mode; the adapter restarts (resuming the chat) on the next send. */
  async configureSession(sessionId: string, opts: { model?: string | null; effort?: string | null; permissionMode?: PermissionMode }): Promise<SessionInfo> {
    const row = this.row(sessionId)
    if (row.status === 'working') throw new Error('Stop the turn before changing settings')
    const { permissionMode } = opts
    if (permissionMode && !this.d.adapters[row.provider].permissionModes.includes(permissionMode)) throw new Error(`${row.provider} has no ${permissionMode} mode`)
    if (this.active.delete(sessionId)) await this.d.adapters[row.provider].close(sessionId)
    this.d.db.updateSession(sessionId, { ...(opts.model !== undefined ? { model: opts.model, ...(opts.effort === undefined ? { effort: null } : {}) } : {}), ...(opts.effort !== undefined ? { effort: opts.effort } : {}), ...(permissionMode ? { permissionMode } : {}) })
    const next = this.info(this.row(sessionId))
    this.d.emit.session(next)
    return next
  }
  async branchStatus(sessionId: string) { return git.branchStatus(this.cwd(this.row(sessionId))) }
  resolveFile(sessionId: string, relPath: string): string { return resolveInside(this.cwd(this.row(sessionId)), relPath) }
  async revertFile(sessionId: string, relPath: string): Promise<void> {
    const row = this.row(sessionId)
    if (row.status === 'working') throw new Error('Stop the turn before reverting files')
    const full = this.resolveFile(sessionId, relPath)
    const cwd = this.cwd(row)
    await git.revertFile(cwd, relative(resolve(cwd), full), full)
  }
  async revertHunk(sessionId: string, relPath: string, index: number): Promise<void> {
    const row = this.row(sessionId)
    if (row.status === 'working') throw new Error('Stop the turn before reverting changes')
    const full = this.resolveFile(sessionId, relPath)
    const cwd = this.cwd(row)
    await git.revertHunk(cwd, relative(resolve(cwd), full), index)
  }
  async exportSession(sessionId: string): Promise<string | null> {
    if (!this.d.saveText) throw new Error('export unavailable')
    const row = this.row(sessionId)
    const title = this.info(row).title
    return this.d.saveText(`${title.replace(/[^\w .-]+/g, '_')}.md`, transcriptMarkdown(title, this.d.db.listEvents(sessionId)))
  }
  async sessionUsage(sessionId: string) { return this.d.db.getUsage(sessionId) }
  async usageSummary() { return this.d.db.listUsage() }

  async termOpen(sessionId: string): Promise<string> {
    if (!this.d.pty) throw new Error('terminal unavailable')
    if (sessionId.startsWith('login-')) return this.d.pty.open(sessionId, '') // already started by accountLogin
    return this.d.pty.open(sessionId, this.cwd(this.row(sessionId)), { ...userEnv(this.row(sessionId).projectId), AGENTDECK_PORT: String(sessionPort(sessionId)) })
  }
  async termWrite(sessionId: string, data: string): Promise<void> { this.d.pty?.write(sessionId, data) }
  async termResize(sessionId: string, cols: number, rows: number): Promise<void> { this.d.pty?.resize(sessionId, cols, rows) }

  private async start(row: Session): Promise<void> {
    const cwd = this.cwd(row)
    this.active.add(row.id)
    try {
      await this.d.adapters[row.provider].start(
        { sessionId: row.id, cwd, model: row.model ?? undefined, effort: row.effort ?? undefined, permissionMode: row.provider === 'claude' && getSettings().claudeToolApprovals && row.permissionMode !== 'plan' ? 'supervised' : row.permissionMode, resumeToken: row.resumeToken ?? undefined, configDir: this.accounts.configDir(row), env: userEnv(row.projectId) },
        (e) => this.onAdapterEvent(row.id, e),
      )
    } catch (e) {
      this.active.delete(row.id)
      throw e
    }
  }

  private record(sessionId: string, e: AgentEvent): void {
    this.d.db.appendEvent(sessionId, e)
    this.d.emit.event(sessionId, { ...e, ts: Date.now() })
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
      id: s.id, projectId: s.projectId, provider: s.provider, model: s.model ?? undefined, effort: s.effort ?? undefined, groupId: s.groupId ?? undefined, permissionMode: s.permissionMode,
      accountId: s.accountId ?? undefined, worktreePath: s.worktreePath ?? undefined, branch: s.branch ?? undefined, status: s.status, title, createdAt: s.createdAt, lastActiveAt: this.d.db.lastEventTs(s.id) ?? s.createdAt,
      avatar: s.avatar ? (JSON.parse(s.avatar) as AvatarChoice) : undefined,
    }
  }
}

