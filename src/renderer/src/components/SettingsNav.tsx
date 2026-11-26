import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronDown, Search } from 'lucide-react'
import { actions, useStore } from '../store'
import { ProjectAvatar } from './Avatar'
import { Input } from './ui/input'
import { Kbd } from './ui/kbd'
import { Row } from './ui/row'
import { cn } from '../lib/utils'

import { AGENTS, MORE, PERSONAL, REPO, pageOf, type Item } from '../lib/settingsPages'

const match = (i: Item, q: string): boolean => !q || `${i.id} ${i.keywords ?? ''}`.toLowerCase().includes(q.toLowerCase())

/** Settings takes over the sidebar column: Back, search, then grouped pages. */
export default function SettingsNav(): React.JSX.Element {
  const { view, projects } = useStore()
  const page = pageOf(view.kind === 'settings' ? view : {})
  const [q, setQ] = useState('')
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.metaKey && e.key === 'f') { e.preventDefault(); field.current?.focus() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const item = (i: Item, active: boolean, go: () => void): React.JSX.Element => (
    <Row key={i.id} active={active} onClick={go} className={cn('h-9 items-center gap-2.5 text-prose', active && 'font-medium')}>
      {i.icon && <i.icon className="size-4 shrink-0 text-faint" strokeWidth={1.5} aria-hidden />}
      <span className="truncate">{i.id}</span>
    </Row>
  )
  const group = (label: string, children: React.ReactNode[]): React.JSX.Element | null =>
    children.length ? <div key={label} className="flex flex-col gap-0.5"><h3 className="px-2 pb-1 text-small text-faint">{label}</h3>{children}</div> : null
  const top = (list: Item[]): React.JSX.Element[] => list.filter((i) => match(i, q)).map((i) => item(i, !page.projectId && page.tab === i.id, () => actions.openSettings(i.id)))
  const more = top(MORE)
  const personal = top(PERSONAL)
  const agents = top(AGENTS)
  const repos = projects.map((p) => {
    const subs = REPO.filter((i) => match(i, q) || (!!q && p.name.toLowerCase().includes(q.toLowerCase())))
    if (!subs.length) return null
    const open = page.projectId === p.id || !!q // collapsed unless it's the current repo or a search is active
    return (
      <div key={p.id} className="flex flex-col gap-0.5">
        <Row onClick={() => actions.openSettings(subs[0].id, p.id)} aria-expanded={open} className="h-9 items-center gap-2.5 text-prose text-foreground"><ProjectAvatar name={p.name} size={16} /><span className="truncate">{p.name}</span></Row>
        {open && <div className="ml-4 flex flex-col gap-0.5 border-l border-border pl-2">
          {subs.map((i) => item(i, page.projectId === p.id && page.tab === i.id, () => actions.openSettings(i.id, p.id)))}
        </div>}
      </div>
    )
  }).filter((x): x is React.JSX.Element => !!x)
  return (
    <nav className="pointer-ui flex min-h-0 flex-col bg-chrome" aria-label="Settings">
      <div className="flex h-10 shrink-0 items-center px-3">
        <div className="h-full min-w-8 flex-1 [-webkit-app-region:drag]" aria-hidden />
        <button type="button" onClick={actions.closeSettings} className="flex h-7 items-center gap-1.5 rounded-md px-2 text-body text-muted-foreground hover:bg-accent hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />Back
        </button>
      </div>
      <div className="px-2 pb-1">
        <Row onClick={() => actions.openSettings('Account')} className="min-h-9 items-center gap-2 py-1.5 text-prose font-medium text-foreground"><span className="min-w-0 truncate">AgentDeck</span><ChevronDown className="size-4 shrink-0 text-faint" aria-hidden /></Row>
      </div>
      <div className="px-2 pb-2">
        <label className="relative block">
          <span className="sr-only">Search settings</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint" />
          <Input ref={field} aria-keyshortcuts="Meta+F" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search settings" className="h-8 rounded-md border-input bg-background pr-10 pl-8" />
          {!q && <Kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2" aria-hidden>⌘F</Kbd>}
        </label>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-2 pt-2 pb-4">
        {group('Personal', personal)}
        {group('Agents & environment', agents)}
        {group('Repositories', repos)}
        {group('More', more)}
        {!personal.length && !agents.length && !repos.length && !more.length && <p className="px-2 text-small text-muted-foreground">No settings match “{q}”.</p>}
      </div>
    </nav>
  )
}
