import { TriangleAlert } from 'lucide-react'
import { cn } from '../../lib/utils'

/** Inline notice that stays until its cause is fixed. */
export const Banner = ({ className, children, ...p }: React.ComponentProps<'div'>): React.JSX.Element => (
  <div role="status" className={cn('flex items-start gap-2 border-b border-warn/40 bg-warn/10 px-3 py-2 text-small text-foreground', className)} {...p}>
    <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden />
    <span className="min-w-0">{children}</span>
  </div>
)
