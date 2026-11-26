import { SquareTerminal } from 'lucide-react'
import { siClaude } from 'simple-icons'
import type { ProviderId } from '../../../shared/types'
import { PROVIDERS } from '../../../shared/types'
import { cn } from '../lib/utils'

/** Provider mark with accessible name. Codex has no brand mark in simple-icons, so it uses a neutral terminal icon. */
export default function ProviderIcon({ id, className }: { id: ProviderId; className?: string }): React.JSX.Element {
  const label = PROVIDERS.find((p) => p.id === id)?.label ?? id
  const cls = cn('size-4 shrink-0', className)
  return id === 'claude' ? (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={label} className={cls}><path d={siClaude.path} /></svg>
  ) : (
    <SquareTerminal role="img" aria-label={label} className={cls} />
  )
}
