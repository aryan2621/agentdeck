import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const button = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'border border-input bg-card hover:bg-accent',
        ghost: 'hover:bg-accent',
        destructive: 'border border-destructive/50 text-destructive hover:bg-destructive/10'
      },
      size: { default: 'h-7 px-2.5', sm: 'h-6 px-2 text-xs', icon: 'size-7' }
    },
    defaultVariants: { variant: 'secondary', size: 'default' }
  }
)

export function Button({ className, variant, size, asChild, ...p }: React.ComponentProps<'button'> & VariantProps<typeof button> & { asChild?: boolean }): React.JSX.Element {
  const C = asChild ? Slot : 'button'
  return <C className={cn(button({ variant, size }), className)} {...p} />
}
