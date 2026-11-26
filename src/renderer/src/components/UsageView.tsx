import { useEffect } from 'react'
import { BarChart3 } from 'lucide-react'
import type { UsageRow } from '../../../main/db'
import { PROVIDERS } from '../../../shared/types'
import { actions, findSession, useStore } from '../store'
import { fmtTokens } from '../lib/stats'
import { groupUsage, summarize, type Tally } from '../lib/usage'
import { Empty, Loading, SettingsSection } from './ui/field'

const usd = (n: number): string => `$${n.toFixed(2)}`
const TOP_SESSIONS = 10

/** One ranked row: name, share-of-spend bar, tokens, cost. */
const Line = ({ name, sub, share, t, onClick }: { name: string; sub?: string; share: number; t: Tally; onClick?: () => void }): React.JSX.Element => (
  <li className="grid min-h-12 grid-cols-[minmax(0,1fr)_8rem_4rem_4.5rem] items-center gap-4 py-2 text-prose">
    <div className="min-w-0">
      {onClick ? <button type="button" onClick={onClick} className="block max-w-full truncate rounded-sm text-left hover:underline">{name}</button> : <div className="truncate">{name}</div>}
      {sub && <div className="truncate text-small text-muted-foreground">{sub}</div>}
    </div>
    <div className="h-1 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${Math.round(share * 100)}% of the top spend`}><div className="h-full rounded-full bg-primary" style={{ width: `${share * 100}%` }} /></div>
    <span className="tnum text-right text-muted-foreground">{fmtTokens(t.tokens)}</span>
    <span className="tnum text-right">{usd(t.cost)}</span>
  </li>
)

const Stat = ({ label, t }: { label: string; t: Tally }): React.JSX.Element => (
  <div className="flex flex-col gap-0.5 px-4 py-3">
    <span className="text-small text-muted-foreground">{label}</span>
    <span className="tnum text-[20px] leading-7 font-medium">{usd(t.cost)}</span>
    <span className="tnum text-small text-muted-foreground">{fmtTokens(t.tokens)} tokens · {t.sessions} {t.sessions === 1 ? 'session' : 'sessions'}</span>
  </div>
)

/** Spend per provider, project and session. Costs are the provider's own estimates. */
export default function UsageView(): React.JSX.Element {
  const store = useStore()
  const rows = store.usage // cached from startup; refreshed on open
  useEffect(actions.refreshUsage, [])
  if (!rows) return <Loading>Loading usage…</Loading>
  if (!rows.length) return <div className="flex h-40 rounded-md border border-dashed border-border"><Empty icon={BarChart3}>No usage yet. Tokens and cost are recorded once a session has run; start one from a project.</Empty></div>
  const s = summarize(rows)
  const peak = Math.max(...s.daily, 0.01)
  const name = (r: UsageRow): string => findSession(store, r.sessionId)?.title ?? r.title ?? 'Untitled session'
  const list = (items: { key: string; label: string; sub?: string; t: Tally; go?: () => void }[]): React.JSX.Element => {
    const max = Math.max(...items.map((i) => i.t.cost), 0.01)
    return <ul className="flex flex-col divide-y divide-border">{items.map((i) => <Line key={i.key} name={i.label} sub={i.sub} share={i.t.cost / max} t={i.t} onClick={i.go} />)}</ul>
  }
  return (
    <>
      <div className="grid grid-cols-3 divide-x divide-border rounded-md border border-border">
        <Stat label="Last 7 days" t={s.week} /><Stat label="Last 30 days" t={s.month} /><Stat label="All time" t={s.all} />
      </div>
      <SettingsSection title="Daily cost" description="Last 30 days. Each session's total counts on the day it was created.">
        <div className="flex h-16 items-end gap-0.5 py-2" role="img" aria-label={`Daily cost for the last 30 days, peak ${usd(peak)}`}>
          {s.daily.map((c, i) => <div key={i} title={usd(c)} className="min-h-px flex-1 rounded-sm bg-primary/70" style={{ height: `${Math.max(c / peak, 0.02) * 100}%` }} />)}
        </div>
      </SettingsSection>
      <SettingsSection title="By provider">
        {list(groupUsage(rows, (r) => r.provider).map((g) => ({ key: g.key, label: PROVIDERS.find((p) => p.id === g.key)?.label ?? g.key, t: g })))}
      </SettingsSection>
      <SettingsSection title="By model" description="Sessions started on the provider's default model are grouped as Default.">
        {list(groupUsage(rows, (r) => `${r.provider}:${r.model ?? ''}`).map((g) => { const [p, m] = [g.key.split(':')[0], g.key.slice(g.key.indexOf(':') + 1)]; return { key: g.key, label: m || 'Default', sub: PROVIDERS.find((x) => x.id === p)?.label ?? p, t: g } }))}
      </SettingsSection>
      <SettingsSection title="By project">
        {list(groupUsage(rows, (r) => r.projectId).map((g) => ({ key: g.key, label: store.projects.find((x) => x.id === g.key)?.name ?? 'Removed project', t: g })))}
      </SettingsSection>
      <SettingsSection title="Most expensive sessions" description={rows.length > TOP_SESSIONS ? `Top ${TOP_SESSIONS} of ${rows.length}.` : undefined}>
        {list([...rows].sort((a, b) => b.costUsd - a.costUsd).slice(0, TOP_SESSIONS).map((r) => ({
          key: r.sessionId, label: name(r), sub: PROVIDERS.find((p) => p.id === r.provider)?.label ?? r.provider,
          t: { tokens: r.inputTokens + r.outputTokens, cost: r.costUsd, sessions: 1 }, go: findSession(store, r.sessionId) ? () => actions.select(r.sessionId) : undefined,
        })))}
      </SettingsSection>
    </>
  )
}
