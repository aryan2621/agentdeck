import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

/** Progress line while the agent works: the real current step (if any) and elapsed seconds. */
export default function Thinking({ step }: { step?: string }): React.JSX.Element {
  const [s, setS] = useState(0)
  useEffect(() => { const t = setInterval(() => setS((n) => n + 1), 1000); return () => clearInterval(t) }, [])
  return (
    <p className="flex items-center gap-2 text-small text-muted-foreground" role="status">
      <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
      <span className="min-w-0 truncate">{step ?? 'Working'}…</span>
      <span className="shrink-0 font-mono text-meta text-faint">{s}s</span>
    </p>
  )
}
