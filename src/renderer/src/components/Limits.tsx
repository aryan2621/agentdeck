import { useEffect, useState } from 'react'
import { AlertTriangle, Gauge } from 'lucide-react'
import { PROVIDERS, hasAccounts, type LimitWindow } from '../../../shared/types'
import { cn } from '../lib/utils'

const LIMIT_PROVIDERS = PROVIDERS.filter((p) => hasAccounts(p.id))

export default function Limits(): React.JSX.Element | null {
  const [limits, setLimits] = useState<Record<string, LimitWindow[]>>({})
  useEffect(() => {
    const load = (): void =>
      LIMIT_PROVIDERS.forEach(({ id }) =>
        window.api.getLimits(id).then((w) => setLimits((l) => ({ ...l, [id]: w })), () => {})
      )
    load()
    const t = setInterval(load, 5 * 60_000)
    return () => clearInterval(t)
  }, [])
  const rows = LIMIT_PROVIDERS.flatMap(({ id, label }) => (limits[id] ?? []).map((w) => ({ key: `${id}-${w.name}`, text: `${label} ${w.name}`, pct: Math.round(w.remainingPercent) })))
  if (!rows.length) return null
  const low = rows.some((r) => r.pct < 20)
  return (
    <div className="flex flex-col gap-2 border-t border-border p-3 text-xs">
      <div className="flex items-center gap-1.5 font-medium text-muted-foreground"><Gauge className="size-3.5" />Usage limits</div>
      {low && <div role="alert" className="flex items-start gap-1.5 text-destructive"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />Near a limit: switch the session's account from its Account menu.</div>}
      {rows.map((r) => (
        <div key={r.key} className="flex flex-col gap-1">
          <div className="flex justify-between"><span className="truncate">{r.text}</span><span className="tnum text-muted-foreground">{r.pct}% left</span></div>
          <div className="h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={r.pct} aria-valuemin={0} aria-valuemax={100}>
            <div className={cn('h-full rounded-full', r.pct < 20 ? 'bg-destructive' : 'bg-primary')} style={{ width: `${r.pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
