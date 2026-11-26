import * as D from '@radix-ui/react-dialog'
import { Button } from './button'

/** Modal with a title, body and Cancel + confirm buttons. Esc and the overlay cancel; focus is trapped by Radix. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, destructive, children }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string; confirmLabel: string; onConfirm: () => void; destructive?: boolean; children?: React.ReactNode
}): React.JSX.Element {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-scrim" />
        <D.Content className="fixed top-1/3 left-1/2 z-50 flex w-[min(22.5rem,90vw)] -translate-x-1/2 flex-col gap-3 rounded-lg border border-border bg-overlay p-6 shadow-overlay">
          <D.Title className="text-title">{title}</D.Title>
          <D.Description className="text-body text-muted-foreground">{description}</D.Description>
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); onConfirm(); onOpenChange(false) }}>
            {children}
            <div className="mt-1 flex justify-end gap-2">
              <D.Close asChild><Button type="button" variant="outline">Cancel</Button></D.Close>
              <Button type="submit" variant={destructive ? 'destructive' : 'default'}>{confirmLabel}</Button>
            </div>
          </form>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
