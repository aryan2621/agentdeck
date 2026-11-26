import { useEffect, useState } from 'react'
import type { SessionInfo } from '../../../shared/ipc'
import { PROVIDERS } from '../../../shared/types'
import { useStore } from '../state/store'
import { fmtTokens, windowLeft } from '../lib/stats'
import ProviderIcon from './ProviderIcon'

const dots = 'bg-[radial-gradient(circle,currentColor_0.8px,transparent_1px)] bg-[length:4px_4px]'

/** Dotted meter; `pct` undefined renders an empty track. */
function Dots({ pct, label, className }: { pct?: number; label: string; className: string }): React.JSX.Element {
  return (
    <span role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className={`relative h-2 shrink-0 text-border ${className}`}>
      <span className={`absolute inset-0 ${dots}`} />
      <span className={`absolute inset-y-0 left-0 overflow-hidden text-foreground ${dots}`} style={{ width: `${pct ?? 0}%` }} />
    </span>
  )
}

const Col = ({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element => (
  <div className="flex min-w-0 flex-col gap-0.5 px-3 py-1.5 first:pl-3 [&:not(:first-child)]:border-l [&:not(:first-child)]:border-border">
    <span className="text-meta text-faint">{title}</span>
    <div className="flex h-5 items-center gap-2 text-small text-muted-foreground">{children}</div>
  </div>
)
const Dash = (): React.JSX.Element => <span aria-label="No data">—</span>

export default function StatsStrip({ session }: { session: SessionInfo }): React.JSX.Element {
  const { limits, accounts } = useStore()
  const [u, setU] = useState<{ inputTokens: number; outputTokens: number; costUsd: number }>()
  useEffect(() => { window.api.sessionUsage(session.id).then(setU, () => {}) }, [session.id, session.status])
  const tokens = u && u.inputTokens + u.outputTokens
  const ws = limits[session.provider]
  const auth = accounts.find((a) => a.id === session.accountId)?.label ?? PROVIDERS.find((p) => p.id === session.provider)?.label
  return (
    <div className="grid grid-cols-[1.4fr_1fr_1.6fr_1fr] rounded-md border border-border">
      {/* No source for the model's context window or tokens in context: dash until a provider reports them. */}
      <Col title="Context"><Dots label="Context used" className="w-24" /><Dash /></Col>
      <Col title="Usage">{tokens ? <><span className="tnum">{fmtTokens(tokens)}</span><span className="tnum text-foreground">${u.costUsd.toFixed(2)}</span></> : <Dash />}</Col>
      <Col title="Limits">
        {(['5h', '7d'] as const).map((w) => { const left = windowLeft(ws, w); return <span key={w} className="flex items-center gap-1.5">{w}<Dots pct={left} label={`${w} limit left`} className="w-10" />{left === undefined ? <Dash /> : <span className="tnum">{left}%</span>}</span> })}
      </Col>
      <Col title="Auth"><ProviderIcon id={session.provider} />{auth}</Col>
    </div>
  )
}
