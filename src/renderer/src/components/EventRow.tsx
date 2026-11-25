import { AlertCircle, ChevronRight } from 'lucide-react'
import type { ChatEvent, Step } from '../chatItems'
import { cn } from '../lib/utils'
import * as C from '@radix-ui/react-collapsible'
import Markdown from './Markdown'
import { Diff, Stat, stats } from './Diff'

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

const Well = ({ children, className }: { children: React.ReactNode; className?: string }): React.JSX.Element => (
  <pre className={cn('max-h-72 overflow-auto rounded-md bg-chrome px-3 py-2 font-mono text-xs leading-5 whitespace-pre-wrap', className)}>{children}</pre>
)

/** A transcript line: quiet by default, expandable when there is something to show. */
function Line({ verb, target, mono = true, right, children }: { verb: string; target: string; mono?: boolean; right?: React.ReactNode; children?: React.ReactNode }): React.JSX.Element {
  const head = (
    <>
      <span className="shrink-0 text-muted-foreground">{verb}</span>
      <span className={cn('min-w-0 truncate', mono && 'font-mono text-xs')}>{target}</span>
      {right}
    </>
  )
  if (!children) return <div className="flex items-center gap-2 py-0.5 pl-4">{head}</div>
  return (
    <C.Root className="group">
      <C.Trigger className="flex w-full items-center gap-2 rounded-sm py-0.5 text-left transition-colors duration-100 hover:bg-accent">
        <ChevronRight className="size-3 shrink-0 text-muted-foreground transition-transform duration-100 group-data-[state=open]:rotate-90" />
        {head}
      </C.Trigger>
      <C.Content className="py-1 pl-4">{children}</C.Content>
    </C.Root>
  )
}

export function Steps({ steps }: { steps: Step[] }): React.JSX.Element {
  const files = new Set(steps.filter((s) => s.type === 'file_change').map((s) => (s as { path: string }).path)).size
  return (
    <C.Root className="group">
      <C.Trigger className="flex items-center gap-1.5 rounded-sm py-0.5 text-left text-muted-foreground transition-colors duration-100 hover:text-foreground">
        <ChevronRight className="size-3 shrink-0 transition-transform duration-100 group-data-[state=open]:rotate-90" />
        {steps.length} steps{files > 0 && <>, {files} {files === 1 ? 'file' : 'files'} changed</>}
      </C.Trigger>
      <C.Content className="ml-1.5 flex flex-col border-l border-border pl-3">
        {steps.map((s, i) => <EventRow key={i} e={s} />)}
      </C.Content>
    </C.Root>
  )
}

export default function EventRow({ e }: { e: ChatEvent }): React.JSX.Element | null {
  switch (e.type) {
    case 'message':
      return e.role === 'user' ? (
        <div className="flex max-w-[80%] flex-col gap-2 self-end rounded-md bg-panel px-3 py-2 break-words whitespace-pre-wrap">
          {e.images?.length ? (
            <div className="flex flex-wrap gap-2">
              {e.images.map((im, i) => <img key={i} src={`data:${im.mimeType};base64,${im.data}`} alt="Attached" className="max-h-40 max-w-full rounded-sm" />)}
            </div>
          ) : null}
          {e.text}
        </div>
      ) : (
        <Markdown text={e.text} />
      )
    case 'tool_call': {
      const d = describe(e.name, e.input)
      const out = e.output?.trim()
      return (
        <Line verb={d.verb} target={d.target} mono={d.mono}>
          {out ? <Well className="text-muted-foreground">{out}</Well> : undefined}
        </Line>
      )
    }
    case 'file_change': {
      const s = e.diff ? stats(e.diff) : { add: 0, del: 0 }
      return (
        <Line verb="Edited" target={base(e.path)} right={<Stat add={s.add} del={s.del} />}>
          {e.diff ? <div className="overflow-hidden rounded-md bg-chrome"><Diff diff={e.diff} /></div> : undefined}
        </Line>
      )
    }
    case 'status':
      return e.status === 'error' ? (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-destructive" role="alert">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />Error: {e.error ?? 'unknown'}
        </div>
      ) : null
    default:
      return null
  }
}
