import { useEffect } from 'react'
import type { UsageRow } from '../../../main/db'
import { actions, findSession, useStore } from '../store'
import { Loading } from './ui/field'

const tokens = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
const usd = (n: number): string => `$${n.toFixed(2)}`
const sum = (rows: UsageRow[]): { tokens: number; cost: number } => ({ tokens: rows.reduce((n, r) => n + r.inputTokens + r.outputTokens, 0), cost: rows.reduce((n, r) => n + r.costUsd, 0) })

/** Spend per project and per session. Costs are the provider's own estimates. */
export default function UsageView(): React.JSX.Element {
  const store = useStore()
  const rows = store.usage // cached from startup; refreshed on open
  useEffect(actions.refreshUsage, [])
  const name = (r: UsageRow): string => findSession(store, r.sessionId)?.title ?? r.title ?? 'Untitled session'
  const byProject = new Map<string, UsageRow[]>()
  rows?.forEach((r) => byProject.set(r.projectId, [...(byProject.get(r.projectId) ?? []), r]))
  const total = sum(rows ?? [])
  const th = 'px-3 py-1.5 text-left text-meta font-medium text-faint'
  const td = 'tnum px-3 py-1.5 text-right font-mono text-small'
  return (
    <>
      {rows && <p className="tnum text-small text-muted-foreground">{usd(total.cost)} · {tokens(total.tokens)} tokens in total</p>}
      {!rows && <Loading>Loading usage…</Loading>}
      {rows?.length === 0 && <p className="text-small text-muted-foreground">No usage yet. It is recorded as sessions run.</p>}
      {rows && rows.length > 0 && (
        <div className="flex flex-col gap-6">
          <table className="w-full border-collapse">
            <caption className="sr-only">Cost per project</caption>
            <thead><tr className="border-b border-border"><th className={th} scope="col">Project</th><th className={`${th} text-right`} scope="col">Sessions</th><th className={`${th} text-right`} scope="col">Tokens</th><th className={`${th} text-right`} scope="col">Cost</th></tr></thead>
            <tbody>
              {[...byProject].map(([id, list]) => ({ id, list, ...sum(list) })).sort((a, b) => b.cost - a.cost).map((p) => (
                <tr key={p.id} className="border-b border-border">
                  <th scope="row" className="px-3 py-1.5 text-left text-small font-medium">{store.projects.find((x) => x.id === p.id)?.name ?? 'Removed project'}</th>
                  <td className={td}>{p.list.length}</td><td className={td}>{tokens(p.tokens)}</td><td className={td}>{usd(p.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="w-full border-collapse">
            <caption className="sr-only">Cost per session</caption>
            <thead><tr className="border-b border-border"><th className={th} scope="col">Session</th><th className={th} scope="col">Provider</th><th className={`${th} text-right`} scope="col">Tokens</th><th className={`${th} text-right`} scope="col">Cost</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.sessionId} className="border-b border-border">
                  <th scope="row" className="max-w-0 truncate px-3 py-1.5 text-left text-small font-normal">
                    {findSession(store, r.sessionId)
                      ? <button type="button" className="max-w-full truncate rounded-sm text-left hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" onClick={() => actions.select(r.sessionId)}>{name(r)}</button>
                      : name(r)}
                  </th>
                  <td className="px-3 py-1.5 text-small text-muted-foreground">{r.provider}</td>
                  <td className={td}>{tokens(r.inputTokens + r.outputTokens)}</td><td className={td}>{usd(r.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
