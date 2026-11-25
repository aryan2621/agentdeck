// Contract shared by main, preload and renderer. Providers emit only these events.

/** Agents reached through the generic ACP adapter; adding one is one line. */
export const ACP_AGENTS = {
  opencode: { label: 'OpenCode', command: 'opencode', args: ['acp'] },
  gemini: { label: 'Gemini CLI', command: 'gemini', args: ['--experimental-acp'] },
} as const
export type AcpAgent = { label: string; command: string; args: readonly string[] }

export type ProviderId = 'claude' | 'codex' | keyof typeof ACP_AGENTS
/** Providers with their own config dir, login and multiple accounts. */
export type AccountProvider = 'claude' | 'codex'
export const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  ...(Object.entries(ACP_AGENTS) as [keyof typeof ACP_AGENTS, AcpAgent][]).map(([id, a]) => ({ id, label: a.label })),
]
export const hasAccounts = (p: ProviderId): p is AccountProvider => p === 'claude' || p === 'codex'
export type PermissionMode = 'supervised' | 'auto-edit' | 'full-access' | 'plan' // plan: read-only, the agent proposes before acting (Claude only)
export type SessionStatus = 'idle' | 'working' | 'needs-you' | 'done' | 'error'

/** base64 image sent with a user message. shortcut: stored inline in the event log; move to files if the DB grows too big. */
export interface ImageAttachment { mimeType: string; data: string }

export type AgentEvent =
  | { type: 'message'; role: 'user' | 'assistant'; text: string; partial?: boolean; images?: ImageAttachment[] }
  | { type: 'tool_call'; id: string; name: string; input: unknown; output?: string }
  | { type: 'file_change'; path: string; diff?: string }
  | { type: 'approval_request'; id: string; kind: 'command' | 'edit' | 'other'; summary: string; detail?: unknown }
  | { type: 'approval_decision'; id: string; allow: boolean }
  | { type: 'usage'; inputTokens?: number; outputTokens?: number; costUsd?: number; limits?: LimitWindow[] }
  | { type: 'status'; status: SessionStatus; error?: string }

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
}
export const DEFAULT_SETTINGS: Settings = {
  defaultProvider: 'claude',
  defaultMode: 'supervised',
  notify: { done: true, 'needs-you': true, error: true },
  cliPaths: {},
  defaultModels: {},
}
