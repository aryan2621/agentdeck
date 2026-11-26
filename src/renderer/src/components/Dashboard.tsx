import { actions, useStore } from '../store'
import { rel } from '../lib/ago'
import Avatar from './Avatar'
import PageHeader from './PageHeader'
import { Row } from './ui/row'

const SECTIONS = [
  { title: 'Needs you', match: ['needs-you', 'error'] },
  { title: 'Working', match: ['working'] }
]

/** Sessions that want attention across all projects: waiting on you, or still running. */
export default function Dashboard(): React.JSX.Element {
  const { sessions, projects } = useStore()
  const all = Object.values(sessions).flat().sort((a, b) => b.lastActiveAt - a.lastActiveAt)
  const project = (id: string): string => projects.find((p) => p.id === id)?.name ?? ''
  const shown = SECTIONS.map((sec) => ({ ...sec, items: all.filter((s) => sec.match.includes(s.status)) }))
  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.every((sec) => !sec.items.length) && <p className="px-4 py-3 text-prose text-muted-foreground">Nothing running and nothing waiting for you.</p>}
        {shown.filter((sec) => sec.items.length).map((sec) => (
          <section key={sec.title} aria-label={sec.title}>
            <h2 className="px-4 pb-1 pt-3 text-small font-medium text-muted-foreground">{sec.title} · {sec.items.length}</h2>
            <ul>
              {sec.items.map((s) => (
                <li key={s.id} className="border-b border-border">
                  <Row onClick={() => actions.select(s.id)} className="h-12 items-center gap-3 rounded-none px-4 text-prose">
                    <Avatar seed={s.id} avatar={s.avatar} status={s.status} size={20} />
                    <span className="min-w-0 flex-1 truncate">{s.title}</span>
                    <span className="w-48 shrink-0 truncate text-small text-muted-foreground">{project(s.projectId)}</span>
                    <span className="tnum w-10 shrink-0 text-right text-small text-muted-foreground">{rel(s.lastActiveAt)}</span>
                  </Row>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
