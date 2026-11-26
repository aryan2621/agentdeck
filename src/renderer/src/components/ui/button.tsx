import { Slot } from '@radix-ui/react-slot'
import Logo from '../Logo'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const button = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-body font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-muted hover:bg-muted/70',
        outline: 'border border-input bg-overlay hover:bg-accent',
        ghost: 'hover:bg-accent',
        destructive: 'bg-destructive/12 text-destructive hover:bg-destructive/20',
        'destructive-solid': 'bg-destructive text-white hover:bg-destructive/90'
      },
      size: { default: 'h-8 px-3', sm: 'h-6 px-2.5 text-small', lg: 'h-8 px-4', icon: 'size-7' }
    },
    defaultVariants: { variant: 'secondary', size: 'default' }
  }
)

export function Button({ className, variant, size, asChild, loading, children, disabled, ...p }: React.ComponentProps<'button'> & VariantProps<typeof button> & { asChild?: boolean; loading?: boolean }): React.JSX.Element {
  if (asChild) return <Slot className={cn(button({ variant, size }), className)} {...p}>{children}</Slot>
  return (
    <button className={cn(button({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...p}>
      {loading && <Logo spin />}{children}
    </button>
  )
}
