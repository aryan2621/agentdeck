import { useEffect, useRef, useState } from 'react'
import { Check, ChevronRight, FolderPlus, Loader2, X, SquarePen, History, Plus, Search, Settings, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { actions, currentProjectId, findSession, useStore } from '../store'
import Avatar, { ProjectAvatar } from './Avatar'
import { Stat } from './Diff'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Kbd } from './ui/kbd'
import Limits from './Limits'
import { FOCUS_SEARCH } from '../lib/shortcuts'
import { Tip } from './ui/tooltip'
import { Row } from './ui/row'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'
import { stamp } from '../lib/ago'
import { cn } from '../lib/utils'
import { useChanges } from '../lib/useChanges'
import type { SessionInfo } from '../../../shared/ipc'

const hit = (t: string, q: string): React.ReactNode => {
  const i = t.toLowerCase().indexOf(q.toLowerCase())
  return i < 0 ? t : <>{t.slice(0, i)}<mark className="rounded-sm bg-warn/20 text-foreground">{t.slice(i, i + q.length)}</mark>{t.slice(i + q.length)}</>
}

const Label = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <div className="px-2 pt-3 pb-1 text-small text-faint">{children}</div>
)

const MARK: Partial<Record<SessionInfo['status'], { label: string; el: React.ReactNode }>> = {
  'needs-you': { label: 'Needs you', el: <span className="size-2 rounded-full bg-needs" /> },
  working: { label: 'Working', el: <Loader2 className="size-3 animate-spin text-foreground" /> },
  error: { label: 'Error', el: <X className="size-3 text-destructive" /> },
  done: { label: 'Done', el: <Check className="size-3 text-faint" /> }
}
/** Status beside the title (not over the avatar): icon + label for assistive tech, never colour alone. */
const StatusMark = ({ status }: { status: SessionInfo['status'] }): React.JSX.Element | null => {
  const m = MARK[status]
  return m ? <span role="img" aria-label={m.label} className="flex shrink-0 items-center">{m.el}</span> : null
}

const SessionRow = ({ s, active }: { s: SessionInfo; active: boolean }): React.JSX.Element => {
  const c = useChanges(s)
  const { previews, unread } = useStore()
  return (
    <Row active={active} onClick={() => actions.select(s.id)} className="items-center gap-2 rounded-md py-1">
      <Avatar seed={s.id} avatar={s.avatar} size={24} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1.5">
          <span className="min-w-0 truncate text-body font-medium text-foreground">{s.title}</span>
          <StatusMark status={s.status} />
          <span className="ml-auto shrink-0 text-meta text-faint">{stamp(s.createdAt)}</span>
        </div>
        {(previews[s.id] || c.add > 0 || c.del > 0 || unread[s.id]) && (
          <div className="flex items-center gap-2 text-small text-muted-foreground">
            <span className="min-w-0 flex-1 truncate">{previews[s.id]}</span>
            {(c.add > 0 || c.del > 0) && <Stat add={c.add} del={c.del} />}
            {unread[s.id] && <span role="img" aria-label="Unread" className="size-2 shrink-0 rounded-full bg-link" />}
          </div>
        )}
      </div>
    </Row>
  )
}

type Filter = 'all' | 'needs-you' | 'working'
const FILTERS: { id: Filter; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'needs-you', label: 'Needs you' }, { id: 'working', label: 'Running' }]

const Round = ({ label, kbd, children, ...p }: { label: string; kbd?: string } & React.ComponentProps<typeof Button>): React.JSX.Element => (
  <Tip label={label} kbd={kbd}><Button variant="outline" size="icon" className="size-8 rounded-md" aria-label={label} {...p}>{children}</Button></Tip>
)

/** Collapsed (⌘B): avatars only, one 44px tile per session. */
function Rail({ onNew }: { onNew: React.ReactNode }): React.JSX.Element {
  const rs = useStore()
  const { projects, sessions, selectedId } = rs
  const current = currentProjectId(rs)
  return (
    <nav className="flex min-h-0 flex-col items-center bg-chrome" aria-label="Sessions">
      <div className="h-12 w-full shrink-0 [-webkit-app-region:drag]" aria-hidden />
      <div className="flex flex-col gap-2">{onNew}</div>
      <div className="mt-3 flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-2 pb-2">
        {projects.map((p, i) => (
          <div key={p.id} className={cn('flex w-full flex-col items-center gap-1', i > 0 && 'mt-1 border-t border-border pt-2')}>
            <Tip label={p.name}><Row active={p.id === current} onClick={() => actions.openTools(p.id)} aria-label={p.name} className="size-9 items-center justify-center rounded-md p-0"><ProjectAvatar name={p.name} size={24} /></Row></Tip>
            {(sessions[p.id] ?? []).map((s) => (
              <Tip key={s.id} label={s.title}>
                <Row active={s.id === selectedId} onClick={() => actions.select(s.id)} aria-label={s.title} className="size-11 items-center justify-center rounded-md p-0"><Avatar seed={s.id} avatar={s.avatar} status={s.status} size={32} /></Row>
              </Tip>
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 p-2">
        <Round label="Expand sidebar" kbd="⌘B" variant="ghost" onClick={actions.toggleSidebar}><PanelLeftOpen /></Round>
        <Round label="Settings" variant="ghost" onClick={() => actions.openSettings()}><Settings /></Round>
      </div>
    </nav>
  )
}

export default function Sidebar({ rail = false }: { rail?: boolean }): React.JSX.Element {
  const state = useStore()
  const { projects, sessions, selectedId, accounts } = state
  const [q, setQ] = useState('')
  const field = useRef<HTMLInputElement>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const show = (list: SessionInfo[]): SessionInfo[] => (filter === 'all' ? list : list.filter((s) => s.status === filter))
  const [hits, setHits] = useState<{ sessionId: string; text: string }[]>([])
  const all = Object.values(sessions).flat()
  const pinned = all.filter((s) => s.status === 'needs-you' || s.status === 'working')
  const title = (id: string): string => all.find((s) => s.id === id)?.title ?? id
  const search = (v: string): void => {
    setQ(v)
    window.api.searchSessions(v).then(setHits, actions.fail)
  }
  // ⌘F / palette "Search sessions": expand the rail if needed, then focus the box once it exists.
  useEffect(() => {
    const go = (): void => { if (rail) actions.toggleSidebar(); setTimeout(() => field.current?.focus(), 50) }
    window.addEventListener(FOCUS_SEARCH, go)
    return () => window.removeEventListener(FOCUS_SEARCH, go)
  }, [rail])
  const newIn = (): string => (findSession(state, selectedId)?.projectId ?? projects[0]?.id) as string
  const plus = (
    <>
      <Round label="New session" kbd="⌘N" disabled={!projects.length} onClick={() => actions.openNew(newIn())}><SquarePen /></Round>
      <Round label="Add project" onClick={() => void actions.addProject()}><FolderPlus /></Round>
    </>
  )
  if (rail) return <Rail onNew={plus} />
  const account = accounts[0] ? `${accounts[0].provider} · ${accounts[0].label}` : 'Default login'
  return (
    <nav className="flex min-h-0 flex-col bg-chrome" aria-label="Projects and sessions">
      <div className="flex h-14 shrink-0 items-center gap-2 px-3">
        <div className="h-full min-w-20 flex-1 [-webkit-app-region:drag]" aria-hidden />
        {plus}
      </div>
      <div className="flex flex-col gap-2 px-3 pb-2">
        <label className="relative block">
          <span className="sr-only">Search sessions</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint" />
          <Input ref={field} aria-keyshortcuts="Meta+F" value={q} onChange={(e) => search(e.target.value)} placeholder="Search" className="h-8 rounded-md border-transparent bg-muted pr-10 pl-8" />
          {!q && <Kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2" aria-hidden>⌘F</Kbd>}
        </label>
        {(pinned.length > 0 || q || filter !== 'all') && (
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList aria-label="Filter sessions" className="p-0">
              {FILTERS.map((f) => <TabsTrigger key={f.id} value={f.id}>{f.label}</TabsTrigger>)}
            </TabsList>
          </Tabs>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-2 pb-2">
        {projects.length === 0 && (
          <div className="px-2 py-1 text-small text-muted-foreground">No projects yet. Add one with the folder button below.</div>
        )}
        {q.trim() && (
          <section aria-label="Search results">
            <Label>Search results</Label>
            {hits.length === 0 && <div className="px-2 py-1 text-small text-muted-foreground">No matches</div>}
            {hits.map((h, i) => {
              const at = Math.max(0, h.text.toLowerCase().indexOf(q.trim().toLowerCase()) - 20)
              return (
                <Row key={i} onClick={() => actions.select(h.sessionId)} className="items-center gap-3 rounded-md py-1">
                  <Avatar seed={h.sessionId} avatar={all.find((x) => x.id === h.sessionId)?.avatar} size={24} />
                  <div className="flex min-w-0 flex-col">
                    <div className="truncate font-medium">{title(h.sessionId)}</div>
                    <div className="truncate text-small text-muted-foreground">…{hit(h.text.slice(at, at + 80), q.trim())}</div>
                  </div>
                </Row>
              )
            })}
          </section>
        )}
        {filter === 'all' && !q.trim() && pinned.length > 0 && (
          <section aria-label="Needs you and running" className="pb-1">
            <Label>Active <span className="tnum">{pinned.length}</span></Label>
            {pinned.map((s) => <SessionRow key={s.id} s={s} active={s.id === selectedId} />)}
          </section>
        )}
        {projects.length === 0 && <div className="px-2 py-10 text-center text-body text-muted-foreground">No sessions yet</div>}
        {projects.map((p) => {
          const list = show(sessions[p.id] ?? []).filter((x) => filter !== 'all' || q.trim() || !pinned.some((t) => t.id === x.id))
          if (list.length === 0 && (filter !== 'all' || q.trim())) return null
          const open = !closed[p.id]
          return (
            <section key={p.id} aria-label={p.name}>
              <div className="group/head flex items-center gap-1 pt-3 pb-1.5">
                <Row onClick={() => setClosed({ ...closed, [p.id]: open })} aria-expanded={open} className="min-w-0 flex-1 items-center gap-2 rounded-md py-2 text-small font-medium text-muted-foreground">
                  <ProjectAvatar name={p.name} size={16} /><span className="min-w-0 truncate">{p.name}</span>
                  {list.length > 0 && <span className="tnum text-meta font-normal text-faint">{list.length}</span>}
                  <ChevronRight className={cn('size-3 shrink-0 text-faint transition-transform duration-100', open && 'rotate-90', open && 'opacity-0 group-focus-within/head:opacity-100 group-hover/head:opacity-100')} aria-hidden />
                </Row>
                <div className="flex opacity-0 transition-opacity duration-100 group-focus-within/head:opacity-100 group-hover/head:opacity-100">
                  <Tip label="New session"><Button variant="ghost" size="icon" className="size-6" onClick={() => actions.openNew(p.id)} aria-label={`New session in ${p.name}`}><Plus /></Button></Tip>
                  <Tip label="Import history / MCP"><Button variant="ghost" size="icon" className="size-6" onClick={() => actions.openTools(p.id)} aria-label={`Import history and MCP for ${p.name}`}><History /></Button></Tip>
                </div>
              </div>
              {open && list.map((s) => <SessionRow key={s.id} s={s} active={s.id === selectedId} />)}
            </section>
          )
        })}
      </div>
      <div className="flex flex-col gap-0.5 border-t border-border p-2">
        <div className="flex items-center gap-1">
          <Row onClick={() => actions.openSettings('Accounts')} className="min-w-0 flex-1 items-center gap-3 rounded-md py-2 text-foreground">
            <span className="truncate">{account}</span>
          </Row>
          <Round label="Collapse sidebar" kbd="⌘B" variant="ghost" className="size-8 border-0" onClick={actions.toggleSidebar}><PanelLeftClose /></Round>
          <Round label="Settings" variant="ghost" className="size-8 border-0" onClick={() => actions.openSettings()}><Settings /></Round>
        </div>
        <Limits compact />
      </div>
    </nav>
  )
}
