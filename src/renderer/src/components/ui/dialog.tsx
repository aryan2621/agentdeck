import * as D from '@radix-ui/react-dialog'
import { Button } from './button'

/** Modal with a title, body and Cancel + confirm buttons. Esc and the overlay cancel; focus is trapped by Radix. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, destructive, children }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string; confirmLabel: string; onConfirm: () => void; destructive?: boolean; children?: React.ReactNode
}): React.JSX.Element {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <D.Content className="fixed top-1/3 left-1/2 z-50 flex w-[min(24rem,90vw)] -translate-x-1/2 flex-col gap-3 rounded-md border border-border bg-panel p-4">
          <D.Title className="text-sm font-semibold">{title}</D.Title>
          <D.Description className="text-muted-foreground">{description}</D.Description>
          {children}
          <div className="flex justify-end gap-2">
            <D.Close asChild><Button>Cancel</Button></D.Close>
            <Button variant={destructive ? 'destructive' : 'default'} onClick={() => { onConfirm(); onOpenChange(false) }}>{confirmLabel}</Button>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
