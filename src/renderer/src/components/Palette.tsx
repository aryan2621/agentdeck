import { useEffect, useState } from 'react'
import * as D from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import { actions, useStore } from '../store'
import { StatusDot } from './StatusBadge'

const item = 'flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 data-[selected=true]:bg-accent'
const group = 'text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[11px]'

export const OPEN_PALETTE = 'agentdeck:palette'

/** ⌘K palette plus the global shortcuts ⌘N (new session) and ⌘1–9 (switch session). */
export default function Palette(): React.JSX.Element {
  const { projects, sessions, selectedId } = useStore()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!e.metaKey || e.shiftKey || e.altKey) return
      const all = projects.flatMap((p) => sessions[p.id] ?? [])
      if (e.key === 'k') setOpen((o) => !o)
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
  const run = (fn: () => void) => () => { setOpen(false); fn() }
  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <D.Content aria-describedby={undefined} className="fixed top-24 left-1/2 z-50 w-[min(32rem,90vw)] -translate-x-1/2 overflow-hidden rounded-md border border-border bg-panel">
          <D.Title className="sr-only">Command palette</D.Title>
          <Command>
            <Command.Input autoFocus aria-label="Search sessions and actions" placeholder="Search sessions and actions" className="h-10 w-full border-b border-border bg-transparent px-3 text-[13px] outline-none placeholder:text-muted-foreground" />
            <Command.List className="max-h-80 overflow-y-auto p-1">
              <Command.Empty className="px-2 py-3 text-muted-foreground">No results</Command.Empty>
              {projects.some((p) => (sessions[p.id] ?? []).length > 0) && <Command.Group heading="Sessions" className={group}>
                {projects.flatMap((p) => (sessions[p.id] ?? []).map((s) => (
                  <Command.Item key={s.id} value={`${s.title} ${p.name} ${s.id}`} onSelect={run(() => actions.select(s.id))} className={item}>
                    <StatusDot status={s.status} /><span className="min-w-0 flex-1 truncate text-foreground">{s.title}</span><span className="text-xs">{p.name}</span>
                  </Command.Item>
                )))}
              </Command.Group>}
              <Command.Group heading="Actions" className={group}>
                {projects.map((p) => <Command.Item key={p.id} value={`new session ${p.name}`} onSelect={run(() => actions.openNew(p.id))} className={item}><span className="text-foreground">New session in {p.name}</span></Command.Item>)}
                <Command.Item onSelect={run(() => void actions.addProject())} className={item}><span className="text-foreground">Add project</span></Command.Item>
                <Command.Item onSelect={run(actions.toggleGrid)} className={item}><span className="text-foreground">Toggle grid view</span></Command.Item>
                <Command.Item onSelect={run(actions.openSettings)} className={item}><span className="text-foreground">Settings</span></Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
