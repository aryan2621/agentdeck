// Typed bridge between renderer and main. Main implements it, preload exposes it as window.api.
import type { Checkpoint, DiffResult } from '../main/git'
import type { UsageRow } from '../main/db'
import type { HistoryItem, McpServer } from '../main/history'
import type { AgentEvent, ApprovalDecision, ImageAttachment, LimitWindow, PermissionMode, ProviderId, SessionStatus, Settings } from './types'

export interface ProjectInfo { id: string; path: string; name: string }
/** Picked look of a session's avatar: indexes into COLORS and SHAPES (Avatar.tsx). */
export interface AvatarChoice { color: number; shape: number }
export interface SessionInfo {
  id: string
  avatar?: AvatarChoice
  projectId: string
  provider: ProviderId
  model?: string
  /** Reasoning effort; unset = provider default. */
  effort?: string
  /** Sessions created from one prompt share this id (run group); unset = standalone. */
  groupId?: string
  permissionMode: PermissionMode
  accountId?: string
  worktreePath?: string
  branch?: string
  status: SessionStatus
  title: string
  createdAt: number
  /** Newest event time (falls back to createdAt): the Home list's "Last active". */
  lastActiveAt: number
}
export interface NewSessionInput {
  avatar?: AvatarChoice
  title?: string
  projectId: string
  provider: ProviderId
  model?: string
  permissionMode: PermissionMode
  useWorktree: boolean
  accountId?: string
  firstMessage?: string
  /** Start the worktree from this branch, or from a PR when it is a number. */
  baseRef?: string
  /** Joins the run group with this id (see SessionInfo.groupId). */
  groupId?: string
  /** Run in this session's worktree instead of creating one (switch agent). */
  shareWorktreeOf?: string
}
export interface AccountInfo { id: string; provider: ProviderId; label: string }
/** `efforts`: reasoning levels the model accepts; absent = no effort control. */
export interface ModelInfo { id: string; label: string; efforts?: string[] }

/** Suffix of the addProject error for a folder without git; the renderer offers to initialise it. */
export const NOT_GIT = 'is not a git repository'

export interface ProjectConfig { copy?: string[]; setup?: string; archive?: string; actions?: { name: string; command: string }[] }

export interface AgentDeckApi {
  /** Opens the folder picker, or adds `path` directly (drag and drop). */
  addProject(path?: string): Promise<ProjectInfo | null>
  getProjectConfig(projectId: string): Promise<ProjectConfig>
  setProjectConfig(projectId: string, cfg: ProjectConfig): Promise<void>
  /** Folder picker only; returns the chosen path. */
  pickDirectory(): Promise<string | null>
  /** Folder holding every project's session worktrees (one subfolder per project). */
  getWorktreesRoot(): Promise<string>
  listRefs(projectId: string): Promise<{ branches: string[]; remotes: string[] }>
  removeProject(projectId: string): Promise<void>
  /** Makes `parent/name`, git-inits it (optionally with a GitHub repo), and adds it. */
  createProject(name: string, parent: string, github?: 'private' | 'public', repo?: string): Promise<ProjectInfo | null>
  /** Logged-in GitHub user and orgs (gh). */
  githubOwners(): Promise<string[]>
  /** True when `owner/name` is free on GitHub. */
  githubRepoAvailable(slug: string): Promise<boolean>
  /** `gh repo clone` of a URL or owner/name into `parent`, then adds it. */
  cloneProject(repo: string, parent: string): Promise<ProjectInfo | null>
  /** Runs `git init` + first commit on a plain folder (and optionally creates and pushes a GitHub repo), then adds it. */
  initProject(path: string, github?: 'private' | 'public'): Promise<ProjectInfo | null>
  /** Filesystem path of a dropped File. */
  pathForFile(f: File): string
  listProjects(): Promise<ProjectInfo[]>
  listSessions(projectId: string): Promise<SessionInfo[]>
  listModels(provider: ProviderId): Promise<ModelInfo[]>
  providerModes(provider: ProviderId): Promise<PermissionMode[]>
  createSession(input: NewSessionInput): Promise<SessionInfo>
  /** Full stored event log, oldest first, to rebuild the chat view. */
  getEvents(sessionId: string): Promise<AgentEvent[]>
  sendMessage(sessionId: string, text: string, images?: ImageAttachment[]): Promise<void>
  interrupt(sessionId: string): Promise<void>
  respondToApproval(sessionId: string, approvalId: string, decision: ApprovalDecision): Promise<void>
  archiveSession(sessionId: string, removeWorktree: boolean): Promise<void>
  listArchived(): Promise<SessionInfo[]>
  /** Un-archives a session so it shows in its project again. */
  restoreSession(sessionId: string): Promise<SessionInfo>
  renameSession(sessionId: string, title: string): Promise<SessionInfo>
  getLimits(provider: ProviderId): Promise<LimitWindow[]>
  /** 'branch' diffs against the project's checked-out branch; 'uncommitted' against HEAD. */
  sessionDiff(sessionId: string, scope: 'uncommitted' | 'branch'): Promise<DiffResult>
  commitSession(sessionId: string, message: string): Promise<void>
  /** Messages across all sessions containing the text. */
  searchSessions(query: string): Promise<{ sessionId: string; text: string }[]>
  /** Sessions from ~/.claude and ~/.codex that ran in this project's folder. */
  listHistory(projectId: string): Promise<HistoryItem[]>
  /** Creates a session with the old chat filled in, resumable from the provider's own session id. */
  importHistory(projectId: string, provider: 'claude' | 'codex', id: string): Promise<SessionInfo>
  /** Read-only: MCP servers the provider CLIs have configured. */
  listMcp(projectId: string): Promise<McpServer[]>
  listFiles(sessionId: string): Promise<string[]>
  /** One per prompt sent (the files as they were before it), plus 'Before rewind' snapshots. Oldest first. */
  listCheckpoints(sessionId: string): Promise<Checkpoint[]>
  /** Restores worktree files only; chat history and the agent's memory are unchanged. Refused while working. */
  rewindPreview(sessionId: string, checkpointId: string): Promise<string[]>
  checkTool(id: ProviderId | 'gh'): Promise<boolean>
  /** Version and login details of a provider CLI (Agents page). */
  agentInfo(id: ProviderId): Promise<{ label: string; value: string }[]>
  rewindSession(sessionId: string, checkpointId: string): Promise<void>
  pushSession(sessionId: string): Promise<string>
  /** Returns the PR URL. */
  createPr(sessionId: string, title: string, body: string): Promise<string>
  /** The branch's pull request with its checks, or null when none exists. */
  mergePr(sessionId: string, auto: boolean): Promise<string>
  prStatus(sessionId: string): Promise<{ number: number; url: string; state: string; checks: { name: string; state: 'pass' | 'fail' | 'pending' }[]; conflicts: boolean } | null>
  /** Files in the session worktree's `.context` folder. */
  listArtifacts(sessionId: string): Promise<string[]>
  /** Output of the agentdeck.json setup script from when this session was created (empty after an app restart). */
  setupOutput(sessionId: string): Promise<{ output: string; copied: number }>
  /** Browsable URL of the project's origin remote, or null. */
  projectRemoteUrl(projectId: string): Promise<string | null>
  getSettings(): Promise<Settings>
  setSettings(patch: Partial<Settings>): Promise<Settings>
  listAccounts(): Promise<AccountInfo[]>
  /** Creates an isolated config dir for a new login. Call accountLogin next. */
  addAccount(provider: ProviderId, label: string): Promise<AccountInfo>
  /** Opens a shell running the CLI's login under the account's config dir; resolves with the terminal key to attach. */
  accountLogin(accountId: string): Promise<string>
  /** Resumes the session under another account (null = the CLI's default login). */
  moveSession(sessionId: string, accountId: string | null): Promise<SessionInfo>
  /** Refused while any session uses the account. */
  removeAccount(accountId: string): Promise<void>
  /** Change model / mode of an idle session; takes effect on the next message. */
  configureSession(sessionId: string, opts: { model?: string | null; effort?: string | null; permissionMode?: PermissionMode }): Promise<SessionInfo>
  branchStatus(sessionId: string): Promise<{ dirty: boolean; ahead: number | null }>
  /** Opens a file of the session's folder in the OS default app. */
  openFile(sessionId: string, relPath: string, reveal?: boolean): Promise<void>
  gitIdentity(): Promise<{ name: string; email: string; login: string | null }>
  apiKeyStatus(provider: ProviderId): Promise<boolean>
  /** Empty key removes it. Stored encrypted in main; never readable back. */
  setApiKey(provider: ProviderId, key: string): Promise<void>
  openClaudeSettings(reveal: boolean): Promise<void>
  /** General settings: play a sound (name or path; omit = the saved one), add a sound file, saved extra sounds, disk-access status and shortcut. */
  playSound(sound?: string): Promise<void>
  addSound(): Promise<string | null>
  listSounds(): Promise<string[]>
  fullDiskAccess(): Promise<boolean>
  openDiskAccessSettings(): Promise<void>
  /** Discards the file's uncommitted changes (restores from HEAD, or deletes a new file). Refused while working. */
  revertFile(sessionId: string, relPath: string): Promise<void>
  revertHunk(sessionId: string, relPath: string, index: number): Promise<void>
  /** Saves the transcript as Markdown via a save dialog; null if cancelled. */
  exportSession(sessionId: string): Promise<string | null>
  usageSummary(): Promise<UsageRow[]>
  sessionUsage(sessionId: string): Promise<{ inputTokens: number; outputTokens: number; costUsd: number }>
  /** Starts (or reattaches to) the session's shell in its worktree; resolves with output so far. */
  termOpen(sessionId: string): Promise<string>
  termWrite(sessionId: string, data: string): Promise<void>
  termResize(sessionId: string, cols: number, rows: number): Promise<void>
  onTermData(cb: (sessionId: string, data: string) => void): () => void
  /** Live events for any session. Returns an unsubscribe function. */
  onEvent(cb: (sessionId: string, e: AgentEvent) => void): () => void
  /** Fires when the user clicks a notification for a session. */
  onSelectSession(cb: (sessionId: string) => void): () => void
  /** Fires when a session row changes (status, title, branch). */
  onSessionUpdated(cb: (s: SessionInfo) => void): () => void
  /** Fires as createProject starts each step. */
  onProjectProgress(cb: (step: string) => void): () => void
}

declare global {
  interface Window { api: AgentDeckApi }
}
