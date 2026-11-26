import { useCallback, useEffect, useState } from 'react'
import type { DiffResult } from '../../../main/git'
import { ChevronsDownUp, ChevronsUpDown, ExternalLink, FileDiff, RefreshCw, Undo2 } from 'lucide-react'
import { actions } from '../store'
import { Banner } from './ui/banner'
import { Button } from './ui/button'
import { ConfirmDialog } from './ui/dialog'
import { Disclosure } from './ui/collapsible'
import { Input } from './ui/input'
import { Select } from './ui/select'
import { Tip } from './ui/tooltip'
import { Diff, Stat } from './Diff'
import { Empty, Field, Loading } from './ui/field'

type Scope = 'uncommitted' | 'branch'
const perFile = (diff: string): string[] => diff.split(/^(?=diff --git )/m).filter(Boolean)

export default function DiffPanel({ sessionId, status }: { sessionId: string; status: string }): React.JSX.Element {
  const [scope, setScope] = useState<Scope>('uncommitted')
  const [res, setRes] = useState<DiffResult | null>(null)
  const [msg, setMsg] = useState('')
  const [title, setTitle] = useState('')
  const [st, setSt] = useState<{ dirty: boolean; ahead: number | null } | null>(null)
  const [engaged, setEngaged] = useState(false) // once there was something to ship, keep the stepper so Create PR stays reachable after pushing
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [reverting, setReverting] = useState<{ path: string; hunk?: number } | null>(null)
  const [info, setInfo] = useState('')

  const [noCommits, setNoCommits] = useState(false)
  // A repo without commits has nothing to diff: show a note instead of a toast on every refresh.
  const load = useCallback(() => Promise.all([
    window.api.sessionDiff(sessionId, scope).then((r) => { setNoCommits(false); setRes(r) }, (e) => {
      if (/no commits yet/.test(String(e?.message))) { setNoCommits(true); setRes(null) } else actions.fail(e)
    }),
    window.api.branchStatus(sessionId).then((b) => { setSt(b); if (b.dirty || (b.ahead ?? 0) > 0) setEngaged(true) }, () => setSt(null))
  ]), [sessionId, scope])
  useEffect(() => void load(), [load, status]) // reload when the agent changes status

  const run = (fn: () => Promise<string | void>): void => {
    setBusy(true)
    fn().then((r) => { setInfo(r ? String(r).trim() : ''); return load() }, actions.fail).finally(() => setBusy(false))
  }
  const [hasGh, setHasGh] = useState<boolean | null>(null)
  useEffect(() => { void window.api.checkTool('gh').then(setHasGh) }, [])
  const chunks = res ? perFile(res.diff) : []
  // Files grouped by folder, keeping each file's index into the per-file diff chunks.
  const groups = new Map<string, { f: DiffResult['files'][number]; i: number }[]>()
  res?.files.forEach((f, i) => { const d = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : ''; groups.set(d, [...(groups.get(d) ?? []), { f, i }]) })
  const allOpen = !!res?.files.length && res.files.every((f) => open[f.path])
  const ahead = st?.ahead ?? null
  const dirty = !!st?.dirty
  const showBar = !!st && (dirty || (ahead ?? 0) > 0 || !!res?.files.length && ahead === null || engaged)
  const prBlock = hasGh === false ? 'GitHub CLI not found' : dirty ? 'Commit first' : ahead !== 0 ? 'Push first' : ''

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Select label="Diff scope" value={scope} onChange={(v) => setScope(v as Scope)} options={[{ value: 'uncommitted', label: 'Uncommitted' }, { value: 'branch', label: 'Branch vs base' }]} />
        <Tip label="Refresh"><Button variant="ghost" size="icon" aria-label="Refresh" onClick={() => void load()}><RefreshCw /></Button></Tip>
        {res && res.files.length > 0 && <Tip label={allOpen ? 'Collapse all' : 'Expand all'}><Button variant="ghost" size="icon" aria-label={allOpen ? 'Collapse all files' : 'Expand all files'} onClick={() => setOpen(Object.fromEntries(res.files.map((f) => [f.path, !allOpen])))}>{allOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}</Button></Tip>}
        {res && <span className="ml-auto text-small text-muted-foreground">{res.files.length} {res.files.length === 1 ? 'file' : 'files'}</span>}
        {res && <Stat add={res.files.reduce((n, f) => n + f.additions, 0)} del={res.files.reduce((n, f) => n + f.deletions, 0)} />}
      </div>
      {info && <div className="border-b border-border px-3 py-1.5 font-mono text-small break-all text-muted-foreground">{info}</div>}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        {noCommits && <p className="text-small text-muted-foreground">No commits yet. Make an initial commit to see changes.</p>}
        {!res && !noCommits && <Loading>Loading changes…</Loading>}
        {res && res.files.length === 0 && <Empty icon={FileDiff}>No changes yet. They show up here as the agent edits files.</Empty>}
        {[...groups].map(([dir, files]) => (
          <div key={dir} className="flex flex-col gap-1">
            {groups.size > 1 && <p className="truncate px-1.5 font-mono text-meta text-faint" title={dir || 'Project root'}>{dir ? `${dir}/` : './'}<span className="ml-1">({files.length})</span></p>}
            {files.map(({ f, i }) => (
              <Disclosure key={f.path} open={!!open[f.path]} onOpenChange={(o) => setOpen((m) => ({ ...m, [f.path]: o }))} head={
                <>
                  <span className={`w-3 shrink-0 font-mono text-small font-medium ${f.status === 'A' ? 'text-ok' : f.status === 'D' ? 'text-destructive' : 'text-warn'}`} aria-label={{ A: 'Added', D: 'Deleted' }[f.status] ?? 'Modified'}>{f.status}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-small" title={f.path}>{groups.size === 1 && <span className="text-faint">{dir ? `${dir}/` : ''}</span>}<span className="font-medium">{f.path.split('/').pop()}</span></span>
                  <Stat add={f.additions} del={f.deletions} />
                </>
              }>
                <div className="flex justify-end gap-1">
                  {f.status !== 'D' && <Tip label="Open file"><Button variant="ghost" size="icon" aria-label="Open file" onClick={() => window.api.openFile(sessionId, f.path).catch(actions.fail)}><ExternalLink /></Button></Tip>}
                  {scope === 'uncommitted' && <Tip label="Revert file"><Button variant="ghost" size="icon" aria-label="Revert file" onClick={() => setReverting({ path: f.path })}><Undo2 /></Button></Tip>}
                </div>
                <Diff diff={chunks[i] ?? ''} path={f.path} onRevertHunk={scope === 'uncommitted' ? (hunk) => setReverting({ path: f.path, hunk }) : undefined} />
              </Disclosure>
            ))}
          </div>
        ))}
      </div>
      {showBar && hasGh === false && <Banner className="border-t border-b-0">GitHub CLI not found. Install <code className="font-mono">gh</code> to open pull requests.</Banner>}
      {showBar && (
        <div className="flex flex-col gap-3 border-t border-border p-3">
          <Field label="Commit message">
            <div className="flex gap-2">
              <Input className="min-w-0 flex-1" value={msg} onChange={(e) => setMsg(e.target.value)} disabled={!dirty} placeholder={dirty ? '' : 'Nothing to commit'} />
              <Button disabled={busy || !dirty || !msg.trim()} onClick={() => run(async () => { await window.api.commitSession(sessionId, msg); if (!title) setTitle(msg); setMsg(''); actions.ok('Committed') })}>Commit</Button>
            </div>
          </Field>
          <div className="flex items-center gap-2">
            <span className="flex-1 text-small text-muted-foreground" role="status">{ahead === 0 ? 'Up to date with remote' : ahead === null ? 'Not pushed yet' : `${ahead} ahead of remote`}</span>
            <Button disabled={busy || ahead === 0} onClick={() => run(() => window.api.pushSession(sessionId).then((r) => { actions.ok('Pushed'); return r }))}>Push</Button>
          </div>
          <Field label="Pull request title">
            <div className="flex gap-2">
              <Input className="min-w-0 flex-1" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!!prBlock} placeholder={prBlock} />
              <Button variant="default" disabled={busy || !!prBlock || !title.trim()} onClick={() => run(() => window.api.createPr(sessionId, title, '').then((url) => { actions.ok('Pull request created', { label: 'View PR', run: () => window.open(url) }); return url }))}>Open PR</Button>
            </div>
          </Field>
        </div>
      )}
      <ConfirmDialog
        open={!!reverting} onOpenChange={(o) => !o && setReverting(null)} destructive
        title={reverting?.hunk === undefined ? `Revert ${reverting?.path.split('/').pop() ?? 'file'}?` : `Revert this change in ${reverting.path.split('/').pop()}?`} confirmLabel="Revert"
        description={reverting?.hunk === undefined ? "Discards this file's uncommitted changes. This can't be undone." : "Discards this block of uncommitted changes. This can't be undone."}
        onConfirm={() => reverting && run(async () => { await (reverting.hunk === undefined ? window.api.revertFile(sessionId, reverting.path) : window.api.revertHunk(sessionId, reverting.path, reverting.hunk)); actions.ok('Reverted') })}
      />
    </div>
  )
}
