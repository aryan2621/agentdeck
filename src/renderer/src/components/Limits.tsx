import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { PROVIDERS, hasAccounts } from '../../../shared/types'
import { actions, useStore } from '../store'
import { cn } from '../lib/utils'

const LIMIT_PROVIDERS = PROVIDERS.filter((p) => hasAccounts(p.id))

/** `compact`: one line for the tightest window (sidebar footer); the tooltip lists all of them. */
export default function Limits({ compact = false }: { compact?: boolean }): React.JSX.Element | null {
  const { limits } = useStore() // first fetch happens at startup
  useEffect(() => {
    const t = setInterval(actions.refreshLimits, 5 * 60_000)
    return () => clearInterval(t)
  }, [])
  const rows = LIMIT_PROVIDERS.flatMap(({ id, label }) => (limits[id] ?? []).map((w) => ({ key: `${id}-${w.name}`, text: `${label} ${w.name}`, pct: Math.round(w.remainingPercent) })))
  if (!rows.length) return null
  const low = rows.some((r) => r.pct < 20)
  if (compact) {
    // Tightest window per provider, so every provider with data stays visible.
    const tight = LIMIT_PROVIDERS.map(({ id }) => rows.filter((r) => r.key.startsWith(`${id}-`)).reduce<(typeof rows)[number] | null>((a, b) => (!a || b.pct < a.pct ? b : a), null)).filter((r) => !!r)
    return (
        <div tabIndex={0} aria-label={`Usage limits, estimate: ${tight.map((t) => `${t.text} ${t.pct}% left`).join(', ')}`} className="flex flex-col gap-1 rounded-sm px-2 text-meta text-muted-foreground">
          {tight.map((t) => (
            <div key={t.key} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{t.text}</span>
              <div className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={t.pct} aria-valuemin={0} aria-valuemax={100}>
                <div className={cn('h-full rounded-full', t.pct < 20 ? 'bg-destructive' : 'bg-primary')} style={{ width: `${t.pct}%` }} />
              </div>
              <span className={cn('tnum w-8 shrink-0 text-right', t.pct < 20 && 'text-destructive')}>{t.pct}%</span>
            </div>
          ))}
        </div>
    )
  }
  return (
    <div className="flex flex-col gap-3 text-prose">
      <div><h2 className="font-medium">Usage limits</h2><p className="text-muted-foreground">Estimate from each provider.</p></div>
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
