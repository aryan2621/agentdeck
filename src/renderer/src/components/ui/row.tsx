import { cn } from '../../lib/utils'

/** Selectable list row (sidebar, tables, settings nav). One hover/active style everywhere. */
export function Row({ active, className, ...p }: { active?: boolean } & React.ComponentProps<'button'>): React.JSX.Element {
  return (
    <button
      aria-current={active || undefined}
      className={cn('flex w-full rounded-md px-2 text-left text-body text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:bg-accent', active && 'bg-accent text-foreground', className)}
      {...p}
    />
  )
}
