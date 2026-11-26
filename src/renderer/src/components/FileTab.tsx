import { useEffect, useState } from 'react'
import { AlignJustify, Columns2, FileDiff, FileText, MoreVertical, Copy, Undo2 } from 'lucide-react'
import type { DiffResult } from '../../../main/git'
import { actions } from '../store'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Empty, Loading } from './ui/field'
import { ConfirmDialog } from './ui/dialog'
import { Menu, MenuContent, MenuItem, MenuTrigger } from './ui/menu'
import { Diff } from './Diff'
import { perFile } from '../lib/diff'
import { cn } from '../lib/utils'

/** The file as it reads after the change: context and added lines of every hunk. */
const newSide = (d: string): string => d.split('\n').slice(d.split('\n').findIndex((l) => l.startsWith('@@')) + 1).filter((l) => l[0] !== '-' && l[0] !== '\\' && !l.startsWith('@@')).map((l) => l.slice(1)).join('\n')

export type DiffScope = 'uncommitted' | 'branch'
const viewedKey = (sid: string, path: string): string => `viewed:${sid}:${path}`

/** Read-only review, sharing the Changes panel's scope. Omit path to review every file. */
export default function FileTab({ sessionId, path, status, scope = 'uncommitted' }: { sessionId: string; path?: string; status: string; scope?: DiffScope }): React.JSX.Element {
  const [rev, setRev] = useState(0) // bumped after a hunk revert to reload
  const [reverting, setReverting] = useState<{ path: string; hunk: number } | null>(null)
  const requestKey = `${sessionId}:${scope}:${status}:${rev}`
  const [response, setResponse] = useState<{ key: string; result: DiffResult } | null>(null)
  const res = response?.key === requestKey ? response.result : null
  const [layout, setLayout] = useState<'unified' | 'split' | 'preview'>('unified')
  const [viewed, setViewed] = useState<Record<string, boolean>>({})
  useEffect(() => {
    let alive = true
    void window.api.sessionDiff(sessionId, scope).then((r) => { if (alive) setResponse({ key: requestKey, result: r }) }, actions.fail)
    return () => { alive = false }
  }, [sessionId, status, scope, requestKey])
  if (!res) return <Loading>Loading changes…</Loading>
  const chunks = perFile(res.diff)
  const shown = res.files.map((f, i) => ({ f, d: chunks[i] ?? '' })).filter(({ f }) => !path || f.path === path)
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-4">
      <FileDiff className="size-3.5 shrink-0 text-faint" aria-hidden />
      <span className="min-w-0 flex-1 truncate font-mono text-small" title={path}>{path || 'All changes'}</span>
      <div className="flex items-center rounded-md bg-accent p-0.5" aria-label="Diff layout">
        {([['unified', AlignJustify, 'Unified diff'], ['split', Columns2, 'Split diff'], ['preview', FileText, 'Preview file']] as const).map(([id, Icon, label]) => <Button key={id} variant="ghost" size="icon" aria-label={label} aria-pressed={layout === id} onClick={() => setLayout(id)} className={cn('size-6', layout === id && 'bg-overlay shadow-sm')}><Icon /></Button>)}
      </div>
      <Menu>
        <MenuTrigger asChild><Button variant="ghost" size="icon" aria-label="More diff actions"><MoreVertical /></Button></MenuTrigger>
        <MenuContent>
          {path && <MenuItem onSelect={() => window.api.openFile(sessionId, path).catch(actions.fail)}>Open in editor</MenuItem>}
          <MenuItem onSelect={() => { setViewed(Object.fromEntries(shown.map(({ f }) => [f.path, true]))); shown.forEach(({ f }) => localStorage.setItem(viewedKey(sessionId, f.path), '1')) }}>Mark all as viewed</MenuItem>
        </MenuContent>
      </Menu>
    </div>
    <div className="min-h-0 flex-1 overflow-auto">
      {shown.length === 0 && <Empty icon={FileDiff}>{scope === 'branch' ? 'No branch changes in this file.' : 'No uncommitted changes in this file.'}</Empty>}
      {shown.map(({ f, d }) => <section key={f.path} aria-label={`Changes in ${f.path}`}>
        <div className="sticky top-0 z-10 flex h-9 items-center gap-2 border-b border-border bg-background px-4">
          <span className="min-w-0 flex-1 truncate font-mono text-small text-muted-foreground">{f.path}</span>
          <Button variant="ghost" size="icon" className="size-6" aria-label={`Copy path ${f.path}`} onClick={() => void navigator.clipboard.writeText(f.path)}><Copy className="size-3" /></Button>
          {scope === 'uncommitted' && <Button variant="ghost" size="icon" className="size-6" aria-label={`Revert ${f.path}`} onClick={() => setReverting({ path: f.path, hunk: -1 })}><Undo2 className="size-3" /></Button>}
          <label className="flex items-center gap-2 text-small text-muted-foreground"><Checkbox checked={viewed[f.path] ?? localStorage.getItem(viewedKey(sessionId, f.path)) === '1'} aria-label={`Viewed ${f.path}`} onCheckedChange={(c) => { setViewed({ ...viewed, [f.path]: c === true }); localStorage.setItem(viewedKey(sessionId, f.path), c === true ? '1' : '0') }} />Viewed</label>
        </div>
        {layout === 'preview'
          ? <pre className="overflow-auto whitespace-pre-wrap break-words px-4 py-2 font-mono text-small" aria-label={`Preview of ${f.path}`}>{newSide(d)}</pre>
          : <Diff diff={d} path={f.path} layout={layout} onRevertHunk={scope === 'uncommitted' ? (hunk) => setReverting({ path: f.path, hunk }) : undefined} />}
      </section>)}
    </div>
    <ConfirmDialog open={!!reverting} onOpenChange={(o) => !o && setReverting(null)} destructive title={reverting?.hunk === -1 ? 'Revert this file?' : 'Revert this hunk?'} confirmLabel="Revert" description={`The change is discarded from ${reverting?.path ?? 'the file'}. This cannot be undone.`}
      onConfirm={() => reverting && void (reverting.hunk === -1 ? window.api.revertFile(sessionId, reverting.path) : window.api.revertHunk(sessionId, reverting.path, reverting.hunk)).then(() => setRev((n) => n + 1), actions.fail)} />
  </div>
}
