import { AlertCircle, BellRing, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import type { SessionStatus } from '../../../shared/types'
import { Badge } from './ui/badge'

const S: Record<SessionStatus, { label: string; tone: 'neutral' | 'primary' | 'ok' | 'warn' | 'danger'; icon: React.ElementType; cls?: string }> = {
  idle: { label: 'Idle', tone: 'neutral', icon: Circle },
  working: { label: 'Working', tone: 'primary', icon: Loader2, cls: 'animate-spin' },
  'needs-you': { label: 'Needs you', tone: 'warn', icon: BellRing },
  done: { label: 'Done', tone: 'ok', icon: CheckCircle2 },
  error: { label: 'Error', tone: 'danger', icon: AlertCircle }
}

export default function StatusBadge({ status }: { status: SessionStatus }): React.JSX.Element {
  const { label, tone, icon: Icon, cls } = S[status]
  return <Badge tone={tone}><Icon className={`size-3 ${cls ?? ''}`} aria-hidden="true" />{label}</Badge>
}

const DOT: Record<SessionStatus, string> = { idle: 'text-muted-foreground', working: 'text-foreground', 'needs-you': 'text-primary', done: 'text-ok', error: 'text-destructive' }

export function StatusDot({ status }: { status: SessionStatus }): React.JSX.Element {
  const { label, icon: Icon, cls } = S[status]
  return <Icon className={`size-3.5 shrink-0 ${DOT[status]} ${cls ?? ''}`} role="img" aria-label={label} />
}
