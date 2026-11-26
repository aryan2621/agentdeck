import { Undo2 } from 'lucide-react'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import { useTokens } from './Markdown'

type DiffRow = { i: number; kind: string; l: string; a: string; b: string; h?: number }
function parseDiff(diff: string): DiffRow[] {
  let o = 0
  let n = 0
  let hunk = 0
  const rows: DiffRow[] = diff.replace(/\n$/, '').split('\n').flatMap((l, i) => {
    if (/^(diff --git|index |--- |\+\+\+ |new file|deleted file|similarity|rename )/.test(l)) return []
    const h = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@ ?(.*)/.exec(l)
    if (h) { o = +h[1]; n = +h[2]; return [{ i, kind: 'hunk', l: h[3] || `Line ${n}`, a: '', b: '', h: hunk++ }] }
    if (l.startsWith('+')) return [{ i, kind: 'add', l: l.slice(1), a: '', b: String(n++) }]
    if (l.startsWith('-')) return [{ i, kind: 'del', l: l.slice(1), a: String(o++), b: '' }]
    if (l.startsWith('\\')) return []
    return [{ i, kind: 'ctx', l: l.slice(1), a: String(o++), b: String(n++) }]
  })
  return rows
}

/** One file's unified diff: git headers stripped, hunks as line-numbered rows. */
export function Diff({ diff, path = '', onRevertHunk, layout = 'unified' }: { diff: string; path?: string; layout?: 'unified' | 'split'; onRevertHunk?: (hunk: number) => void }): React.JSX.Element {
  const rows = parseDiff(diff)
  // shortcut: old/new lines are highlighted as one document, so a token spanning a -/+ pair can colour oddly; fine for a review view.
  const code = rows.filter((r) => r.kind !== 'hunk')
  const tokens = useTokens(code.map((r) => r.l).join('\n'), path)
  const tok = new Map(code.map((r, k) => [r.i, tokens?.[k]]))
  if (layout === 'split') {
    type Row = (typeof rows)[number]
    const pairs: { left?: Row; right?: Row; hunk?: Row }[] = []
    let removed: Row[] = [], added: Row[] = []
    const flush = (): void => {
      for (let i = 0; i < Math.max(removed.length, added.length); i++) pairs.push({ left: removed[i], right: added[i] })
      removed = []; added = []
    }
    for (const row of rows) {
      if (row.kind === 'del') { if (added.length) flush(); removed.push(row) }
      else if (row.kind === 'add') added.push(row)
      else { flush(); pairs.push(row.kind === 'hunk' ? { hunk: row } : { left: row, right: row }) }
    }
    flush()
    const cell = (row: Row | undefined, side: 'left' | 'right'): React.JSX.Element => <span className={cn('flex min-w-0 whitespace-pre', !row && 'bg-accent/40', row?.kind === 'add' && 'bg-add', row?.kind === 'del' && 'bg-del', side === 'left' && 'border-r border-border')}>
      <span className="tnum w-9 shrink-0 pr-2 text-right text-faint select-none">{side === 'left' ? row?.a : row?.b}</span>
      <span className="w-3 shrink-0 select-none">{row?.kind === 'add' ? '+' : row?.kind === 'del' ? '−' : ''}</span>
      <span>{row && (tok.get(row.i)?.length ? tok.get(row.i)!.map((t, k) => <span key={k} style={t.htmlStyle as React.CSSProperties}>{t.content}</span>) : row.l || ' ')}</span>
    </span>
    return <pre className="shiki-host min-w-full w-max py-1 font-mono text-small leading-5" aria-label="Split diff">
      {pairs.map((pair, i) => pair.hunk ? <span key={i} className="my-1 block bg-panel px-3 py-0.5 text-meta text-faint">{pair.hunk.l}</span> : <span key={i} className="grid grid-cols-2">{cell(pair.left, 'left')}{cell(pair.right, 'right')}</span>)}
    </pre>
  }
  return (
    <pre className="shiki-host overflow-x-auto py-1 font-mono text-small leading-5">
      {rows.map((r) =>
        r.kind === 'hunk' ? (
          <span key={r.i} className="my-1 flex items-center bg-panel px-3 py-0.5 text-meta text-faint select-none">
            <span className="min-w-0 flex-1 truncate">{r.l}</span>
            {onRevertHunk && <Button variant="ghost" size="icon" className="size-6" aria-label={`Revert hunk ${r.h! + 1}`} onClick={() => onRevertHunk(r.h!)}><Undo2 className="size-3" /></Button>}
          </span>
        ) : (
          <span key={r.i} className={cn('flex border-l-2 border-transparent whitespace-pre', r.kind === 'add' && 'border-ok bg-add', r.kind === 'del' && 'border-destructive bg-del')}>
            <span className="tnum w-9 shrink-0 pr-2 text-right text-faint select-none">{r.kind === 'add' ? r.b : r.a}</span>
            <span className={cn('w-3 shrink-0 select-none', r.kind === 'add' ? 'text-ok' : 'text-destructive')}>{r.kind === 'add' ? '+' : r.kind === 'del' ? '-' : ''}</span>
            <span>{tok.get(r.i)?.length ? tok.get(r.i)!.map((t, k) => <span key={k} style={t.htmlStyle as React.CSSProperties}>{t.content}</span>) : r.l || ' '}</span>
          </span>
        )
      )}
    </pre>
  )
}

/** `+x −y`, tabular, green/red. Renders nothing for an empty change. */
export const Stat = ({ add, del, className }: { add: number; del: number; className?: string }): React.JSX.Element | null =>
  add + del === 0 ? null : (
    <span className={cn('tnum inline-flex gap-1.5 font-mono text-meta', className)}>
      <span className="text-ok">+{add}</span><span className="text-destructive">−{del}</span>
    </span>
  )
