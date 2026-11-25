import * as C from '@radix-ui/react-collapsible'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'

/** Disclosure row used for tool calls, file changes and diffs. */
export function Disclosure({ head, children, className }: { head: React.ReactNode; children: React.ReactNode; className?: string }): React.JSX.Element {
  return (
    <C.Root className={cn('group rounded-md border border-border bg-card', className)}>
      <C.Trigger className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-accent/60">
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
        {head}
      </C.Trigger>
      <C.Content className="border-t border-border">{children}</C.Content>
    </C.Root>
  )
}
