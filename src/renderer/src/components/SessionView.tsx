import { useEffect, useRef, useState } from 'react'
import { ArrowDown, Check, GitCompare, GitFork, PanelRight, MoreHorizontal, Archive, Pencil, SquareTerminal as TerminalIcon, Undo2, User } from 'lucide-react'
import { actions, useStore } from '../store'
import { ConfirmDialog } from './ui/dialog'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger } from './ui/menu'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { STARTERS } from '../lib/starters'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Tip } from './ui/tooltip'
import type { Checkpoint } from '../../../main/git'
import { hasAccounts } from '../../../shared/types'
import type { SessionInfo } from '../../../shared/ipc'
import { appendEvent, buildItems, groupSteps, type ChatEvent } from '../chatItems'
import ApprovalCard from './ApprovalCard'
import DiffPanel from './DiffPanel'
import Composer from './Composer'
import Thinking from './Thinking'
import EventRow, { Steps, TurnResult } from './EventRow'
import RewindDialog from './RewindDialog'
import { SESSION_EVENT, type SessionCommand } from '../lib/shortcuts'
import { Loading } from './ui/field'
import StatusBadge from './StatusBadge'
import Avatar from './Avatar'
import Terminal from './Terminal'
import { useChanges } from '../lib/useChanges'

/** Label of the latest tool call, e.g. "Editing Composer.tsx"; undefined until one runs. */
const liveStep = (items: ChatEvent[]): string | undefined => {
  const t = items.findLast((e) => e.type === 'tool_call' || e.type === 'file_change')
  if (!t) return undefined
  if (t.type === 'file_change') return `Editing ${t.path.split('/').pop()}`
  if (t.type !== 'tool_call') return undefined
  const i = (t.input ?? {}) as Record<string, unknown>
  const target = String(i.file_path ?? i.path ?? i.command ?? i.pattern ?? i.url ?? '').split('/').pop()
  return target ? `${t.name} ${target.slice(0, 60)}` : t.name
}

const MIN_W = 320
const MAX_W = 640

export default function SessionView({ session }: { session: SessionInfo }): React.JSX.Element {
  const [items, setItems] = useState<ChatEvent[]>([])
  const [tab, setTab] = useState<'diff' | 'terminal'>('diff')
  const [panel, setPanel] = useState(() => localStorage.getItem('panel') === '1')
  const [width, setWidth] = useState(() => Math.min(MAX_W, Number(localStorage.getItem('panelW')) || 480))
  const resize = (w: number): void => {
    const v = Math.min(MAX_W, Math.max(MIN_W, Math.round(w)))
    setWidth(v)
    localStorage.setItem('panelW', String(v))
  }
  const togglePanel = (): void => { localStorage.setItem('panel', panel ? '0' : '1'); setPanel(!panel) }
  // Closed until the agent changes files; a manual toggle (stored) wins from then on.
  const changes = useChanges(session)
  useEffect(() => { if (changes.files > 0 && localStorage.getItem('panel') === null) setPanel(true) }, [changes.files])
  const end = useRef<HTMLDivElement>(null)
  const [atEnd, setAtEnd] = useState(true)
  const id = session.id
  const { accounts, projects, seen } = useStore()
  const since = useRef(seen[session.id]).current // when you last left this chat: what arrived after is new
  const [loaded, setLoaded] = useState(false)
  const project = projects.find((p) => p.id === session.projectId)
  const [usage, setUsage] = useState('')
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [rewind, setRewind] = useState<Checkpoint | null>(null)
  const [dlg, setDlg] = useState<'rename' | 'archive' | null>(null)
  const [name, setName] = useState(session.title)
  useEffect(() => {
    window.api.sessionUsage(id).then((u) => { const n = u.inputTokens + u.outputTokens; setUsage(`${n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n} tokens · ~$${u.costUsd.toFixed(2)}`) }, () => {})
  }, [id, session.status])

  useEffect(() => {
    setItems([])
    setLoaded(false)
    const buffered: ChatEvent[] = []
    let loaded = false
    const off = window.api.onEvent((sid, e) => {
      if (sid !== id) return
      if (loaded) setItems((it) => appendEvent(it, e))
      else buffered.push(e as ChatEvent)
    })
    window.api.getEvents(id).then((evs) => {
      loaded = true
      setLoaded(true)
      // Events that arrived during the fetch may already be in the log; accept rare duplicates.
      setItems(buffered.reduce(appendEvent, buildItems(evs)))
    })
    return off
  }, [id])

  // Follow new output only while the user is at the bottom; don't yank them back after they scroll up.
  useEffect(() => { if (atEnd) end.current?.scrollIntoView({ block: 'end' }) }, [items]) // eslint-disable-line react-hooks/exhaustive-deps

  const busy = session.status === 'working'
  const run = useRef<(c: SessionCommand) => void>(() => {})
  run.current = (c) => {
    if (c === 'panel') togglePanel()
    else if (c === 'rename') { setName(session.title); setDlg('rename') }
    else if (c === 'archive') setDlg('archive')
    else window.api.listCheckpoints(id).then((cks) => {
      const ck = cks.filter((x) => x.label !== 'Before rewind').at(-1)
      if (!ck) throw new Error('No checkpoint to rewind to')
      setRewind(ck)
    }).catch(actions.fail)
  }
  useEffect(() => {
    const on = (e: Event): void => run.current((e as CustomEvent<SessionCommand>).detail)
    const key = (e: KeyboardEvent): void => { if (e.metaKey && !e.shiftKey && !e.altKey && e.key === '\\') { e.preventDefault(); run.current('panel') } }
    window.addEventListener(SESSION_EVENT, on)
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener(SESSION_EVENT, on); window.removeEventListener('keydown', key) }
  }, [])
  const grouped = groupSteps(items)
  const firstNew = since ? grouped.findIndex((e) => e.type === 'message' && e.role === 'assistant' && (e.ts ?? 0) > since) : -1
  const lastUser = items.findLast((e) => e.type === 'message' && e.role === 'user')
  const retry = lastUser?.type === 'message' && !busy ? () => { window.api.sendMessage(id, lastUser.text).catch(actions.fail) } : undefined
  const meta = [session.branch, session.model ?? 'default model', session.permissionMode, usage].filter(Boolean).join(' · ')
  const mine = accounts.filter((a) => a.provider === session.provider)
  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <Avatar seed={session.id} avatar={session.avatar} size={24} />
        <Tip label={meta}>
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="min-w-0 truncate text-body font-medium">{session.title}</h1>
            <span className="hidden shrink-0 truncate text-small text-muted-foreground lg:inline">{[project?.name, session.branch, session.model].filter(Boolean).join(' · ')}</span>
          </div>
        </Tip>
        <div className="ml-auto flex items-center gap-1">
        {(session.status === 'needs-you' || session.status === 'error') && <StatusBadge status={session.status} />}
        <Tip label={panel ? 'Hide changes and terminal' : 'Show changes and terminal'} kbd="⌘\\"><Button variant="ghost" size="icon" aria-label="Toggle side panel" aria-pressed={panel} onClick={togglePanel}><PanelRight /></Button></Tip>
        <Menu onOpenChange={(o) => o && window.api.listCheckpoints(id).then(setCheckpoints, actions.fail)}>
          <Tip label="Session actions"><MenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Session actions"><MoreHorizontal /></Button></MenuTrigger></Tip>
          <MenuContent>
            <MenuItem onSelect={() => { setName(session.title); setDlg('rename') }}><Pencil />Rename</MenuItem>
            <MenuItem onSelect={() => void actions.fork(session)}><GitFork />Fork into new session</MenuItem>
            {hasAccounts(session.provider) && (
              <MenuSub>
                <MenuSubTrigger disabled={busy}><User />Move to account</MenuSubTrigger>
                <MenuSubContent>
                  {[{ id: '', label: 'Default login' }, ...mine].map((a) => (
                    <MenuItem key={a.id} onSelect={() => window.api.moveSession(id, a.id || null).then(actions.upsertSession, actions.fail)}>
                      {a.label}{(session.accountId ?? '') === a.id && <Check className="ml-auto" />}
                    </MenuItem>
                  ))}
                </MenuSubContent>
              </MenuSub>
            )}
            <MenuSub>
              <MenuSubTrigger disabled={busy}><Undo2 />Rewind files</MenuSubTrigger>
              <MenuSubContent>
                {checkpoints.length === 0 && <MenuLabel>No checkpoints yet</MenuLabel>}
                {[...checkpoints].reverse().map((c) => <MenuItem key={c.id} onSelect={() => setRewind(c)}>{c.label.slice(0, 60)}</MenuItem>)}
              </MenuSubContent>
            </MenuSub>
            <MenuItem onSelect={() => setDlg('archive')}><Archive />Archive</MenuItem>
          </MenuContent>
        </Menu>
        </div>
      </header>
      <RewindDialog sessionId={id} checkpoint={rewind} onClose={() => setRewind(null)} />
      <ConfirmDialog
        open={dlg === 'rename'} onOpenChange={(o) => !o && setDlg(null)} confirmLabel="Rename"
        title="Rename session" description="Shown in the sidebar and palette." onConfirm={() => void actions.rename(id, name)}
      >
        <label className="flex flex-col gap-1 text-small text-muted-foreground">Name
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      </ConfirmDialog>
      <ConfirmDialog
        open={dlg === 'archive'} onOpenChange={(o) => !o && setDlg(null)} destructive confirmLabel="Archive"
        title="Archive session?" description="It leaves the sidebar. The worktree and its files stay on disk."
        onConfirm={() => void actions.archive(session)}
      />
      <div className="flex min-h-0 flex-1">
        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Chat">
          <div className="flex min-h-0 flex-1 flex-col gap-3 no-scrollbar overflow-y-auto px-6 py-6 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[800px]" role="log" aria-label="Conversation" onScroll={(e) => { const t = e.currentTarget; setAtEnd(t.scrollHeight - t.scrollTop - t.clientHeight < 48) }}>
            {!loaded && <Loading>Loading conversation…</Loading>}
            {loaded && items.length === 0 && (
              <div className="flex flex-col gap-3 py-8">
                <p className="text-small text-muted-foreground">{[session.model ?? 'Default model', session.permissionMode, session.branch].filter(Boolean).join(' · ')}</p>
                <div className="flex flex-col gap-1">
                  {STARTERS.map((s) => <button key={s.title} type="button" onClick={() => window.api.sendMessage(id, s.prompt).catch(actions.fail)} className="flex items-baseline gap-2 rounded-md px-3 py-2 text-left transition-colors duration-100 hover:bg-accent"><span className="text-body font-medium">{s.title}</span><span className="text-small text-muted-foreground">{s.hint}</span></button>)}
                </div>
              </div>
            )}
            {grouped.map((e, i) => [
              i === firstNew && <div key="new" role="separator" aria-label="New messages" className="flex items-center gap-3 text-meta font-medium text-link"><span className="h-px flex-1 bg-link/40" />New<span className="h-px flex-1 bg-link/40" /></div>,
              e.type === 'steps' ? (
                <Steps key={i} steps={e.steps} />
              ) : e.type === 'approval_request' ? (
                <ApprovalCard key={e.id} sessionId={id} {...e} />
              ) : (
                <EventRow key={i} e={e} session={session} onRetry={retry} onFork={(ts) => void actions.fork(session, ts)} />
              )
            ])}
            {!busy && (session.status === 'done' || session.status === 'idle') && items.length > 0 && <TurnResult session={session} onView={() => { setTab('diff'); if (!panel) togglePanel() }} />}
            {busy && <Thinking step={liveStep(items)} />}
            <div ref={end} />
          </div>
          <div className="relative">
            {!atEnd && (
              <Tip label="Scroll to latest"><Button variant="outline" size="icon" className="absolute -top-10 left-1/2 -translate-x-1/2 bg-overlay" aria-label="Scroll to latest" onClick={() => end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })}><ArrowDown /></Button></Tip>
            )}
            <Composer session={session} usage={usage} />
          </div>
        </section>
        {panel && (
          <>
            <div
              role="separator" aria-orientation="vertical" aria-label="Resize side panel" tabIndex={0}
              aria-valuenow={width} aria-valuemin={MIN_W} aria-valuemax={MAX_W}
              className="relative w-px shrink-0 cursor-col-resize bg-border transition-colors before:absolute before:inset-y-0 before:-inset-x-1 focus-visible:bg-ring"
              onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
              onPointerMove={(e) => e.buttons === 1 && resize(window.innerWidth - e.clientX)}
              onKeyDown={(e) => { if (e.key === 'ArrowLeft') resize(width + 24); else if (e.key === 'ArrowRight') resize(width - 24) }}
            />
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex min-h-0 shrink-0 flex-col border-l-0 bg-background" style={{ width }}>
              <TabsList>
                <TabsTrigger value="diff"><GitCompare />Changes</TabsTrigger>
                <TabsTrigger value="terminal"><TerminalIcon />Terminal</TabsTrigger>
              </TabsList>
              <TabsContent value="diff"><DiffPanel sessionId={id} status={session.status} /></TabsContent>
              <TabsContent value="terminal"><Terminal sessionId={id} /></TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </>
  )
}
