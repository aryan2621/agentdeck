import { Check, Loader2, X } from 'lucide-react'
import type { SessionStatus } from '../../../shared/types'
import { Badge } from './ui/badge'

const LABEL: Record<SessionStatus, string> = { idle: 'Idle', working: 'Working', 'needs-you': 'Needs you', done: 'Done', error: 'Error' }
const TONE: Record<SessionStatus, 'neutral' | 'primary' | 'ok' | 'warn' | 'danger'> = { idle: 'neutral', working: 'primary', 'needs-you': 'warn', done: 'neutral', error: 'danger' }

/** Shape + colour per state; never a checkbox-like circle. */
export function StatusDot({ status }: { status: SessionStatus }): React.JSX.Element {
  const label = LABEL[status]
  const box = 'flex size-3.5 shrink-0 items-center justify-center'
  if (status === 'needs-you') return <span className={box} role="img" aria-label={label}><span className="size-2 rounded-full bg-needs ring-2 ring-needs/30" /></span>
  if (status === 'working') return <Loader2 className="size-3.5 shrink-0 animate-spin text-foreground" role="img" aria-label={label} />
  if (status === 'done') return <Check className="size-3.5 shrink-0 text-faint" role="img" aria-label={label} />
  if (status === 'error') return <X className="size-3.5 shrink-0 text-destructive" role="img" aria-label={label} />
  return <span className={box} role="img" aria-label={label}><span className="h-px w-2 bg-faint" /></span>
}

export default function StatusBadge({ status }: { status: SessionStatus }): React.JSX.Element {
  return <Badge tone={TONE[status]} className="gap-1.5"><StatusDot status={status} />{LABEL[status]}</Badge>
}
