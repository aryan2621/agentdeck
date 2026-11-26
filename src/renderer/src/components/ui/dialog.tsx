import * as D from '@radix-ui/react-dialog'
import { Button } from './button'
import { cn } from '../../lib/utils'

export const DialogTitle = D.Title
export const DialogDescription = D.Description

/** Overlay + content with one 150ms fade/zoom. `className` positions and sizes the content; children supply a DialogTitle. */
export function DialogShell({ open, onOpenChange, className, children, ...p }: { open: boolean; onOpenChange: (o: boolean) => void; className?: string; children: React.ReactNode } & Pick<React.ComponentProps<typeof D.Content>, 'aria-describedby'>): React.JSX.Element {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-scrim backdrop-blur-[3px] duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <D.Content className={cn('fixed z-50 rounded-lg border border-border bg-overlay shadow-overlay duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95', className)} {...p}>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

/** Modal with a title, body and Cancel + confirm buttons. Esc and the overlay cancel; focus is trapped by Radix. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, destructive, children }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string; confirmLabel: string; onConfirm: () => void; destructive?: boolean; children?: React.ReactNode
}): React.JSX.Element {
  return (
    <DialogShell open={open} onOpenChange={onOpenChange} className="top-1/3 left-1/2 flex w-[min(22.5rem,90vw)] -translate-x-1/2 flex-col gap-3 p-6">
      <D.Title className="text-title">{title}</D.Title>
      <D.Description className="text-body text-muted-foreground">{description}</D.Description>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); onConfirm(); onOpenChange(false) }}>
        {children}
        <div className="mt-1 flex justify-end gap-2">
          <D.Close asChild><Button type="button" variant="outline">Cancel</Button></D.Close>
          <Button type="submit" variant={destructive ? 'destructive-solid' : 'default'}>{confirmLabel}</Button>
        </div>
      </form>
    </DialogShell>
  )
}
