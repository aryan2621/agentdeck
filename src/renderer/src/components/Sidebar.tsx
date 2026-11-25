import { useEffect, useState } from 'react'
import { FolderPlus, History, LayoutGrid, Plus, Search, Settings } from 'lucide-react'
import { actions, useStore } from '../store'
import { StatusDot } from './StatusBadge'
import { OPEN_PALETTE } from './Palette'
import { Stat } from './Diff'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Tip } from './ui/tooltip'
import { cn } from '../lib/utils'
import type { SessionInfo } from '../../../shared/ipc'

const ago = (t: number | string): string => {
  const m = Math.max(0, Date.now() - new Date(t).getTime()) / 60000
  return m < 1 ? 'now' : m < 60 ? `${Math.floor(m)}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`
}

const Label = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <div className="px-2 pt-3 pb-1 text-xs font-medium text-muted-foreground">{children}</div>
)

const Row = ({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }): React.JSX.Element => (
  <button onClick={onClick} aria-current={active} className={cn('flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors duration-100 hover:bg-accent', active && 'bg-accent')}>
    {children}
  </button>
)

/** Uncommitted +x −y for a session; refetched when its status changes. */
const useChanges = (s: SessionInfo): { add: number; del: number } => {
  const [c, setC] = useState({ add: 0, del: 0 })
  useEffect(() => {
    window.api.sessionDiff(s.id, 'uncommitted').then((r) => setC({ add: r.files.reduce((n, f) => n + f.additions, 0), del: r.files.reduce((n, f) => n + f.deletions, 0) }), () => {})
  }, [s.id, s.status])
  return c
}

const SessionRow = ({ s, active }: { s: SessionInfo; active: boolean }): React.JSX.Element => {
  const c = useChanges(s)
  return (
  <Row active={active} onClick={() => actions.select(s.id)}>
    <div className="flex items-center gap-2">
      <StatusDot status={s.status} />
      <span className="min-w-0 flex-1 truncate font-medium">{s.title}</span>
    </div>
    <div className="tnum flex gap-1.5 pl-4 text-[11px] text-muted-foreground">
      <span className="min-w-0 truncate font-mono">{s.branch ?? s.provider}</span>
      <span className="shrink-0">· {ago(s.createdAt)}</span>
      <Stat className="ml-auto" {...c} />
    </div>
  </Row>
  )
}

export default function Sidebar(): React.JSX.Element {
  const { projects, sessions, selectedId } = useStore()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<{ sessionId: string; text: string }[]>([])
  const needs = Object.values(sessions).flat().filter((s) => s.status === 'needs-you')
  const title = (id: string): string => Object.values(sessions).flat().find((s) => s.id === id)?.title ?? id
  const search = (v: string): void => {
    setQ(v)
    window.api.searchSessions(v).then(setHits, actions.fail)
  }
  return (
    <nav className="flex min-h-0 flex-col bg-chrome" aria-label="Projects and sessions">
      <div className="h-9 shrink-0 [-webkit-app-region:drag]" aria-hidden />
      <div className="flex flex-col gap-2 px-2 pb-2">
        <Button variant="secondary" className="justify-start font-normal text-muted-foreground" onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE))}>
          <Search />Jump to…<kbd className="ml-auto font-mono text-[11px]">⌘K</kbd>
        </Button>
        <div className="relative">
          <Search className="pointer-events-none absolute top-2 left-2 size-3.5 text-muted-foreground" />
          <Input className="pl-7" value={q} onChange={(e) => search(e.target.value)} placeholder="Search all sessions" aria-label="Search all sessions" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {q.trim() && (
          <section aria-label="Search results">
            <Label>Search results</Label>
            {hits.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">No matches</div>}
            {hits.map((h, i) => {
              const at = Math.max(0, h.text.toLowerCase().indexOf(q.trim().toLowerCase()) - 20)
              return (
                <Row key={i} onClick={() => actions.select(h.sessionId)}>
                  <div className="truncate font-medium">{title(h.sessionId)}</div>
                  <div className="truncate text-xs text-muted-foreground">…{h.text.slice(at, at + 80)}</div>
                </Row>
              )
            })}
          </section>
        )}
        {needs.length > 0 && (
          <section aria-label="Needs you">
            <Label>Needs you</Label>
            {needs.map((s) => <SessionRow key={s.id} s={s} active={s.id === selectedId} />)}
          </section>
        )}
        {projects.map((p) => (
          <section key={p.id} aria-label={p.name}>
            <div className="flex items-center gap-1 px-2 pt-3 pb-1">
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">{p.name}</span>
              <Tip label="New session"><Button variant="ghost" size="icon" className="size-6" onClick={() => actions.openNew(p.id)} aria-label={`New session in ${p.name}`}><Plus /></Button></Tip>
              <Tip label="Import history / MCP"><Button variant="ghost" size="icon" className="size-6" onClick={() => actions.openTools(p.id)} aria-label={`Import history and MCP for ${p.name}`}><History /></Button></Tip>
            </div>
            {(sessions[p.id] ?? []).map((s) => <SessionRow key={s.id} s={s} active={s.id === selectedId} />)}
          </section>
        ))}
      </div>
      <div className="flex items-center gap-0.5 p-2">
        <Tip label="Add project"><Button variant="ghost" size="icon" aria-label="Add project" onClick={() => void actions.addProject()}><FolderPlus /></Button></Tip>
        <Tip label="Grid view"><Button variant="ghost" size="icon" aria-label="Grid view" onClick={actions.toggleGrid}><LayoutGrid /></Button></Tip>
        <Tip label="Settings"><Button variant="ghost" size="icon" aria-label="Settings" onClick={actions.openSettings}><Settings /></Button></Tip>
      </div>
    </nav>
  )
}
