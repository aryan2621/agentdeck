// Typed bridge between renderer and main. Main implements it, preload exposes it as window.api.
import type { Checkpoint, DiffResult } from '../main/git'
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
  permissionMode: PermissionMode
  accountId?: string
  worktreePath?: string
  branch?: string
  status: SessionStatus
  title: string
  createdAt: number
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
}
export interface AccountInfo { id: string; provider: ProviderId; label: string }
export interface ModelInfo { id: string; label: string }

export interface AgentDeckApi {
  /** Opens the folder picker, or adds `path` directly (drag and drop). */
  addProject(path?: string): Promise<ProjectInfo | null>
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
  rewindSession(sessionId: string, checkpointId: string): Promise<void>
  pushSession(sessionId: string): Promise<string>
  /** Returns the PR URL. */
  createPr(sessionId: string, title: string, body: string): Promise<string>
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
  configureSession(sessionId: string, opts: { model?: string | null; permissionMode?: PermissionMode }): Promise<SessionInfo>
  branchStatus(sessionId: string): Promise<{ dirty: boolean; ahead: number | null }>
  /** Opens a file of the session's folder in the OS default app. */
  openFile(sessionId: string, relPath: string): Promise<void>
  /** Discards the file's uncommitted changes (restores from HEAD, or deletes a new file). Refused while working. */
  revertFile(sessionId: string, relPath: string): Promise<void>
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
}

declare global {
  interface Window { api: AgentDeckApi }
}
