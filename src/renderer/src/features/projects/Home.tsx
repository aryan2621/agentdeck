import { useEffect, useState } from 'react'
import { Archive, Check, ChevronDown, Folder, ArrowDownUp, Plus, Search, SlidersHorizontal } from 'lucide-react'
import type { SessionInfo } from '../../../../shared/ipc'
import { actions, useStore } from '../../state/store'
import { rel } from '../../lib/ago'
import Avatar from '../../components/Avatar'
import { Button } from '../../components/ui/button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../../components/ui/menu'
import { Pick } from '../../components/ui/pick'
import { Row } from '../../components/ui/row'
import { cn } from '../../lib/utils'

type Sort = 'active' | 'created' | 'name'
const ARCHIVE = [{ id: 'hide', label: 'Hiding archived' }, { id: 'show', label: 'Showing archived' }]
const SORTS: { id: Sort; label: string }[] = [{ id: 'active', label: 'Last active' }, { id: 'created', label: 'Newest' }, { id: 'name', label: 'Name' }]

/** Home once a project exists: every session across projects, filterable and sortable. */
export default function Home(): React.JSX.Element {
  const { projects, sessions } = useStore()
  const [q, setQ] = useState('')
  const [project, setProject] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [archived, setArchived] = useState<SessionInfo[]>([])
  const [sort, setSort] = useState<Sort>('active')
  const [cols, setCols] = useState({ project: true, time: true })
  useEffect(() => { if (showArchived) void window.api.listArchived().then(setArchived, actions.fail) }, [showArchived, sessions])
  const name = (id: string): string => projects.find((p) => p.id === id)?.name ?? ''
  const live = new Set(Object.values(sessions).flat().map((s) => s.id))
  const rows = [...Object.values(sessions).flat(), ...(showArchived ? archived : []).filter((s) => !live.has(s.id))]
    .filter((s) => (!project || s.projectId === project) && `${s.title} ${name(s.projectId)}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => sort === 'name' ? a.title.localeCompare(b.title) : sort === 'created' ? b.createdAt - a.createdAt : b.lastActiveAt - a.lastActiveAt)
  const projectOptions = [{ id: '', label: 'In all projects' }, ...projects.map((p) => ({ id: p.id, label: `In ${p.name}` }))]
  const target = project || projects[0]?.id
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-3 [-webkit-app-region:drag] [&_button]:[-webkit-app-region:no-drag]">
        <label className="flex min-w-0 flex-1 items-center gap-2 text-prose text-muted-foreground [-webkit-app-region:no-drag]">
          <Search className="size-4 shrink-0" aria-hidden /><span className="sr-only">Search sessions</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-faint" />
        </label>
        <Pick label="Project filter" value={project} onPick={setProject} options={projectOptions}><Folder />{projectOptions.find((o) => o.id === project)?.label}</Pick>
        <Pick label="Archived sessions" value={showArchived ? 'show' : 'hide'} onPick={(v) => setShowArchived(v === 'show')} options={ARCHIVE}><Archive />{showArchived ? ARCHIVE[1].label : ARCHIVE[0].label}</Pick>
        <Pick label="Sort sessions" value={sort} onPick={(v) => setSort(v as Sort)} options={SORTS}><ArrowDownUp />{SORTS.find((o) => o.id === sort)?.label}</Pick>
        <Menu>
          <MenuTrigger asChild><Button variant="ghost" aria-label="Display" className="gap-1.5 text-muted-foreground"><SlidersHorizontal />Display<ChevronDown /></Button></MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={(e) => { e.preventDefault(); setCols({ ...cols, project: !cols.project }) }}><Check className={cn(!cols.project && 'invisible')} />Project</MenuItem>
            <MenuItem onSelect={(e) => { e.preventDefault(); setCols({ ...cols, time: !cols.time }) }}><Check className={cn(!cols.time && 'invisible')} />Last active time</MenuItem>
          </MenuContent>
        </Menu>
        <Button variant="default" disabled={!target} onClick={() => target && actions.openNew(target)}><Plus />Create</Button>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto" aria-label="Sessions">
        {rows.length === 0 && <li className="px-4 py-3 text-prose text-muted-foreground">{q || project ? 'No sessions match.' : 'No sessions yet. Create one to get started.'}</li>}
        {rows.map((s) => {
          const gone = !live.has(s.id)
          return (
            <li key={s.id} className="border-b border-border">
              <Row onClick={() => (gone ? void actions.restore(s.id) : actions.select(s.id))} className="h-12 items-center gap-3 rounded-none px-4 text-prose" title={gone ? 'Archived: click to restore' : undefined}>
                <Avatar seed={s.id} avatar={s.avatar} status={s.status} size={20} />
                <span className={cn('min-w-0 flex-1 truncate', gone ? 'text-faint' : 'text-foreground')}>{s.title}</span>
                {gone && <span className="shrink-0 text-meta text-faint">Archived</span>}
                {cols.project && <span className="w-48 shrink-0 truncate text-small text-muted-foreground">{name(s.projectId)}</span>}
                {cols.time && <span className="tnum w-10 shrink-0 text-right text-small text-muted-foreground">{rel(s.lastActiveAt)}</span>}
              </Row>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
