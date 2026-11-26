import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BarChart3, ChevronDown, Layers, FolderPlus, Home, SquarePen, Plus, Search, Settings, PanelLeftClose, PanelLeftOpen, MoreHorizontal, SlidersHorizontal, Trash2, GitBranch, EyeOff, CircleHelp, Keyboard, BookOpen, Bug } from 'lucide-react'
import { actions, currentProjectId, findSession, useStore } from '../../state/store'
import Avatar, { ProjectAvatar } from '../../components/Avatar'
import { Stat } from '../review/Diff'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { FOCUS_SEARCH } from '../../lib/shortcuts'
import { Row } from '../../components/ui/row'
import { applyOrder, moveInOrder } from '../../lib/order'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '../../components/ui/menu'
import { ConfirmDialog } from '../../components/ui/dialog'
import CreateFromDialog from './CreateFromDialog'
import type { ProjectInfo } from '../../../../shared/ipc'
import { cn } from '../../lib/utils'
import { useChanges } from '../../lib/useChanges'
import type { SessionInfo } from '../../../../shared/ipc'

const hit = (t: string, q: string): React.ReactNode => {
  const i = t.toLowerCase().indexOf(q.toLowerCase())
  return i < 0 ? t : <>{t.slice(0, i)}<mark className="rounded-sm bg-warn/20 text-foreground">{t.slice(i, i + q.length)}</mark>{t.slice(i + q.length)}</>
}

/** Projects not hidden from the sidebar (Settings lists the hidden ones). */
const useVisible = (): ProjectInfo[] => { const { projects, settings } = useStore(); return projects.filter((p) => !settings.hiddenProjects.includes(p.id)) }

const DOCS = 'https://github.com/agentdeck/agentdeck'

const Label = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <div className="px-2 pt-1 pb-1 text-small font-medium text-faint">{children}</div>
)

const SessionRow = ({ s, active, tab, onFocus, siblings }: { s: SessionInfo; active: boolean; tab: boolean; onFocus: () => void; siblings: SessionInfo[] }): React.JSX.Element => {
  const c = useChanges(s)
  const { unread, settings, previews } = useStore()
  const preview = previews[s.id]
  const move = (dir: -1 | 1): void => void actions.saveSettings({ sessionOrder: moveInOrder(siblings.map((x) => x.id), s.id, dir).concat(settings.sessionOrder.filter((id) => !siblings.some((x) => x.id === id))) })
  return (
    <Row active={active} tabIndex={tab ? 0 : -1} onFocus={onFocus} onClick={() => actions.select(s.id)} className="min-h-9 items-center gap-2 py-1.5 pl-5">
      <Avatar seed={s.id} avatar={s.avatar} status={s.status} size={16} animate={active} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('truncate text-foreground', unread[s.id] ? 'font-semibold' : 'font-medium')}>{s.title}</span>
        {preview && <span className="truncate text-meta text-muted-foreground">{preview}</span>}
      </span>
      {unread[s.id] && <><span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary" /><span className="sr-only">Unread</span></>}
      {settings.sidebarDiffs && (c.add > 0 || c.del > 0) && <Stat add={c.add} del={c.del} />}
      {settings.arrangeManually && (
        <span className="flex" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="size-5" aria-label={`Move ${s.title} up`} onClick={() => move(-1)}><ArrowUp /></Button>
          <Button variant="ghost" size="icon" className="size-5" aria-label={`Move ${s.title} down`} onClick={() => move(1)}><ArrowDown /></Button>
        </span>
      )}
    </Row>
  )
}

const Round = ({ label, children, ...p }: { label: string } & React.ComponentProps<typeof Button>): React.JSX.Element => (
  <Button variant="outline" size="icon" className="size-8 rounded-md" aria-label={label} {...p}>{children}</Button>
)

/** Collapsed (⌘B): avatars only, one 44px tile per session. */
function Rail({ onNew }: { onNew: React.ReactNode }): React.JSX.Element {
  const rs = useStore()
  const projects = useVisible()
  const { sessions, selectedId } = rs
  const ordered = (id: string): SessionInfo[] => (rs.settings.arrangeManually ? applyOrder(sessions[id] ?? [], rs.settings.sessionOrder) : sessions[id] ?? [])
  const current = currentProjectId(rs)
  return (
    <nav className="flex min-h-0 flex-col items-center bg-chrome" aria-label="Sessions">
      <div className="h-12 w-full shrink-0 [-webkit-app-region:drag]" aria-hidden />
      <div className="flex flex-col gap-2">
        <Round label="Expand sidebar" variant="ghost" onClick={actions.toggleSidebar}><PanelLeftOpen /></Round>
        {onNew}
      </div>
      <div className="mt-3 flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-2 pb-2">
        {projects.map((p, i) => (
          <div key={p.id} className={cn('flex w-full flex-col items-center gap-1', i > 0 && 'mt-1 border-t border-border pt-2')}>
            <Row active={p.id === current} onClick={() => actions.openSettings('General', p.id)} aria-label={p.name} className="size-9 items-center justify-center rounded-md p-0"><ProjectAvatar name={p.name} size={24} /></Row>
            {ordered(p.id).map((s) => (
                <Row active={s.id === selectedId} onClick={() => actions.select(s.id)} aria-label={s.title} className="size-11 items-center justify-center rounded-md p-0"><Avatar seed={s.id} avatar={s.avatar} status={s.status} size={32} animate={s.id === selectedId} /></Row>
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 p-2">
        <Round label="Settings" variant="ghost" onClick={() => actions.openSettings()}><Settings /></Round>
      </div>

    </nav>
  )
}

export default function Sidebar({ rail = false }: { rail?: boolean }): React.JSX.Element {
  const state = useStore()
  const projects = useVisible()
  const { sessions, selectedId } = state
  const [creatingFrom, setCreatingFrom] = useState<ProjectInfo | null>(null)
  const [q, setQ] = useState('')
  const [removing, setRemoving] = useState<ProjectInfo | null>(null)
  const field = useRef<HTMLInputElement>(null)
  const [searching, setSearching] = useState(false)
  const [closed, setClosed] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem('sidebar-closed') ?? '{}') as Record<string, boolean> } catch { return {} } })
  const [cur, setCur] = useState<string>()
  const [hits, setHits] = useState<{ sessionId: string; text: string }[]>([])
  const ordered = (id: string): SessionInfo[] => (state.settings.arrangeManually ? applyOrder(sessions[id] ?? [], state.settings.sessionOrder) : sessions[id] ?? [])
  const all = Object.values(sessions).flat()
  // Roving tab stop: the last-focused row, else the selected one, else the first.
  const stop = [cur, selectedId ?? undefined].find((id) => id && all.some((x) => x.id === id)) ?? all[0]?.id
  const row = (s: SessionInfo, siblings: SessionInfo[]): React.JSX.Element => <SessionRow key={s.id} s={s} siblings={siblings} active={s.id === selectedId} tab={s.id === stop} onFocus={() => setCur(s.id)} />
  const setOpen = (key: string, open: boolean): void => { const next = { ...closed, [key]: open }; setClosed(next); localStorage.setItem('sidebar-closed', JSON.stringify(next)) }
  /** Sessions started from one prompt (same groupId) collapse under one header, placed where the first member is. */
  const rows = (list: SessionInfo[]): React.ReactNode[] => list.flatMap((s, i) => {
    const members = s.groupId ? list.filter((x) => x.groupId === s.groupId) : []
    if (members.length < 2) return [row(s, list)]
    if (list.findIndex((x) => x.groupId === s.groupId) !== i) return []
    const open = !closed[s.groupId!]
    return [(
      <div key={s.groupId}>
        <div className="flex items-center">
          <Row onClick={() => setOpen(s.groupId!, open)} aria-expanded={open} className="min-h-8 flex-1 items-center gap-2 py-1 text-small text-muted-foreground"><Layers className="size-3.5 text-faint" aria-hidden />{members.length} agents</Row>
          <Button size="sm" variant="ghost" onClick={() => actions.compare(s.groupId!)}>Compare</Button>
        </div>
        {open && <div className="ml-3 border-l border-border pl-1">{members.map((m) => row(m, list))}</div>}
      </div>
    )]
  })
  const title = (id: string): string => all.find((s) => s.id === id)?.title ?? id
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const search = (v: string): void => {
    setQ(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => window.api.searchSessions(v).then(setHits, actions.fail), 150)
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  // ↑/↓ move between rows; Tab visits one session row per list.
  const arrows = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const rows = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled])')].filter((b) => b.offsetParent)
    const i = rows.indexOf(document.activeElement as HTMLElement)
    if (i < 0) return
    e.preventDefault()
    rows[Math.min(rows.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus()
  }
  // ⌘F / palette "Search sessions": expand the rail if needed, then focus the box once it exists.
  useEffect(() => {
    const go = (): void => { if (rail) actions.toggleSidebar(); setSearching(true); setTimeout(() => field.current?.focus(), 50) }
    window.addEventListener(FOCUS_SEARCH, go)
    return () => window.removeEventListener(FOCUS_SEARCH, go)
  }, [rail])
  const newIn = (): string => (findSession(state, selectedId)?.projectId ?? projects[0]?.id) as string
  const plus = (
    <>
      <Round label="New session" disabled={!projects.length} onClick={() => actions.openNew(newIn())}><SquarePen /></Round>
      <Round label="Add project" onClick={() => void actions.addProject()}><FolderPlus /></Round>
    </>
  )
  if (rail) return <Rail onNew={plus} />
  const nav = (
    <>
      <Row onClick={actions.home} className="min-h-9 items-center gap-2.5 py-1.5 text-prose text-muted-foreground"><Home className="size-4 text-faint" aria-hidden />Home</Row>
      <Row disabled={!projects.length} onClick={() => actions.openNew(newIn())} className="min-h-9 items-center gap-2.5 py-1.5 text-prose text-muted-foreground"><Plus className="size-4 text-faint" aria-hidden />Create</Row>
    </>
  )
  return (
    <nav className="flex min-h-0 flex-col bg-chrome" aria-label="Projects and sessions">
      {/* Traffic lights sit at the left of this strip; the controls start after them. */}
      <div className="flex h-10 shrink-0 items-center gap-1 pr-2 pl-20 [-webkit-app-region:drag]">
        <Round label="Collapse sidebar" variant="ghost" className="size-8 border-0 [-webkit-app-region:no-drag]" onClick={actions.toggleSidebar}><PanelLeftClose /></Round>
        <span className="flex-1" />
        <Round label="Back" variant="ghost" className="size-8 border-0 [-webkit-app-region:no-drag]" disabled={!state.nav.back} onClick={() => actions.go(-1)}><ArrowLeft /></Round>
        <Round label="Forward" variant="ghost" className="size-8 border-0 [-webkit-app-region:no-drag]" disabled={!state.nav.forward} onClick={() => actions.go(1)}><ArrowRight /></Round>
      </div>
      <div className="flex items-center gap-1 px-2 pb-1">
        <Row onClick={() => actions.openSettings('Account')} className="min-h-9 flex-1 items-center gap-2 py-1.5 text-prose font-medium text-foreground"><span className="min-w-0 truncate">AgentDeck</span><ChevronDown className="size-4 shrink-0 text-faint" aria-hidden /></Row>
        <Round label="Search sessions" variant="ghost" className="size-8 border-0" aria-keyshortcuts="Meta+F" onClick={() => { setSearching(true); setTimeout(() => field.current?.focus(), 0) }}><Search /></Round>
      </div>
      {(searching || q) && (
        <div className="px-3 pb-2">
          <label className="relative block">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint" />
            <Input ref={field} value={q} onChange={(e) => search(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { search(''); setSearching(false) } }} onBlur={() => !q && setSearching(false)} placeholder="Search" className="h-8 rounded-md bg-transparent pl-8" />
          </label>
        </div>
      )}
      <div className="flex flex-col gap-0.5 border-b border-border px-2">{nav}</div>
      <div onKeyDown={arrows} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        <div className="flex items-center pr-0">
          <div className="flex-1"><Label>My workspaces</Label></div>
          <Button variant="ghost" size="icon" className="size-6" aria-label="Add project" onClick={() => void actions.addProject()}><FolderPlus /></Button>
        </div>
        {projects.length === 0 && (
          <div className="px-2 py-1 text-small text-muted-foreground">No projects yet. Add one with the folder button above.</div>
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
        {projects.map((p) => {
          const list = ordered(p.id)
          const open = !closed[p.id]
          return (
            <section key={p.id} aria-label={p.name}>
              <div className="group/head flex items-center gap-1 pt-2 pb-1">
                <Row onClick={() => setOpen(p.id, open)} aria-expanded={open} className="min-w-0 flex-1 items-center gap-2 py-1.5 font-semibold text-foreground">
                  <ProjectAvatar name={p.name} size={20} /><span className="min-w-0 truncate">{p.name}</span>
                </Row>
                <div className="flex">
                  <Menu>
                    <MenuTrigger asChild><Button variant="ghost" size="icon" className="size-6 opacity-0 group-focus-within/head:opacity-100 group-hover/head:opacity-100 data-[state=open]:opacity-100" aria-label={`Options for ${p.name}`}><MoreHorizontal /></Button></MenuTrigger>
                    <MenuContent align="start">
                      <MenuItem onSelect={() => actions.openNew(p.id)}><Plus />Create session</MenuItem>
                      <MenuItem onSelect={() => setCreatingFrom(p)}><GitBranch />Create from…</MenuItem>
                      <MenuItem onSelect={() => actions.openSettings('General', p.id)}><SlidersHorizontal />Configuration</MenuItem>
                      <MenuItem onSelect={() => void actions.saveSettings({ hiddenProjects: [...state.settings.hiddenProjects, p.id] })}><EyeOff />Hide repository</MenuItem>
                      <MenuSeparator />
                      <MenuItem className="text-destructive" onSelect={() => setRemoving(p)}><Trash2 />Remove repository</MenuItem>
                    </MenuContent>
                  </Menu>
                  <Button variant="ghost" size="icon" className="size-6" onClick={() => actions.openNew(p.id)} aria-label={`New session in ${p.name}`}><Plus /></Button>
                </div>
              </div>
              {open && rows(list)}
            </section>
          )
        })}
      </div>
      <div className="flex flex-col gap-2 border-t border-border p-2">
        <div className="flex items-center justify-end gap-1">
        <Menu>
          <MenuTrigger asChild><Button variant="ghost" size="icon" className="mr-auto size-8 border-0" aria-label="Help"><CircleHelp /></Button></MenuTrigger>
          <MenuContent align="start" side="top">
            <MenuItem onSelect={() => actions.openSettings('Keyboard shortcuts')}><Keyboard />Keyboard shortcuts</MenuItem>
            <MenuItem onSelect={() => window.open(`${DOCS}#readme`)}><BookOpen />Documentation</MenuItem>
            <MenuItem onSelect={() => window.open(`${DOCS}/issues/new`)}><Bug />Report an issue</MenuItem>
          </MenuContent>
        </Menu>
        <Round label="Usage" variant="ghost" className="size-8 border-0" onClick={() => actions.openSettings('Usage')}><BarChart3 /></Round>
        <Round label="Settings" variant="ghost" className="size-8 border-0" onClick={() => actions.openSettings()}><Settings /></Round>
        </div>
      </div>
      <CreateFromDialog project={creatingFrom} onClose={() => setCreatingFrom(null)} />
      <ConfirmDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)} destructive title={`Remove ${removing?.name ?? 'repository'}?`} description="The folder and its files stay on disk. Archive its sessions first." confirmLabel="Remove" onConfirm={() => removing && void actions.removeProject(removing.id)} />
    </nav>
  )
}
