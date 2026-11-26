import { Check, Loader2, X } from 'lucide-react'
import type { SessionStatus } from '../../../shared/types'
import { cn } from '../lib/utils'
import { Badge } from './ui/badge'

const LABEL: Record<SessionStatus, string> = { idle: 'Idle', working: 'Working', 'needs-you': 'Needs you', done: 'Done', error: 'Error' }
const TONE: Record<SessionStatus, 'neutral' | 'primary' | 'ok' | 'warn' | 'danger'> = { idle: 'neutral', working: 'primary', 'needs-you': 'warn', done: 'neutral', error: 'danger' }

/** Shape + colour per state; never a checkbox-like circle. `size` is a Tailwind size class. */
export function StatusDot({ status, size = 'size-3.5' }: { status: SessionStatus; size?: string }): React.JSX.Element {
  const label = LABEL[status]
  const box = cn('flex shrink-0 items-center justify-center', size)
  if (status === 'needs-you') return <span className={box} role="img" aria-label={label}><span className="size-2 rounded-full bg-warn ring-2 ring-warn/30" /></span>
  if (status === 'working') return <Loader2 className={cn('shrink-0 animate-spin text-foreground', size)} role="img" aria-label={label} />
  if (status === 'done') return <Check className={cn('shrink-0 text-faint', size)} role="img" aria-label={label} />
  if (status === 'error') return <X className={cn('shrink-0 text-destructive', size)} role="img" aria-label={label} />
  return <span className={box} role="img" aria-label={label}><span className="h-px w-2 bg-faint" /></span>
}

export default function StatusBadge({ status }: { status: SessionStatus }): React.JSX.Element {
  return <Badge tone={TONE[status]} className="gap-1.5"><StatusDot status={status} />{LABEL[status]}</Badge>
}
