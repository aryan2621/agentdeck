/** Every keyboard shortcut in one place: the palette hints and the Settings list read from here. */
export interface Shortcut { id: string; keys: string; label: string }

export const SHORTCUTS: Shortcut[] = [
  { id: 'palette', keys: '⌘K', label: 'Command palette' },
  { id: 'new', keys: '⌘N', label: 'New session' },
  { id: 'next', keys: '⌘J', label: 'Jump to next session that needs you' },
  { id: 'jump', keys: '⌘1–9', label: 'Switch to session by position' },
  { id: 'sidebar', keys: '⌘B', label: 'Collapse or expand the sidebar' },
  { id: 'search', keys: '⌘F', label: 'Search sessions' },
  { id: 'panel', keys: '⌘\\', label: 'Show or hide the changes panel' },
  { id: 'approve', keys: 'Y', label: 'Approve (when asked)' },
  { id: 'always', keys: 'A', label: 'Always allow (when asked)' },
  { id: 'deny', keys: 'N', label: 'Deny (when asked)' },
  { id: 'close', keys: 'Esc', label: 'Close dialog or palette' },
]

export const keysOf = (id: string): string | undefined => SHORTCUTS.find((s) => s.id === id)?.keys

/** Window event the palette fires for the open session: SessionView listens. */
export const SESSION_EVENT = 'agentdeck:session'
export type SessionCommand = 'rename' | 'archive' | 'rewind' | 'panel'
export const sessionCommand = (c: SessionCommand): void => { window.dispatchEvent(new CustomEvent<SessionCommand>(SESSION_EVENT, { detail: c })) }

/** Sidebar listens: expands the rail if needed and focuses the search box. */
export const FOCUS_SEARCH = 'agentdeck:search'
