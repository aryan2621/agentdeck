import type { PermissionMode } from '../../../shared/types'

export const MODES: PermissionMode[] = ['supervised', 'auto-edit', 'full-access', 'plan', 'auto']
export const MODE_LABEL: Record<PermissionMode, string> = { supervised: 'Ask before edits', 'auto-edit': 'Auto-edit', 'full-access': 'Full access', plan: 'Plan only', auto: 'Auto' }
