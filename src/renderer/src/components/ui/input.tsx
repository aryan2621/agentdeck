import { cn } from '../../lib/utils'

const base = 'w-full rounded-md border border-input bg-transparent px-2.5 text-body placeholder:text-muted-foreground transition-colors disabled:opacity-50'

export const Input = ({ className, ...p }: React.ComponentProps<'input'>): React.JSX.Element => <input className={cn(base, 'h-8', className)} {...p} />
export const Textarea = ({ className, ...p }: React.ComponentProps<'textarea'>): React.JSX.Element => <textarea className={cn(base, 'resize-none rounded-md py-1.5', className)} {...p} />
