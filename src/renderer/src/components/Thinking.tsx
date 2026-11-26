import { useEffect, useState } from 'react'
import Logo from './Logo'

/** Progress line while the agent works: the real current step (if any) and elapsed seconds. */
export default function Thinking({ step, since }: { step?: string; since?: number }): React.JSX.Element {
  const [from] = useState(() => since ?? Date.now())
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const s = Math.max(0, Math.floor((now - from) / 1000))
  return (
    <p className="flex items-center gap-2 text-small text-muted-foreground" role="status">
      <Logo spin />
      <span className="min-w-0 truncate">{step ?? 'Working'}…</span>
      <span className="shrink-0 font-mono text-meta text-faint">{s}s</span>
    </p>
  )
}
