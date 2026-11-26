import { PROVIDERS } from '../../../shared/types'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { cn } from '../lib/utils'
import { ArrowDown, Check, ChevronDown, Eye, GitPullRequest, X, GitFork, PanelRight, MoreHorizontal, Archive, Download, Pencil, Undo2, User, ExternalLink, Columns2 } from 'lucide-react'
import { actions, useStore } from '../store'
import { ConfirmDialog } from './ui/dialog'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger } from './ui/menu'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { MODE_LABEL } from '../lib/modes'
import { Input } from './ui/input'
import { STARTERS } from '../lib/starters'
import { Resizer } from './ui/resizer'
import { useChanges } from '../lib/useChanges'
import { AllFiles, Artifacts, Checks } from './ReviewTabs'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
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
import { usePaneActive } from '../lib/pane'
import { SESSION_EVENT, type SessionCommand } from '../lib/shortcuts'
import { Loading } from './ui/field'
import StatusBadge from './StatusBadge'
import Terminal from './Terminal'
import RunTab, { SetupTab } from './RunTab'
import { PROMPTS, withInstructions } from '../lib/prompts'
import { DEFAULT_REPO_PREFS, previewUrl } from '../../../shared/types'
import FileTab, { type DiffScope } from './FileTab'

/** Label of the latest tool call, e.g. "Editing Composer.tsx"; undefined until one runs. */
const BIG_TERM = '__terminal__' // pseudo file tab holding a terminal
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
const MIN_CHAT = 420

export default function SessionView({ session }: { session: SessionInfo }): React.JSX.Element {
  const changes = useChanges(session)
  const [items, setItems] = useState<ChatEvent[]>([])
  const [diffScope, setDiffScope] = useState<DiffScope>('uncommitted')
  const [shipRequest, setShipRequest] = useState(0)
  const [tab, setTab] = useState<'artifacts' | 'files' | 'diff' | 'checks'>('diff')
  const [open, setOpen] = useState<string[]>([])
  const [active, setActive] = useState<string>('chat') // 'chat' | file path
  const openFile = (p: string): void => { setOpen((o) => (o.includes(p) ? o : [...o, p])); setActive(p) }
  const closeTab = (p: string): void => { setOpen((o) => o.filter((x) => x !== p)); setActive((a) => (a === p ? 'chat' : a)) }
  const [drawer, setDrawer] = useState(() => localStorage.getItem('drawer') !== '0')
  const [drawerTab, setDrawerTab] = useState<'setup' | 'run' | 'terminal'>('run')
  const [runCmd, setRunCmd] = useState<string>()
  const toggleDrawer = (): void => { localStorage.setItem('drawer', drawer ? '0' : '1'); setDrawer(!drawer) }
  const inSplit = useStore().split !== null // split panes start without the side panel: two chats need the width
  const [panel, setPanel] = useState(() => !inSplit && localStorage.getItem('panel') !== '0')
  const [width, setWidth] = useState(() => Math.min(MAX_W, Number(localStorage.getItem('panelW')) || 448))
  const resize = (w: number): void => {
    const v = Math.min(MAX_W, Math.max(MIN_W, Math.round(w)))
    setWidth(v)
    localStorage.setItem('panelW', String(v))
  }
  const togglePanel = (): void => { localStorage.setItem('panel', panel ? '0' : '1'); setPanel(!panel) }
  // Open by default; a manual close (stored '0') wins.
  const body = useRef<HTMLDivElement>(null)
  const [bodyW, setBodyW] = useState(Infinity)
  useEffect(() => {
    const el = body.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setBodyW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // Chat would drop under 420px: the panel floats over it instead of squeezing it.
  const overlay = bodyW - width < MIN_CHAT
  const end = useRef<HTMLDivElement>(null)
  const [atEnd, setAtEnd] = useState(true)
  const id = session.id
  const { accounts, projects, seen, sessions, settings, split } = useStore()
  const paneOn = usePaneActive()
  useEffect(() => { // Experimental "Big terminal": ⌘⇧T opens a terminal tab in the centre pane
    if (!settings.bigTerminal) return
    const k = (e: KeyboardEvent): void => { if (paneOn.current && e.metaKey && e.shiftKey && e.key.toLowerCase() === 't') { e.preventDefault(); openFile(BIG_TERM) } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [settings.bigTerminal]) // eslint-disable-line react-hooks/exhaustive-deps
  const [copied, setCopied] = useState(0)
  useEffect(() => { if (session.worktreePath) void window.api.setupOutput(id).then((o) => setCopied(o.copied)) }, [id, session.worktreePath])
  const [pr, setPr] = useState<Awaited<ReturnType<typeof window.api.prStatus>>>(null)
  useEffect(() => { void window.api.prStatus(id).then(setPr) }, [id, session.status])
  const ask = (key: keyof typeof PROMPTS): void => { window.api.sendMessage(id, withInstructions(settings, session.projectId, key, PROMPTS[key])).catch(actions.fail) }
  const { previews, plainLocalhost } = { ...DEFAULT_REPO_PREFS, ...settings.repoPrefs[session.projectId] }
  const openUrl = (u: string): string => { const url = previewUrl(u, id); return plainLocalhost ? url.replace('127.0.0.1', 'localhost') : url }
  // Nonconcurrent: Ctrl-C the other sessions' terminals in this repo before starting an action here.
  const runAction = (c: string): void => {
    if (settings.repoActions[session.projectId]?.runMode === 'nonconcurrent') for (const s of sessions[session.projectId] ?? []) if (s.id !== id) void window.api.termWrite(s.id, '\x03')
    setRunCmd(c); setDrawerTab('terminal')
  }
  const [since] = useState(() => seen[session.id]) // when you last left this chat: what arrived after is new
  const [loaded, setLoaded] = useState(false)
  const project = projects.find((p) => p.id === session.projectId)
  const [usage, setUsage] = useState('')
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [rewind, setRewind] = useState<Checkpoint | null>(null)
  const [dlg, setDlg] = useState<'rename' | 'archive' | null>(null)
  const [name, setName] = useState(session.title)
  useEffect(() => {
    window.api.sessionUsage(id).then((u) => { const n = u.inputTokens + u.outputTokens; setUsage(n === 0 ? "" : `${n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n} tokens · est. $${u.costUsd.toFixed(2)}`) }, () => {})
  }, [id, session.status])

  useEffect(() => {
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
  const idle = !(busy || session.status === 'needs-you')
  const run = useEffectEvent((c: SessionCommand) => {
    if (c === 'panel') togglePanel()
    else if (c === 'rename') { setName(session.title); setDlg('rename') }
    else if (c === 'archive') setDlg('archive')
    else window.api.listCheckpoints(id).then((cks) => {
      const ck = cks.filter((x) => x.label !== 'Before rewind').at(-1)
      if (!ck) throw new Error('No checkpoint to rewind to')
      setRewind(ck)
    }).catch(actions.fail)
  })
  useEffect(() => {
    const on = (e: Event): void => { if (paneOn.current) run((e as CustomEvent<SessionCommand>).detail) }
    const key = (e: KeyboardEvent): void => { if (paneOn.current && e.metaKey && !e.shiftKey && !e.altKey && e.key === '\\') { e.preventDefault(); run('panel') } }
    window.addEventListener(SESSION_EVENT, on)
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener(SESSION_EVENT, on); window.removeEventListener('keydown', key) }
  }, [])
  const grouped = groupSteps(items)
  const firstNew = since ? grouped.findIndex((e) => e.type === 'message' && e.role === 'assistant' && (e.ts ?? 0) > since) : -1
  const lastUser = items.findLast((e) => e.type === 'message' && e.role === 'user')
  const retry = lastUser?.type === 'message' && !busy ? () => { window.api.sendMessage(id, lastUser.text).catch(actions.fail) } : undefined
  const mine = accounts.filter((a) => a.provider === session.provider)
  return (
    <>
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-4 [-webkit-app-region:drag] [&_button]:[-webkit-app-region:no-drag]">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="min-w-0 truncate text-body font-medium">{session.title}</h1>
            
          </div>
        <div className="ml-auto flex items-center gap-1">
        {changes.files > 0 && <Button variant="outline" size="sm" onClick={() => { setTab('diff'); if (!panel) togglePanel(); setShipRequest((n) => n + 1) }}><GitPullRequest />Create PR</Button>}
        {session.permissionMode === 'full-access' && <Badge tone="danger">{MODE_LABEL['full-access']}</Badge>}
        {(session.status === 'needs-you' || session.status === 'error') && <StatusBadge status={session.status} />}
        <Button variant="ghost" size="icon" aria-label="Toggle side panel" aria-pressed={panel} onClick={togglePanel}><PanelRight /></Button>
        <Menu onOpenChange={(o) => o && window.api.listCheckpoints(id).then(setCheckpoints, actions.fail)}>
          <MenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Session actions"><MoreHorizontal /></Button></MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={() => { setName(session.title); setDlg('rename') }}><Pencil />Rename</MenuItem>
            <MenuItem onSelect={() => void actions.fork(session)}><GitFork />Fork into new session</MenuItem>
            <MenuItem onSelect={() => void actions.switchAgent(session)}><GitFork />Switch to {PROVIDERS.find((p) => p.id !== session.provider)?.label}</MenuItem>
            {split ? <MenuItem onSelect={() => actions.split(null)}><Columns2 />Close split view</MenuItem> : (
              <MenuSub>
                <MenuSubTrigger><Columns2 />Open beside…</MenuSubTrigger>
                <MenuSubContent>{Object.values(sessions).flat().filter((x) => x.id !== id).slice(0, 12).map((x) => <MenuItem key={x.id} onSelect={() => actions.split(x.id)}>{x.title}</MenuItem>)}</MenuSubContent>
              </MenuSub>
            )}
            <MenuItem onSelect={() => void window.api.exportSession(id).catch(actions.fail)}><Download />Export as Markdown</MenuItem>
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
            {previews.length > 0 && (
              <MenuSub>
                <MenuSubTrigger><ExternalLink />Open preview</MenuSubTrigger>
                <MenuSubContent>{previews.map((p) => <MenuItem key={p.name + p.url} onSelect={() => window.open(openUrl(p.url))}>{p.name || p.url}</MenuItem>)}</MenuSubContent>
              </MenuSub>
            )}
            <MenuItem disabled={!idle} onSelect={() => ask('createPr')}><GitPullRequest />Ask agent to create PR</MenuItem>
            {session.branch && <MenuItem disabled={!idle} onSelect={() => ask('branchRename')}><GitFork />Ask agent to rename branch</MenuItem>}
            <MenuSub>
              <MenuSubTrigger disabled={busy}><Undo2 />Rewind files</MenuSubTrigger>
              <MenuSubContent>
                {checkpoints.length === 0 && <MenuLabel>No checkpoints yet</MenuLabel>}
                {[...checkpoints].reverse().map((c) => <MenuItem key={c.id} onSelect={() => setRewind(c)}>{c.label.slice(0, 60)}</MenuItem>)}
              </MenuSubContent>
            </MenuSub>
            <MenuSeparator />
            <MenuItem className="text-destructive [&_svg]:text-destructive" onSelect={() => setDlg('archive')}><Archive />Archive</MenuItem>
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
        title="Archive session?" description={settings.deleteBranchOnArchive ? "It leaves the sidebar. The worktree and local branch are deleted; uncommitted or unpushed work is lost." : "It leaves the sidebar. The worktree and its files stay on disk."}
        onConfirm={() => void actions.archive(session)}
      />
      <div ref={body} className="relative flex min-h-0 flex-1">
        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Chat">
          <div role="tablist" aria-label="Views" className="flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-3 no-scrollbar">
            {[...(active === '__all_changes__' || open.length ? [{ id: '__all_changes__', label: 'All changes' }] : []), { id: 'chat', label: session.title }, ...open.map((p) => ({ id: p, label: p === BIG_TERM ? 'Terminal' : p.split('/').pop() ?? p }))].map((t) => (
              <div key={t.id} className={cn('flex h-full shrink-0 items-center border-b-2 text-small', active === t.id ? 'workspace-tab text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                <button type="button" role="tab" aria-selected={active === t.id} title={t.id} onClick={() => setActive(t.id)} className="h-full min-w-36 max-w-56 truncate px-2 transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-ring">{t.label}</button>
                {open.includes(t.id) && <button type="button" aria-label={`Close ${t.label}`} onClick={() => closeTab(t.id)} className="mr-1 rounded-sm p-0.5 text-faint hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"><X className="size-3" /></button>}
              </div>
            ))}
          </div>
          {active === BIG_TERM && <div className="min-h-0 flex-1"><Terminal sessionId={id} /></div>}
          {active !== 'chat' && active !== BIG_TERM && <FileTab key={`${active}:${diffScope}`} sessionId={id} path={active === '__all_changes__' ? undefined : active} status={session.status} scope={diffScope} />}
          <div className={cn('flex min-h-0 flex-1 flex-col', active !== 'chat' && 'hidden')}>
          <div className="flex min-h-0 flex-1 flex-col gap-3 no-scrollbar overflow-y-auto px-8 py-6 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[800px] [&>*]:[content-visibility:auto] [&>*]:[contain-intrinsic-size:auto_96px]" role="log" aria-label="Conversation" onScroll={(e) => { const t = e.currentTarget; setAtEnd(t.scrollHeight - t.scrollTop - t.clientHeight < 48) }}>
            {!loaded && <Loading>Loading conversation…</Loading>}
            {loaded && items.length === 0 && (
              <div className="flex flex-col gap-4 text-prose text-muted-foreground">
                <p className="rounded-md bg-panel px-4 py-3 text-foreground">{session.worktreePath ? <>You are in a new copy of {project?.name ?? 'your project'} called {session.title}.</> : <>You are working directly in {project?.name ?? 'your project'}.</>}</p>
                {session.branch && <p className="flex items-center gap-3"><GitFork className="size-4 shrink-0" strokeWidth={1.5} /><span>Branched <span className="font-mono text-small">{session.branch}</span> from <span className="font-mono text-small">{settings.repoGit[session.projectId]?.baseBranch || 'HEAD'}</span></span></p>}
                {session.worktreePath && <p className="text-small">Created <span className="font-mono">{session.worktreePath}</span>{copied > 0 && ` and copied ${copied} ${copied === 1 ? 'file' : 'files'}`}</p>}
                {session.worktreePath && <p className="text-small">Optional: <button type="button" className="text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => actions.openSettings('Scripts', session.projectId)}>add a setup script</button></p>}
                <p className="font-mono text-small">{session.model ?? 'Default model'} · {MODE_LABEL[session.permissionMode]}</p>
              </div>
            )}
            {grouped.map((e, i) => [
              i === firstNew && <div key="new" role="separator" aria-label="New messages" className="flex items-center gap-3 text-meta font-medium text-link"><span className="h-px flex-1 bg-link/40" />New<span className="h-px flex-1 bg-link/40" /></div>,
              e.type === 'steps' ? (
                <Steps key={i} steps={e.steps} />
              ) : e.type === 'approval_request' ? (
                <ApprovalCard key={e.id} sessionId={id} {...e} />
              ) : (
                <EventRow key={i} e={e} session={session} first={!(grouped[i - 1]?.type === 'message' && (grouped[i - 1] as { role?: string }).role !== 'user')} onRetry={retry} onFork={(ts) => void actions.fork(session, ts)} />
              )
            ])}
            {!busy && (session.status === 'done' || session.status === 'idle') && items.length > 0 && <TurnResult session={session} onView={() => { setTab('diff'); if (!panel) togglePanel() }} />}
            {busy && <Thinking step={liveStep(items)} since={items.findLast((e) => e.type === 'message' && e.role === 'user')?.ts} />}
            <div ref={end} />
          </div>
          <div className="relative">
            {loaded && items.length === 0 && <div className="mx-auto flex max-w-[864px] flex-wrap gap-2 px-8 pb-1">{STARTERS.map((s) => <button key={s.title} type="button" onClick={() => window.api.sendMessage(id, s.prompt).catch(actions.fail)} title={s.hint} className="rounded-md border border-dashed border-input px-3 py-1.5 text-small text-foreground hover:bg-accent">{s.title}</button>)}</div>}
            {!atEnd && (
              <Button variant="outline" size="icon" className="absolute -top-10 left-1/2 -translate-x-1/2 bg-overlay" aria-label="Scroll to latest" onClick={() => end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })}><ArrowDown /></Button>
            )}
            <Composer session={session} usage={usage} />
          </div>
          </div>
        </section>
        {panel && (
          <>
            {!overlay && <Resizer label="Resize side panel" value={width} min={MIN_W} max={MAX_W} onDrag={(x) => resize(window.innerWidth - x)} onNudge={(d) => resize(width - d * 24)} onReset={() => resize(448)} className="bg-border" />}
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className={cn('flex min-h-0 shrink-0 flex-col border-l-0 bg-chrome', overlay && 'absolute inset-y-0 right-0 z-20 border-l border-border')} style={{ width: Math.min(width, bodyW) }}>
              <TabsList className="h-10 shrink-0 items-center border-b border-border px-3 py-1">
                <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
                <TabsTrigger value="files">All files</TabsTrigger>
                <TabsTrigger value="diff">Changes{changes.files > 0 && <span className="tnum text-meta text-faint">{changes.files}</span>}</TabsTrigger>
                <TabsTrigger value="checks">Checks</TabsTrigger>
                {pr?.checks.some((c) => c.state === 'fail') && <Button variant="ghost" size="sm" className="ml-auto px-1.5 text-link" disabled={!idle} onClick={() => ask('fixErrors')}>Fix errors</Button>}
                {pr?.conflicts && <Button variant="ghost" size="sm" className={cn('px-1.5 text-link', !pr.checks.some((c) => c.state === 'fail') && 'ml-auto')} disabled={!idle} onClick={() => ask('resolveConflicts')}>Resolve conflicts</Button>}
                <Button variant="ghost" size="sm" className={cn('px-1.5 text-link', !pr?.conflicts && !pr?.checks.some((c) => c.state === 'fail') && 'ml-auto')} disabled={busy || session.status === 'needs-you' || !changes.files} onClick={() => ask('review')}><Eye /><span className="hidden min-[1400px]:inline">Review</span></Button>
              </TabsList>
              <TabsContent value="artifacts"><Artifacts sessionId={id} status={session.status} /></TabsContent>
              <TabsContent value="files"><AllFiles sessionId={id} status={session.status} /></TabsContent>
              <TabsContent value="checks"><Checks sessionId={id} status={session.status} /></TabsContent>
              <TabsContent value="diff"><DiffPanel sessionId={id} status={session.status} onOpen={openFile} onOpenAll={() => setActive('__all_changes__')} onScopeChange={setDiffScope} shipRequest={shipRequest} /></TabsContent>
              <div className={cn('flex shrink-0 flex-col border-t border-border', drawer && 'h-1/2')}>
                <div className="flex h-8 shrink-0 items-center gap-1 px-2">
                  <button type="button" aria-expanded={drawer} aria-label="Toggle terminal drawer" onClick={toggleDrawer} className="flex size-6 items-center justify-center text-muted-foreground transition-colors duration-100 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
                    <ChevronDown className={cn('size-4 transition-transform duration-100', !drawer && '-rotate-90')} />
                  </button>
                  {(['setup', 'run', 'terminal'] as const).map((t) => (
                    <button key={t} type="button" aria-pressed={drawer && drawerTab === t} onClick={() => { setDrawerTab(t); if (!drawer) toggleDrawer() }} className="h-8 border-b-2 border-transparent px-2 text-small capitalize text-muted-foreground transition-colors duration-100 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-pressed:border-link aria-pressed:text-foreground">{t}</button>
                  ))}
                </div>
                {/* A half-height drawer matches the workspace reference. */}
                {drawer && (
                  <div className="flex min-h-0 flex-1 flex-col">
                    {drawerTab === 'setup' ? <SetupTab sessionId={id} projectId={session.projectId} />
                      : drawerTab === 'run' ? <RunTab projectId={session.projectId} onRun={runAction} />
                      : <Terminal key={runCmd} sessionId={id} run={runCmd} />}
                  </div>
                )}
              </div>
            </Tabs>
          </>
        )}
      </div>
    </>
  )
}
