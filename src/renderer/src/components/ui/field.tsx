import { cn } from '../../lib/utils'

/** Label + control stack used by every form. */
export const Field = ({ label, className, children }: { label: string; className?: string; children: React.ReactNode }): React.JSX.Element => (
  <label className={cn('flex flex-col gap-1', className)}>
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
    {children}
  </label>
)

export const Empty = ({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }): React.JSX.Element => (
  <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
    <Icon className="size-8 opacity-60" strokeWidth={1.5} />
    <div>{children}</div>
  </div>
)
