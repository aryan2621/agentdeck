import * as C from '@radix-ui/react-collapsible'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'

/** Disclosure row used for tool calls, file changes and diffs. */
export function Disclosure({ head, children, className, open, onOpenChange }: { head: React.ReactNode; children: React.ReactNode; className?: string; open?: boolean; onOpenChange?: (o: boolean) => void }): React.JSX.Element {
  return (
    <C.Root className={cn('group', className)} open={open} onOpenChange={onOpenChange}>
      <C.Trigger className="flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-left transition-colors hover:bg-accent">
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
        {head}
      </C.Trigger>
      <C.Content className="mt-1 border-l border-border pl-3 ml-3">{children}</C.Content>
    </C.Root>
  )
}
