import { cn } from '../../lib/utils'

export const Card = ({ className, ...p }: React.ComponentProps<'div'>): React.JSX.Element => <div className={cn('rounded-md border border-border bg-card', className)} {...p} />
