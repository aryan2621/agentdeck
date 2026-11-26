import { useEffect, useState } from 'react'
import type { DiffResult } from '../../../../main/git'
import { actions, useStore } from '../../state/store'
import { Button } from '../../components/ui/button'
import { Diff, Stat } from './Diff'
import PageHeader from '../../components/PageHeader'
import ProviderIcon from '../../components/ProviderIcon'
import type { SessionInfo } from '../../../../shared/ipc'

/** One run group side by side: each agent's uncommitted diff. "Keep this one" archives the others (worktrees stay on disk). */
function Column({ s, onKeep }: { s: SessionInfo; onKeep: () => void }): React.JSX.Element {
  const [res, setRes] = useState<DiffResult | null>(null)
  useEffect(() => { window.api.sessionDiff(s.id, 'uncommitted').then(setRes, actions.fail) }, [s.id, s.status])
  const add = res?.files.reduce((n, f) => n + f.additions, 0) ?? 0
  const del = res?.files.reduce((n, f) => n + f.deletions, 0) ?? 0
  return (
    <section aria-label={s.title ?? s.id} className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col border-r border-border last:border-r-0">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        <ProviderIcon id={s.provider} />
        <span className="min-w-0 flex-1 truncate text-body font-medium">{s.title ?? s.id}</span>
        <span className="text-small text-muted-foreground">{s.model ?? 'default model'} · {s.status}</span>
        <Stat add={add} del={del} />
        <Button size="sm" onClick={onKeep}>Keep this one</Button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">
        {!res ? <p className="p-3 text-small text-muted-foreground">Loading…</p>
          : res.files.length === 0 ? <p className="p-3 text-small text-muted-foreground">No changes yet.</p>
          : <Diff diff={res.diff} />}
      </div>
    </section>
  )
}

export default function Compare({ groupId }: { groupId: string }): React.JSX.Element {
  const members = Object.values(useStore().sessions).flat().filter((x) => x.groupId === groupId)
  const keep = async (keepId: string): Promise<void> => {
    for (const m of members) if (m.id !== keepId) await actions.archive(m)
    actions.select(keepId)
  }
  return (
    <>
      <PageHeader title="Compare agents"><Button variant="ghost" onClick={actions.home}>Close</Button></PageHeader>
      <div className="flex min-h-0 flex-1">
        {members.map((m) => <Column key={m.id} s={m} onKeep={() => void keep(m.id)} />)}
      </div>
    </>
  )
}
