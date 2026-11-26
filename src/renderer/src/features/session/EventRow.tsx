import { AlertCircle, Copy, FileText, GitFork, Globe, GitBranch, Pencil, RotateCw, Search, Terminal, Wrench, type LucideIcon } from 'lucide-react'
import type { SessionInfo } from '../../../../shared/ipc'
import { useChanges } from '../../lib/useChanges'
import { Button } from '../../components/ui/button'
import type { ChatEvent, Step } from '../../state/chatItems'
import { cn, stripAbsolutelyRight } from '../../lib/utils'
import { useStore } from '../../state/store'
import { Disclosure } from '../../components/ui/collapsible'
import Avatar from '../../components/Avatar'
import Markdown from '../../components/Markdown'
import Mentions from './Mentions'
import { Diff, Stat } from '../review/Diff'
import { stats } from '../../lib/diff'
import { stamp } from '../../lib/ago'

const text = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v, null, 2) ?? '')
const base = (p: string): string => p.split('/').pop() ?? p
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** Designed one-liner per tool: a verb and its object, instead of the raw input JSON. */
function describe(name: string, input: unknown): { verb: string; target: string; mono: boolean } {
  const i = (input ?? {}) as Record<string, unknown>
  const path = str(i.file_path) || str(i.path)
  switch (name) {
    case 'Bash': return { verb: 'Ran', target: str(i.command), mono: true }
    case 'Read': return { verb: 'Read', target: base(path), mono: true }
    case 'Write': return { verb: 'Wrote', target: base(path), mono: true }
    case 'Edit': case 'MultiEdit': return { verb: 'Edited', target: base(path), mono: true }
    case 'Grep': return { verb: 'Searched', target: str(i.pattern), mono: true }
    case 'Glob': return { verb: 'Listed', target: str(i.pattern), mono: true }
    case 'WebFetch': return { verb: 'Fetched', target: str(i.url), mono: true }
    default: return { verb: name, target: text(input).replace(/\s+/g, ' ').slice(0, 90), mono: true }
  }
}

const ICONS: Record<string, LucideIcon> = { Bash: Terminal, Read: FileText, Write: Pencil, Edit: Pencil, MultiEdit: Pencil, Grep: Search, Glob: Search, WebFetch: Globe }

const Well = ({ children, className }: { children: React.ReactNode; className?: string }): React.JSX.Element => (
  <pre className={cn('max-h-72 overflow-auto rounded-lg bg-panel px-3 py-2 font-mono text-small leading-5 whitespace-pre-wrap', className)}>{children}</pre>
)

/** A transcript line: quiet by default, expandable when there is something to show. */
function Line({ icon: Icon, verb, target, mono = true, right, children }: { icon?: LucideIcon; verb: string; target: string; mono?: boolean; right?: React.ReactNode; children?: React.ReactNode }): React.JSX.Element {
  const head = (
    <>
      {Icon && <Icon className="size-3 shrink-0 text-faint" aria-hidden />}
      <span className="shrink-0 text-small text-foreground">{verb}</span>
      <span className={cn('min-w-0 truncate text-small text-faint', mono && 'font-mono')}>{target}</span>
      {right}
    </>
  )
  if (!children) return <div className="flex items-center gap-2 py-0.5 pl-4">{head}</div>
  return <Disclosure head={head} trigger="gap-2 px-0 py-0.5" chevron="size-3" content="m-0 border-0 py-1 pl-4">{children}</Disclosure>
}

export function Steps({ steps }: { steps: Step[] }): React.JSX.Element {
  const files = new Set(steps.filter((s) => s.type === 'file_change').map((s) => (s as { path: string }).path)).size
  const head = <>{steps.length} tool {steps.length === 1 ? 'call' : 'calls'}{files > 0 && <> · {files} {files === 1 ? 'file' : 'files'}</>}</>
  return (
    <Disclosure className="flex flex-col items-start" head={head} trigger="w-auto gap-1 px-0 text-small text-faint hover:bg-transparent hover:text-foreground" chevron="size-3" content="ml-0 flex w-full flex-col">
      {steps.map((s, i) => <EventRow key={i} e={s} />)}
    </Disclosure>
  )
}

/** Summary of the latest finished turn: branch, change size, and the two next steps. */
export function TurnResult({ session, onView }: { session: SessionInfo; onView: () => void }): React.JSX.Element | null {
  const c = useChanges(session)
  if (c.files === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border py-3 text-small text-muted-foreground" role="group" aria-label="Turn result">
      <span className="inline-flex items-center gap-1.5 font-medium text-ok"><span className="size-1.5 rounded-full bg-ok" />Done</span>
      <span>{c.files} {c.files === 1 ? 'file' : 'files'}</span><Stat add={c.add} del={c.del} />
      {session.branch && <span className="inline-flex min-w-0 items-center gap-1 truncate"><GitBranch className="size-3.5 shrink-0" />{session.branch}</span>}
      <div className="ml-auto flex gap-2">
        <Button variant="outline" size="sm" onClick={onView}>View changes</Button>
        <Button size="sm" onClick={onView}>Commit…</Button>
      </div>
    </div>
  )
}

/** Message wrapper: a quiet timestamp and Copy appear on hover or keyboard focus. */
function Hover({ text, ts, right, onFork, children }: { text: string; ts?: number; right?: boolean; onFork?: (ts: number) => void; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className={cn('group/msg flex flex-col gap-0.5', right ? 'items-end' : 'items-start')}>
      {children}
      <div className="flex h-5 items-center gap-2 text-meta text-faint opacity-0 transition-opacity duration-100 group-focus-within/msg:opacity-100 group-hover/msg:opacity-100">
        {ts && <time dateTime={new Date(ts).toISOString()}>{stamp(ts)}</time>}
        <button type="button" aria-label="Copy message" className="inline-flex items-center gap-1 rounded-sm hover:text-foreground" onClick={() => void navigator.clipboard.writeText(text)}><Copy className="size-3" />Copy</button>
        {ts && onFork && <button type="button" aria-label="Fork from here" className="inline-flex items-center gap-1 rounded-sm hover:text-foreground" onClick={() => onFork(ts)}><GitFork className="size-3" />Fork from here</button>}
      </div>
    </div>
  )
}

export default function EventRow({ e, session, onRetry, onFork, first = true }: { e: ChatEvent; session?: SessionInfo; first?: boolean; onRetry?: () => void; onFork?: (ts: number) => void }): React.JSX.Element | null {
  const { settings } = useStore()
  switch (e.type) {
    case 'message':
      return e.role === 'user' ? (
        <Hover text={e.text} ts={e.ts} right onFork={onFork}><div className="mt-2 flex max-w-[75%] flex-col gap-1.5 rounded-lg bg-muted px-4 py-2.5 text-prose text-foreground break-words whitespace-pre-wrap">
          {e.images?.length ? (
            <div className="flex flex-wrap gap-2">
              {e.images.map((im, i) => <img key={i} src={`data:${im.mimeType};base64,${im.data}`} alt="Attached" className="max-h-40 max-w-full rounded-sm" />)}
            </div>
          ) : null}
          <div><Mentions text={e.text} className="rounded-sm bg-foreground/10 text-inherit" /></div>
        </div></Hover>
      ) : (
        <div className="flex max-w-[90%] items-start gap-2">
          {session && (first ? <Avatar seed={session.id} avatar={session.avatar} size={24} className="mt-0.5 shrink-0" /> : <span className="w-6 shrink-0" />)}
          <Hover text={e.text} ts={e.ts} onFork={onFork}><div className="min-w-0 text-body"><Markdown text={settings.stripAbsolutelyRight ? stripAbsolutelyRight(e.text) : e.text} /></div></Hover>
        </div>
      )
    case 'tool_call': {
      const d = describe(e.name, e.input)
      const out = e.output?.trim()
      return (
        <Line icon={ICONS[e.name] ?? Wrench} verb={d.verb} target={d.target} mono={d.mono}>
          {out ? <Well className="text-muted-foreground">{out}</Well> : undefined}
        </Line>
      )
    }
    case 'file_change': {
      const s = e.diff ? stats(e.diff) : { add: 0, del: 0 }
      return (
        <Line icon={Pencil} verb="Edited" target={base(e.path)} right={<Stat add={s.add} del={s.del} />}>
          {e.diff ? <div className="overflow-hidden rounded-md bg-panel"><Diff diff={e.diff} /></div> : undefined}
        </Line>
      )
    }
    case 'status':
      return e.status === 'error' ? (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-destructive" role="alert">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" /><span className="min-w-0 flex-1 break-words">Error: {e.error ?? 'unknown'}</span>
          <Button variant="ghost" size="icon" className="shrink-0" aria-label="Copy error" onClick={() => void navigator.clipboard.writeText(e.error ?? '')}><Copy /></Button>
          {onRetry && <Button variant="ghost" size="icon" className="shrink-0" aria-label="Retry" onClick={onRetry}><RotateCw /></Button>}
        </div>
      ) : null
    default:
      return null
  }
}
