import { cn } from '../lib/utils'
import { useTokens } from './Markdown'

/** One file's unified diff: git headers stripped, hunks as line-numbered rows. */
export function Diff({ diff, path = '' }: { diff: string; path?: string }): React.JSX.Element {
  let o = 0
  let n = 0
  const rows = diff.replace(/\n$/, '').split('\n').flatMap((l, i) => {
    if (/^(diff --git|index |--- |\+\+\+ |new file|deleted file|similarity|rename )/.test(l)) return []
    const h = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@ ?(.*)/.exec(l)
    if (h) { o = +h[1]; n = +h[2]; return [{ i, kind: 'hunk', l: h[3] || `Line ${n}`, a: '', b: '' }] }
    if (l.startsWith('+')) return [{ i, kind: 'add', l: l.slice(1), a: '', b: String(n++) }]
    if (l.startsWith('-')) return [{ i, kind: 'del', l: l.slice(1), a: String(o++), b: '' }]
    if (l.startsWith('\\')) return []
    return [{ i, kind: 'ctx', l: l.slice(1), a: String(o++), b: String(n++) }]
  })
  // shortcut: old/new lines are highlighted as one document, so a token spanning a -/+ pair can colour oddly; fine for a review view.
  const code = rows.filter((r) => r.kind !== 'hunk')
  const tokens = useTokens(code.map((r) => r.l).join('\n'), path)
  const tok = new Map(code.map((r, k) => [r.i, tokens?.[k]]))
  return (
    <pre className="shiki-host overflow-x-auto py-1 font-mono text-small leading-5">
      {rows.map((r) =>
        r.kind === 'hunk' ? (
          <span key={r.i} className="my-1 block truncate bg-panel px-3 py-0.5 text-meta text-faint select-none">{r.l}</span>
        ) : (
          <span key={r.i} className={cn('flex whitespace-pre', r.kind === 'add' && 'bg-add', r.kind === 'del' && 'bg-del')}>
            <span className="tnum w-9 shrink-0 pr-2 text-right text-faint select-none">{r.kind === 'add' ? r.b : r.a}</span>
            <span className={cn('w-3 shrink-0 select-none', r.kind === 'add' ? 'text-ok' : 'text-destructive')}>{r.kind === 'add' ? '+' : r.kind === 'del' ? '-' : ''}</span>
            <span>{tok.get(r.i)?.length ? tok.get(r.i)!.map((t, k) => <span key={k} style={t.htmlStyle as React.CSSProperties}>{t.content}</span>) : r.l || ' '}</span>
          </span>
        )
      )}
    </pre>
  )
}

export const stats = (diff: string): { add: number; del: number } => ({
  add: (diff.match(/^\+(?!\+\+)/gm) ?? []).length,
  del: (diff.match(/^-(?!--)/gm) ?? []).length
})

/** `+x −y`, tabular, green/red. Renders nothing for an empty change. */
export const Stat = ({ add, del, className }: { add: number; del: number; className?: string }): React.JSX.Element | null =>
  add + del === 0 ? null : (
    <span className={cn('tnum inline-flex gap-1.5 font-mono text-meta', className)}>
      <span className="text-ok">+{add}</span><span className="text-destructive">−{del}</span>
    </span>
  )
