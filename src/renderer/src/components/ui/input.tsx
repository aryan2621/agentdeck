import { cn } from '../../lib/utils'

const base = 'w-full rounded-md border border-input bg-card px-2.5 text-[13px] placeholder:text-muted-foreground transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50'

export const Input = ({ className, ...p }: React.ComponentProps<'input'>): React.JSX.Element => <input className={cn(base, 'h-7', className)} {...p} />
export const Textarea = ({ className, ...p }: React.ComponentProps<'textarea'>): React.JSX.Element => <textarea className={cn(base, 'resize-none py-1.5', className)} {...p} />
