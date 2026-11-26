import { useEffect, useState } from 'react'
import { AlertTriangle, Gauge } from 'lucide-react'
import { PROVIDERS, hasAccounts, type LimitWindow } from '../../../shared/types'
import { cn } from '../lib/utils'
import { Tip } from './ui/tooltip'

const LIMIT_PROVIDERS = PROVIDERS.filter((p) => hasAccounts(p.id))

/** `compact`: one line for the tightest window (sidebar footer); the tooltip lists all of them. */
export default function Limits({ compact = false }: { compact?: boolean }): React.JSX.Element | null {
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
  if (compact) {
    const t = rows.reduce((a, b) => (b.pct < a.pct ? b : a))
    return (
      <Tip label={rows.map((r) => `${r.text} ${r.pct}% left`).join(' · ')}>
        <div tabIndex={0} aria-label={`Usage limits, estimate: ${t.text} ${t.pct}% left`} className="flex items-center gap-2 rounded-sm px-2 text-meta text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          <span className="min-w-0 flex-1 truncate">{t.text}</span>
          <div className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={t.pct} aria-valuemin={0} aria-valuemax={100}>
            <div className={cn('h-full rounded-full', t.pct < 20 ? 'bg-destructive' : 'bg-primary')} style={{ width: `${t.pct}%` }} />
          </div>
          <span className={cn('tnum w-8 shrink-0 text-right', t.pct < 20 && 'text-destructive')}>{t.pct}%</span>
        </div>
      </Tip>
    )
  }
  return (
    <div className="flex flex-col gap-2 text-small">
      <div className="flex items-center gap-1.5 font-medium text-muted-foreground"><Gauge className="size-3.5" />Usage limits · estimate</div>
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
