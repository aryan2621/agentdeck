import { GitBranch, LayoutGrid } from 'lucide-react'
import { actions, useStore } from '../store'
import StatusBadge from './StatusBadge'
import { Badge } from './ui/badge'
import { Card } from './ui/card'
import { Empty } from './ui/field'

export default function Grid(): React.JSX.Element {
  const { projects, sessions } = useStore()
  const all = projects.flatMap((p) => (sessions[p.id] ?? []).map((s) => ({ p, s })))
  if (!all.length) return <Empty icon={LayoutGrid}>No sessions yet.</Empty>
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] content-start gap-3 overflow-y-auto p-4">
      {all.map(({ p, s }) => (
        <button key={s.id} onClick={() => actions.select(s.id)} className="text-left">
          <Card className="flex flex-col gap-2 p-3 transition-colors hover:border-primary/60 hover:bg-accent/40">
            <div className="truncate font-medium">{s.title}</div>
            <div className="flex items-center justify-between gap-2"><span className="truncate text-xs text-muted-foreground">{p.name}</span><Badge>{s.provider}</Badge></div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground"><GitBranch className="size-3.5 shrink-0" /><span className="truncate">{s.branch ?? 'no branch'}</span></span>
              <StatusBadge status={s.status} />
            </div>
          </Card>
        </button>
      ))}
    </div>
  )
}
