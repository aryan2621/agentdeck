import { useEffect, useRef, useState } from 'react'
import { Check, GitCompare, GitFork, PanelRight, MoreHorizontal, Archive, Pencil, Sparkles, SquareTerminal as TerminalIcon, Undo2, User } from 'lucide-react'
import { actions, useStore } from '../store'
import { ConfirmDialog } from './ui/dialog'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger } from './ui/menu'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Empty } from './ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Tip } from './ui/tooltip'
import type { Checkpoint } from '../../../main/git'
import { hasAccounts } from '../../../shared/types'
import type { SessionInfo } from '../../../shared/ipc'
import { appendEvent, buildItems, groupSteps, type ChatEvent } from '../chatItems'
import ApprovalCard from './ApprovalCard'
import DiffPanel from './DiffPanel'
import Composer from './Composer'
import EventRow, { Steps } from './EventRow'
import StatusBadge from './StatusBadge'
import Terminal from './Terminal'

const MIN_W = 320
const MAX_W = 960

export default function SessionView({ session }: { session: SessionInfo }): React.JSX.Element {
  const [items, setItems] = useState<ChatEvent[]>([])
  const [tab, setTab] = useState<'diff' | 'terminal'>('diff')
  const [panel, setPanel] = useState(() => localStorage.getItem('panel') !== '0')
  const [width, setWidth] = useState(() => Number(localStorage.getItem('panelW')) || 480)
  const resize = (w: number): void => {
    const v = Math.min(MAX_W, Math.max(MIN_W, Math.round(w)))
    setWidth(v)
    localStorage.setItem('panelW', String(v))
  }
  const togglePanel = (): void => { localStorage.setItem('panel', panel ? '0' : '1'); setPanel(!panel) }
  const end = useRef<HTMLDivElement>(null)
  const id = session.id
  const { accounts } = useStore()
  const [usage, setUsage] = useState('')
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [rewind, setRewind] = useState<Checkpoint | null>(null)
  const [dlg, setDlg] = useState<'rename' | 'archive' | null>(null)
  const [name, setName] = useState(session.title)
  useEffect(() => {
    window.api.sessionUsage(id).then((u) => setUsage(`${u.inputTokens + u.outputTokens} tokens, $${u.costUsd.toFixed(2)}`), () => {})
  }, [id, session.status])

  useEffect(() => {
    setItems([])
    const buffered: ChatEvent[] = []
    let loaded = false
    const off = window.api.onEvent((sid, e) => {
      if (sid !== id) return
      if (loaded) setItems((it) => appendEvent(it, e))
      else buffered.push(e as ChatEvent)
    })
    window.api.getEvents(id).then((evs) => {
      loaded = true
      // Events that arrived during the fetch may already be in the log; accept rare duplicates.
      setItems(buffered.reduce(appendEvent, buildItems(evs)))
    })
    return off
  }, [id])

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [items])

  const busy = session.status === 'working'
  const meta = [session.branch, session.model ?? 'default model', session.permissionMode, usage].filter(Boolean).join(' · ')
  const mine = accounts.filter((a) => a.provider === session.provider)
  return (
    <>
      <header className="flex h-10 shrink-0 items-center gap-3 border-b border-border px-4">
        <h1 className="min-w-0 truncate text-sm font-semibold">{session.title}</h1>
        <Tip label={meta}><span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{session.branch ?? session.provider}</span></Tip>
        <StatusBadge status={session.status} />
        <Tip label={panel ? 'Hide side panel' : 'Show side panel'}><Button variant="ghost" size="icon" aria-label="Toggle side panel" aria-pressed={panel} onClick={togglePanel}><PanelRight /></Button></Tip>
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
      </header>
      <ConfirmDialog
        open={!!rewind} onOpenChange={(o) => !o && setRewind(null)} destructive confirmLabel="Restore files"
        title="Rewind files?" description={`Restore files to before "${rewind?.label.slice(0, 80) ?? ''}". Chat history and agent memory are not changed.`}
        onConfirm={() => rewind && window.api.rewindSession(id, rewind.id).catch(actions.fail)}
      />
      <ConfirmDialog
        open={dlg === 'rename'} onOpenChange={(o) => !o && setDlg(null)} confirmLabel="Rename"
        title="Rename session" description="Shown in the sidebar and palette." onConfirm={() => void actions.rename(id, name)}
      >
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Name
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      </ConfirmDialog>
      <ConfirmDialog
        open={dlg === 'archive'} onOpenChange={(o) => !o && setDlg(null)} destructive confirmLabel="Archive"
        title="Archive session?" description="It leaves the sidebar. The worktree and its files stay on disk."
        onConfirm={() => void actions.archive(session)}
      />
      <div className="flex min-h-0 flex-1">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Chat">
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-6 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[720px]" role="log" aria-label="Conversation">
            {items.length === 0 && <Empty icon={Sparkles}>Send a message to get started.</Empty>}
            {groupSteps(items).map((e, i) =>
              e.type === 'steps' ? (
                <Steps key={i} steps={e.steps} />
              ) : e.type === 'approval_request' ? (
                <ApprovalCard key={e.id} sessionId={id} {...e} />
              ) : (
                <EventRow key={i} e={e} />
              )
            )}
            {busy && <p className="shimmer text-[13px]" role="status">Working…</p>}
            <div ref={end} />
          </div>
          <Composer sessionId={id} status={session.status} />
        </section>
        {panel && (
          <>
            <div
              role="separator" aria-orientation="vertical" aria-label="Resize side panel" tabIndex={0}
              aria-valuenow={width} aria-valuemin={MIN_W} aria-valuemax={MAX_W}
              className="relative w-px shrink-0 cursor-col-resize bg-border transition-colors before:absolute before:inset-y-0 before:-inset-x-1 hover:bg-primary focus-visible:bg-primary"
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
