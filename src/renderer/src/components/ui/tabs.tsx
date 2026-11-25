import * as T from '@radix-ui/react-tabs'
import { cn } from '../../lib/utils'

export const Tabs = T.Root
export const TabsList = ({ className, ...p }: React.ComponentProps<typeof T.List>): React.JSX.Element => <T.List className={cn('flex gap-0.5 border-b border-border bg-panel px-3', className)} {...p} />
export const TabsTrigger = ({ className, ...p }: React.ComponentProps<typeof T.Trigger>): React.JSX.Element => (
  <T.Trigger className={cn('-mb-px inline-flex h-8 items-center gap-1.5 border-b-2 border-transparent px-2.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground [&_svg]:size-3.5', className)} {...p} />
)
export const TabsContent = ({ className, ...p }: React.ComponentProps<typeof T.Content>): React.JSX.Element => <T.Content className={cn('flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden', className)} {...p} />
