// Contract shared by main, preload and renderer. Providers emit only these events.

export type ProviderId = 'claude' | 'codex'
/** Providers with their own config dir, login and multiple accounts. */
export type AccountProvider = 'claude' | 'codex'
export const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
]
export const hasAccounts = (p: ProviderId): p is AccountProvider => p === 'claude' || p === 'codex'
export type PermissionMode = 'supervised' | 'auto-edit' | 'full-access' | 'plan' | 'auto' // auto: Claude's classifier approves safe actions (Experimental); plan: plan: read-only, the agent proposes before acting (Claude only)
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
  effort?: string // reasoning effort (Claude options.effort, Codex turn effort)
  permissionMode: PermissionMode
  env?: Record<string, string> // global + project environment vars (Settings > Environment)
  configDir?: string // CLAUDE_CONFIG_DIR / CODEX_HOME for the chosen account
  resumeToken?: string // provider-native session id from an earlier run
}

/** `always`: stop asking for this kind of action for the rest of the session. */
export type ApprovalDecision = { allow: boolean; reason?: string; always?: boolean }

export interface ProviderAdapter {
  readonly id: ProviderId
  /** Permission modes this provider supports; UI shows only these. */
  readonly permissionModes: readonly PermissionMode[]
  listModels(configDir?: string): Promise<{ id: string; label: string; efforts?: string[] }[]>
  /** Opens a session; events stream until close(). resumeToken in events of type 'status' is not used, call getResumeToken(). */
  start(opts: StartOptions, onEvent: (e: AgentEvent) => void): Promise<void>
  send(sessionId: string, text: string, images?: ImageAttachment[]): Promise<void>
  interrupt(sessionId: string): Promise<void>
  respondToApproval(sessionId: string, approvalId: string, decision: ApprovalDecision): Promise<void>
  getResumeToken(sessionId: string): string | undefined
  getLimits(configDir?: string): Promise<LimitWindow[]>
  close(sessionId: string): Promise<void>
}

/** One model in the user's loadout; slot 0 is the default for new sessions. */
export interface LoadoutSlot { provider: ProviderId; model: string }
export const LOADOUT_SLOTS = 5
export type NotifyKind = 'done' | 'needs-you' | 'error'
export interface Preview { name: string; url: string }
/** Per-repository preferences (General and Git pages), keyed by project id. */
export interface RepoPrefs {
  /** URLs that may contain $AGENTDECK_PORT; the first is the default. */
  previews: Preview[]
  plainLocalhost: boolean
  archiveOnMerge: boolean
  setUpstream: boolean
}
/** Per-repository Actions page: run mode and the custom instructions prepended to each agent prompt. */
export const INSTRUCTION_KEYS = [
  ['review', 'Code review'], ['createPr', 'Create PR'], ['fixErrors', 'Fix errors'], ['resolveConflicts', 'Resolve conflicts'], ['branchRename', 'Branch rename'], ['general', 'General']
] as const
export type InstructionKey = (typeof INSTRUCTION_KEYS)[number][0]
export interface RepoActions { runMode: 'concurrent' | 'nonconcurrent'; instructions: Partial<Record<InstructionKey, string>> }
export const DEFAULT_REPO_ACTIONS: RepoActions = { runMode: 'concurrent', instructions: {} }
export const DEFAULT_REPO_PREFS: RepoPrefs = { previews: [], plainLocalhost: false, archiveOnMerge: false, setUpstream: true }
/** Stable per-session dev-server port ($AGENTDECK_PORT), derived from the session id. */
export const sessionPort = (sessionId: string): number => 50000 + (parseInt(sessionId.replace(/-/g, '').slice(0, 6), 16) % 10000)
export const previewUrl = (url: string, sessionId: string): string => url.replaceAll('$AGENTDECK_PORT', String(sessionPort(sessionId)))
/** `KEY=value` lines -> env object; blank lines, comments and invalid names are skipped. */
export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line)
    if (m) out[m[1]] = m[2].trim().replace(/^(["'])(.*)\1$/, '$2')
  }
  return out
}
/** Mono font ids; the CSS stack for each lives in the renderer (lib/fonts.ts). */
export const MONO_FONTS = ['geist', 'sf', 'menlo', 'monaco', 'courier']
export interface Settings {
  defaultProvider: ProviderId
  defaultMode: PermissionMode
  notify: Record<NotifyKind, boolean>
  /** Absolute path to each agent CLI; empty = look it up on PATH. */
  cliPaths: Partial<Record<ProviderId, string>>
  /** Preselected model id per provider; empty = first listed. */
  defaultModels: Partial<Record<ProviderId, string>>
  /** Ordered models shown in Default models; empty = just the default provider + model. */
  loadout: LoadoutSlot[]
  /** Git: worktree branches are named `<prefix>/<id>`; empty = no prefix. */
  branchPrefix: string
  deleteBranchOnArchive: boolean
  /** Per repository (by project id): branch new worktrees start from ('' = current HEAD) and the remote to push to ('' = origin). */
  repoGit: Record<string, { baseBranch: string; remote: string }>
  repoPrefs: Record<string, RepoPrefs>
  repoActions: Record<string, RepoActions>
  /** Project ids hidden from the sidebar; restored from Settings. */
  hiddenProjects: string[]
  /** Where session worktrees are created; empty = the app's own folder. Absolute path. */
  worktreesDir: string
  theme: 'system' | 'light' | 'dark'
  /** Appearance: palette id (renderer lib/themes), and display options. */
  colorTheme: string
  lowContrast: boolean
  seasonal: boolean
  zoom: number
  sidebarDiffs: boolean
  accessibleColors: 'default' | 'colorblind'
  codeTheme: string
  /** Most sessions allowed to run a turn at once; 0 = unlimited. */
  maxParallel: number
  /** Git page (global): branch prefix source and workflow toggles. */
  branchPrefixMode: 'github' | 'custom' | 'none'
  autoRenameBranches: boolean
  renameSessionOnBranch: boolean
  archiveOnMerge: boolean
  automerge: boolean
  optionalChecksBlocking: boolean
  setUpstream: boolean
  ghStack: boolean
  /** Account page. */
  claudeToolApprovals: boolean
  codexApprovals: 'default' | 'untrusted' | 'never'
  /** Agents page. */
  claudeChrome: boolean
  /** Appearance: code and terminal typography. */
  monoFont: string
  codeLigatures: boolean
  markdownStyle: 'default' | 'serif' | 'compact'
  terminalFont: string
  terminalFontSize: number
  /** General page. sendKey: which key sends (the other inserts/queues); followUp: what Enter does while a turn runs. */
  sendKey: 'enter' | 'cmd-enter'
  followUp: 'steer' | 'queue'
  /** Master switch over the per-kind `notify` switches. */
  notifyAgents: boolean
  /** macOS system sound name, or absolute path of an added sound; '' = silent. */
  completionSound: string
  arrangeManually: boolean
  /** Session ids in the user's manual sidebar order (used when arrangeManually). */
  sessionOrder: string[]
  autoConvertLongText: boolean
  stripAbsolutelyRight: boolean
  caffeinate: boolean
  restartOnUpdate: boolean
  /** Experimental: ⌘⇧T opens a terminal tab in the centre pane; tray menu with usage and recent sessions. */
  bigTerminal: boolean
  menuBarTray: boolean
  /** Experimental: offer the Claude 'auto' permission mode. */
  autoMode: boolean
  /** Environment pages: `KEY=value` lines, global and per project id. Passed to terminals, setup scripts and (global only) agents. */
  env: string
  repoEnv: Record<string, string>
  /** Approved agentdeck.json setup scripts: project path -> sha256 of the script. Main-only; never settable from the renderer. */
  trustedSetups: Record<string, string>
  /** Distinct default city names ever given to a session (keeps new default names fresh). Main-only. */
  citiesVisited: string[]
}
export const DEFAULT_SETTINGS: Settings = {
  defaultProvider: 'claude',
  defaultMode: 'supervised',
  notify: { done: true, 'needs-you': true, error: true },
  cliPaths: {},
  defaultModels: {},
  loadout: [],
  branchPrefix: 'agentdeck',
  deleteBranchOnArchive: false,
  repoGit: {},
  repoPrefs: {},
  repoActions: {},
  hiddenProjects: [],
  worktreesDir: '',
  theme: 'system',
  colorTheme: 'default',
  lowContrast: false,
  seasonal: false,
  zoom: 100,
  sidebarDiffs: false,
  accessibleColors: 'default',
  codeTheme: 'default',
  maxParallel: 0,
  branchPrefixMode: 'github',
  autoRenameBranches: true,
  renameSessionOnBranch: true,
  archiveOnMerge: false,
  automerge: false,
  optionalChecksBlocking: false,
  setUpstream: true,
  ghStack: true,
  claudeToolApprovals: false,
  codexApprovals: 'default',
  claudeChrome: false,
  monoFont: 'geist',
  codeLigatures: true,
  markdownStyle: 'default',
  terminalFont: '',
  terminalFontSize: 12,
  sendKey: 'enter',
  followUp: 'steer',
  notifyAgents: true,
  completionSound: 'Glass',
  arrangeManually: false,
  sessionOrder: [],
  autoConvertLongText: true,
  stripAbsolutelyRight: false,
  caffeinate: false,
  restartOnUpdate: false,
  bigTerminal: false,
  autoMode: false,
  menuBarTray: false,
  env: '',
  repoEnv: {},
  trustedSetups: {},
  citiesVisited: [],
}
