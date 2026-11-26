import { AlertCircle, Check, X } from 'lucide-react'
import { actions, useStore } from '../state/store'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

export default function Toasts(): React.JSX.Element {
  const { toasts } = useStore()
  return (
    <div className="fixed right-3 bottom-3 z-[60] flex w-80 flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className={cn('flex items-center gap-2 rounded-lg border bg-overlay px-3 py-2 text-body shadow-overlay', t.kind === 'error' ? 'border-destructive/50' : 'border-border')}>
          {t.kind === 'error' ? <AlertCircle className="size-4 shrink-0 text-destructive" /> : <Check className="size-4 shrink-0 text-ok" />}
          <span className="min-w-0 flex-1 break-words">{t.text}</span>
          {t.action && <Button variant="ghost" size="sm" onClick={() => { t.action?.run(); actions.dismiss(t.id) }}>{t.action.label}</Button>}
          <Button variant="ghost" size="icon" className="size-6" aria-label="Dismiss" onClick={() => actions.dismiss(t.id)}><X /></Button>
        </div>
      ))}
    </div>
  )
}
