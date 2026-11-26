import { useEffect, useState } from 'react'
import { DialogShell, DialogTitle } from './ui/dialog'
import { Command } from 'cmdk'
import { actions, useStore } from '../state/store'
import { StatusDot } from './StatusBadge'
import { Kbd } from './ui/kbd'
import { keysOf, FOCUS_SEARCH, sessionCommand } from '../lib/shortcuts'
import { Archive, BellRing, FolderPlus, PanelLeft, PanelRight, Pencil, RotateCcw, Search, Settings, SquarePen } from 'lucide-react'

const item = 'flex cursor-pointer items-center gap-2 rounded-sm px-2 h-8 text-body data-[selected=true]:bg-accent'
const group = 'text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-meta [&_[cmdk-group-heading]]:text-faint'

const OPEN_PALETTE = 'agentdeck:palette'

/** ⌘K palette plus the global shortcuts ⌘N (new session) and ⌘1–9 (switch session). */
export default function Palette(): React.JSX.Element {
  const { projects, sessions, selectedId, recents } = useStore()
  const [open, setOpen] = useState(false)
  const all = projects.flatMap((p) => sessions[p.id] ?? [])
  const current = all.find((s) => s.id === selectedId)
  // next needs-you session after the current one, wrapping
  const nextNeedsYou = (): void => {
    const need = all.filter((s) => s.status === 'needs-you')
    const next = need.find((s) => all.indexOf(s) > all.findIndex((x) => x.id === selectedId)) ?? need[0]
    if (next) actions.select(next.id)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!e.metaKey || e.shiftKey || e.altKey) return
      if (e.key === 'k') setOpen((o) => !o)
      else if (e.key === 'j') nextNeedsYou()
      else if (e.key === ',') actions.openSettings()
      else if (e.key === 'f') window.dispatchEvent(new Event(FOCUS_SEARCH))
      else if (e.key === 'n') {
        const pid = all.find((s) => s.id === selectedId)?.projectId ?? projects[0]?.id
        if (!pid) return
        actions.openNew(pid)
      } else if (/^[1-9]$/.test(e.key) && all[Number(e.key) - 1]) actions.select(all[Number(e.key) - 1].id)
      else return
      e.preventDefault()
    }
    const show = (): void => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_PALETTE, show)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener(OPEN_PALETTE, show) }
  }, [projects, sessions, selectedId])
  const recent = recents.map((id) => all.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s && s.id !== selectedId).slice(0, 4)
  const rest = all.filter((s) => !recent.includes(s))
  const projectName = (id: string): string => projects.find((p) => p.id === id)?.name ?? ''
  const row = (s: (typeof all)[number], k: string): React.JSX.Element => (
    <Command.Item key={k + s.id} value={`${s.title} ${projectName(s.projectId)} ${s.id} ${k}`} onSelect={run(() => actions.select(s.id))} className={item}>
      <StatusDot status={s.status} /><span className="min-w-0 flex-1 truncate text-foreground">{s.title}</span><span className="text-small text-faint">{projectName(s.projectId)}</span>
    </Command.Item>
  )
  const act = (icon: React.ReactNode, label: string, fn: () => void, id?: string): React.JSX.Element => (
    <Command.Item value={label} onSelect={run(fn)} className={item}>{icon}<span className="flex-1 text-foreground">{label}</span>{id && keysOf(id) && <Kbd>{keysOf(id)}</Kbd>}</Command.Item>
  )
  const ic = 'size-3.5 text-faint'
  const run = (fn: () => void) => () => { setOpen(false); fn() }
  return (
    <DialogShell open={open} onOpenChange={setOpen} aria-describedby={undefined} className="top-[15vh] left-1/2 w-[min(560px,90vw)] -translate-x-1/2 overflow-hidden">
      <DialogTitle className="sr-only">Command palette</DialogTitle>
          <Command>
            <Command.Input autoFocus aria-label="Search sessions and actions" placeholder="Search sessions and actions" className="h-12 w-full bg-transparent px-4 text-prose outline-none placeholder:text-muted-foreground" />
            <Command.List className="max-h-96 overflow-y-auto p-1">
              <Command.Empty className="px-2 py-3 text-muted-foreground">No results</Command.Empty>
              {recent.length > 0 && <Command.Group heading="Recent" className={group}>{recent.map((x) => row(x, 'recent'))}</Command.Group>}
              {current && <Command.Group heading="This session" className={group}>
                {act(<PanelRight className={ic} aria-hidden />, 'Toggle changes panel', () => sessionCommand('panel'), 'panel')}
                {act(<Pencil className={ic} aria-hidden />, 'Rename session', () => sessionCommand('rename'))}
                {act(<RotateCcw className={ic} aria-hidden />, 'Rewind files to last checkpoint', () => sessionCommand('rewind'))}
                {act(<Archive className={ic} aria-hidden />, 'Archive session', () => sessionCommand('archive'))}
              </Command.Group>}
              {rest.length > 0 && <Command.Group heading="Sessions" className={group}>{rest.map((x) => row(x, 'all'))}</Command.Group>}
              <Command.Group heading="Actions" className={group}>
                {projects.map((p) => <Command.Item key={p.id} value={`new session ${p.name}`} onSelect={run(() => actions.openNew(p.id))} className={item}><SquarePen className="size-3.5 text-faint" aria-hidden /><span className="flex-1 text-foreground">New session in {p.name}</span>{p.id === (projects.find((x) => (sessions[x.id] ?? []).some((q) => q.id === selectedId)) ?? projects[0])?.id && <Kbd>⌘N</Kbd>}</Command.Item>)}
                {act(<FolderPlus className={ic} aria-hidden />, 'Add project', () => void actions.addProject())}
                {act(<PanelLeft className={ic} aria-hidden />, 'Toggle sidebar', actions.toggleSidebar, 'sidebar')}
                {act(<BellRing className={ic} aria-hidden />, 'Next session that needs you', nextNeedsYou, 'next')}
                {act(<Search className={ic} aria-hidden />, 'Search sessions', () => window.dispatchEvent(new Event(FOCUS_SEARCH)), 'search')}
                {act(<Settings className={ic} aria-hidden />, 'Settings', actions.openSettings, 'settings')}
              </Command.Group>
            </Command.List>
            <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-meta text-faint"><span><Kbd>↵</Kbd> Open</span><span><Kbd>↑↓</Kbd> Move</span><span><Kbd>esc</Kbd> Close</span></div>
          </Command>
    </DialogShell>
  )
}
