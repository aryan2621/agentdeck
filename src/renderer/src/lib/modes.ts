import type { PermissionMode } from '../../../shared/types'

export const MODES: PermissionMode[] = ['supervised', 'auto-edit', 'full-access', 'plan', 'auto']
export const MODE_LABEL: Record<PermissionMode, string> = { supervised: 'Ask before edits', 'auto-edit': 'Auto-edit', 'full-access': 'Full access', plan: 'Plan only', auto: 'Auto' }
export const MODE_HINT: Record<PermissionMode, string> = {
  supervised: 'Asks before every edit and command.',
  'auto-edit': 'Edits files without asking; still asks before commands.',
  'full-access': 'Runs anything without asking. Not a sandbox.',
  plan: 'Read-only. The agent proposes before acting.',
  auto: 'A classifier approves safe actions and blocks risky ones. Claude only.'
}
