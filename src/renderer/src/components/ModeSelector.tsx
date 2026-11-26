import type { PermissionMode } from '../../../shared/types'
import { MODE_HINT, MODE_LABEL } from '../lib/modes'
import { cn } from '../lib/utils'
import { Select } from './ui/select'

/** Mode picker with a per-mode hint; Full access is styled as the risky choice. */
export function ModeSelector({ value, modes, onChange }: { value: PermissionMode; modes: PermissionMode[]; onChange: (m: PermissionMode) => void }): React.JSX.Element {
  const risky = value === 'full-access'
  return (
    <>
      <Select label="Permission mode" className={cn('w-full', risky && 'border-destructive/50 text-destructive')} value={value} onChange={(v) => onChange(v as PermissionMode)} options={modes.map((m) => ({ value: m, label: MODE_LABEL[m] ?? m }))} />
      <p className={cn('mt-1 text-small', risky ? 'text-destructive' : 'text-muted-foreground')}>{MODE_HINT[value]}</p>
    </>
  )
}
