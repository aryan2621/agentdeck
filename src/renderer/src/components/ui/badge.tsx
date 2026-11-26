import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badge = cva('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-meta font-medium leading-none', {
  variants: {
    tone: {
      neutral: 'bg-muted text-muted-foreground',
      primary: 'bg-accent text-foreground',
      ok: 'bg-ok/12 text-ok',
      warn: 'bg-warn/12 text-warn',
      danger: 'bg-destructive/12 text-destructive'
    }
  },
  defaultVariants: { tone: 'neutral' }
})

export const Badge = ({ className, tone, ...p }: React.ComponentProps<'span'> & VariantProps<typeof badge>): React.JSX.Element => <span className={cn(badge({ tone }), className)} {...p} />
