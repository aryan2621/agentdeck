import { AlertCircle, Check, X } from 'lucide-react'
import { actions, useStore } from '../store'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

export default function Toasts(): React.JSX.Element {
  const { toasts } = useStore()
  return (
    <div className="fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className={cn('flex items-start gap-2 rounded-md border bg-panel px-3 py-2', t.kind === 'error' ? 'border-destructive/50 text-destructive' : 'border-border')}>
          {t.kind === 'error' ? <AlertCircle className="mt-0.5 size-4 shrink-0" /> : <Check className="mt-0.5 size-4 shrink-0 text-ok" />}
          <span className="min-w-0 flex-1 break-words">{t.text}</span>
          <Button variant="ghost" size="icon" className="size-6" aria-label="Dismiss" onClick={() => actions.dismiss(t.id)}><X /></Button>
        </div>
      ))}
    </div>
  )
}
