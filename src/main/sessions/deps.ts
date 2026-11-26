import type { Db } from '../db'
import type { PtyManager } from '../pty'
import type { SessionInfo } from '../../shared/ipc'
import type { AgentEvent, ProviderAdapter, ProviderId, SessionStatus } from '../../shared/types'

interface Emitter {
  event(sessionId: string, e: AgentEvent): void
  session(s: SessionInfo): void
  /** Create-project step that just started: 'folder' | 'git' | 'github' | 'add'. */
  progress?(step: string): void
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
  /** Electron-only: ask before running a repo's agentdeck.json setup script. Absent (tests) = allowed. */
  confirmSetup?: (projectPath: string, script: string) => Promise<boolean>
  /** Electron-only: save dialog + write. Returns the saved path or null if cancelled. */
  saveText?: (suggestedName: string, text: string) => Promise<string | null>
  /** Optional so tests don't spawn shells. */
  pty?: PtyManager
}

// shortcut: no archived column in the DB schema, so archived is a status value hidden from lists; add a column if it needs to be queryable.
export const ARCHIVED = 'archived' as SessionStatus
