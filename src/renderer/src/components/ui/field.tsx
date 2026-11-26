import Logo from '../Logo'
import { cn } from '../../lib/utils'

/** Label + control stack used by every form. */
export const Field = ({ label, className, children }: { label: string; className?: string; children: React.ReactNode }): React.JSX.Element => (
  <label className={cn('flex flex-col gap-1', className)}>
    <span className="text-small font-medium text-muted-foreground">{label}</span>
    {children}
  </label>
)

/** One line saying what to do, plus the action. No hero icon. */
export const Empty = ({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }): React.JSX.Element => (
  <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-body text-muted-foreground">
    <Icon className="size-4 text-faint" strokeWidth={1.5} aria-hidden="true" />
    <div>{children}</div>
  </div>
)

/** Inline loading line for lists and panels. */
export const Loading = ({ children = 'Loading…', className }: { children?: React.ReactNode; className?: string }): React.JSX.Element => (
  <div role="status" className={cn('flex items-center gap-2 p-4 text-body text-muted-foreground', className)}>
    <Logo spin />{children}
  </div>
)

export const SettingsSection = ({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }): React.JSX.Element => (
  <section className="flex flex-col gap-1">
    <div className="flex items-center justify-between gap-2"><h2 className="text-body font-medium text-foreground">{title}</h2>{action}</div>
    {description && <p className="text-body text-muted-foreground">{description}</p>}
    <div className="mt-2 flex flex-col divide-y divide-border border-y border-border">{children}</div>
  </section>
)

export const SettingsRow = ({ label, description, children }: { label: string; description?: string; children?: React.ReactNode }): React.JSX.Element => (
  <div className="flex min-h-10 items-center justify-between gap-4 py-2">
    <div className="min-w-0">
      <div className="truncate text-body text-foreground">{label}</div>
      {description && <div className="text-small text-muted-foreground">{description}</div>}
    </div>
    {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
  </div>
)
