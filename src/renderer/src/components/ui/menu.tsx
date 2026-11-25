import * as M from '@radix-ui/react-dropdown-menu'
import { cn } from '../../lib/utils'

export const Menu = M.Root
export const MenuTrigger = M.Trigger
export const MenuSub = M.Sub
export const MenuSeparator = (): React.JSX.Element => <M.Separator className="-mx-1 my-1 h-px bg-border" />

const panel = 'z-50 min-w-44 rounded-md border border-border bg-panel p-1 text-[13px] data-[state=open]:animate-in data-[state=open]:fade-in-0'
const item = 'flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent [&_svg]:size-3.5 [&_svg]:text-muted-foreground'

export const MenuContent = ({ className, ...p }: React.ComponentProps<typeof M.Content>): React.JSX.Element => (
  <M.Portal><M.Content align="end" sideOffset={4} className={cn(panel, className)} {...p} /></M.Portal>
)
export const MenuItem = ({ className, ...p }: React.ComponentProps<typeof M.Item>): React.JSX.Element => <M.Item className={cn(item, className)} {...p} />
export const MenuLabel = (p: React.ComponentProps<typeof M.Label>): React.JSX.Element => <M.Label className="px-2 py-1 text-[11px] text-muted-foreground" {...p} />
export const MenuSubTrigger = ({ className, ...p }: React.ComponentProps<typeof M.SubTrigger>): React.JSX.Element => <M.SubTrigger className={cn(item, className)} {...p} />
export const MenuSubContent = ({ className, ...p }: React.ComponentProps<typeof M.SubContent>): React.JSX.Element => (
  <M.Portal><M.SubContent sideOffset={4} className={cn(panel, 'max-h-72 overflow-y-auto', className)} {...p} /></M.Portal>
)
