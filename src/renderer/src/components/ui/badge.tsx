import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badge = cva('inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium leading-none', {
  variants: {
    tone: {
      neutral: 'border-border bg-muted text-muted-foreground',
      primary: 'border-primary/40 bg-primary/10 text-primary',
      ok: 'border-ok/40 bg-ok/10 text-ok',
      warn: 'border-warn/40 bg-warn/10 text-warn',
      danger: 'border-destructive/40 bg-destructive/10 text-destructive'
    }
  },
  defaultVariants: { tone: 'neutral' }
})

export const Badge = ({ className, tone, ...p }: React.ComponentProps<'span'> & VariantProps<typeof badge>): React.JSX.Element => <span className={cn(badge({ tone }), className)} {...p} />
