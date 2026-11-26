// Contract shared by main, preload and renderer. Providers emit only these events.

export type ProviderId = 'claude' | 'codex'
/** Providers with their own config dir, login and multiple accounts. */
export type AccountProvider = 'claude' | 'codex'
export const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
]
export const hasAccounts = (p: ProviderId): p is AccountProvider => p === 'claude' || p === 'codex'
export type PermissionMode = 'supervised' | 'auto-edit' | 'full-access' | 'plan' // plan: read-only, the agent proposes before acting (Claude only)
export type SessionStatus = 'idle' | 'working' | 'needs-you' | 'done' | 'error'

/** base64 image sent with a user message. shortcut: stored inline in the event log; move to files if the DB grows too big. */
export interface ImageAttachment { mimeType: string; data: string }

export type AgentEvent = (
  | { type: 'message'; role: 'user' | 'assistant'; text: string; partial?: boolean; images?: ImageAttachment[] }
  | { type: 'tool_call'; id: string; name: string; input: unknown; output?: string }
  | { type: 'file_change'; path: string; diff?: string }
  | { type: 'approval_request'; id: string; kind: 'command' | 'edit' | 'other'; summary: string; detail?: unknown }
  | { type: 'approval_decision'; id: string; allow: boolean }
  | { type: 'usage'; inputTokens?: number; outputTokens?: number; costUsd?: number; limits?: LimitWindow[] }
  | { type: 'status'; status: SessionStatus; error?: string }
) & { ts?: number }

// remainingPercent is 0-100; resetsAt is epoch seconds. Windows are null/absent for API-key logins.
export interface LimitWindow {
  name: string
  remainingPercent: number
  resetsAt?: number
}

export interface StartOptions {
  sessionId: string // our id, not the provider's
  cwd: string
  model?: string
  permissionMode: PermissionMode
  configDir?: string // CLAUDE_CONFIG_DIR / CODEX_HOME for the chosen account
  resumeToken?: string // provider-native session id from an earlier run
}

/** `always`: stop asking for this kind of action for the rest of the session. */
export type ApprovalDecision = { allow: boolean; reason?: string; always?: boolean }

export interface ProviderAdapter {
  readonly id: ProviderId
  /** Permission modes this provider supports; UI shows only these. */
  readonly permissionModes: readonly PermissionMode[]
  listModels(configDir?: string): Promise<{ id: string; label: string }[]>
  /** Opens a session; events stream until close(). resumeToken in events of type 'status' is not used, call getResumeToken(). */
  start(opts: StartOptions, onEvent: (e: AgentEvent) => void): Promise<void>
  send(sessionId: string, text: string, images?: ImageAttachment[]): Promise<void>
  interrupt(sessionId: string): Promise<void>
  respondToApproval(sessionId: string, approvalId: string, decision: ApprovalDecision): Promise<void>
  getResumeToken(sessionId: string): string | undefined
  getLimits(configDir?: string): Promise<LimitWindow[]>
  close(sessionId: string): Promise<void>
}

export type NotifyKind = 'done' | 'needs-you' | 'error'
export interface Settings {
  defaultProvider: ProviderId
  defaultMode: PermissionMode
  notify: Record<NotifyKind, boolean>
  /** Absolute path to each agent CLI; empty = look it up on PATH. */
  cliPaths: Partial<Record<ProviderId, string>>
  /** Preselected model id per provider; empty = first listed. */
  defaultModels: Partial<Record<ProviderId, string>>
  theme: 'system' | 'light' | 'dark'
  /** Most sessions allowed to run a turn at once; 0 = unlimited. */
  maxParallel: number
  /** Approved agentdeck.json setup scripts: project path -> sha256 of the script. Main-only; never settable from the renderer. */
  trustedSetups: Record<string, string>
}
export const DEFAULT_SETTINGS: Settings = {
  defaultProvider: 'claude',
  defaultMode: 'supervised',
  notify: { done: true, 'needs-you': true, error: true },
  cliPaths: {},
  defaultModels: {},
  theme: 'system',
  maxParallel: 0,
  trustedSetups: {},
}
