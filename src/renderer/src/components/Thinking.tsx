import { useEffect, useState } from 'react'
import Logo from './Logo'

/** Progress line while the agent works: the real current step (if any) and elapsed seconds. */
export default function Thinking({ step }: { step?: string }): React.JSX.Element {
  const [s, setS] = useState(0)
  useEffect(() => { const t = setInterval(() => setS((n) => n + 1), 1000); return () => clearInterval(t) }, [])
  return (
    <p className="flex items-center gap-2 text-small text-muted-foreground" role="status">
      <Logo spin />
      <span className="min-w-0 truncate">{step ?? 'Working'}…</span>
      <span className="shrink-0 font-mono text-meta text-faint">{s}s</span>
    </p>
  )
}
