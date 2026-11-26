import { cn } from '../../lib/utils'

/** Shortcut hint, e.g. <Kbd>⌘K</Kbd>. */
export const Kbd = ({ className, ...p }: React.ComponentProps<'kbd'>): React.JSX.Element => (
  <kbd className={cn('inline-flex h-4 min-w-4 items-center justify-center rounded-sm bg-accent px-1 font-mono text-meta font-medium text-muted-foreground', className)} {...p} />
)
