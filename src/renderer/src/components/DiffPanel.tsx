import { useCallback, useEffect, useRef, useState } from 'react'
import type { DiffResult } from '../../../main/git'
import { FileDiff, RefreshCw, Undo2 } from 'lucide-react'
import { actions } from '../store'
import { Banner } from './ui/banner'
import { Button } from './ui/button'
import { ConfirmDialog } from './ui/dialog'
import { Input } from './ui/input'
import { Select } from './ui/select'
import { Stat } from './Diff'
import { Empty, Field, Loading } from './ui/field'

type Scope = 'uncommitted' | 'branch'

export default function DiffPanel({ sessionId, status, onOpen, onOpenAll, onScopeChange, shipRequest = 0 }: { sessionId: string; status: string; onOpen?: (path: string) => void; onOpenAll?: () => void; onScopeChange?: (scope: Scope) => void; shipRequest?: number }): React.JSX.Element {
  const [scope, setScope] = useState<Scope>('uncommitted')
  const shipForm = useRef<HTMLDivElement>(null)
  useEffect(() => { onScopeChange?.(scope) }, [scope, onScopeChange])
  const [res, setRes] = useState<DiffResult | null>(null)
  const [msg, setMsg] = useState('')
  const [title, setTitle] = useState('')
  const [st, setSt] = useState<{ dirty: boolean; ahead: number | null } | null>(null)
  const [engaged, setEngaged] = useState(false) // once there was something to ship, keep the bar so Create PR stays reachable after pushing
  const [busy, setBusy] = useState(false)
  const [reverting, setReverting] = useState<{ path: string } | null>(null)
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
  const ahead = st?.ahead ?? null
  const dirty = !!st?.dirty
  const showBar = !!st && (dirty || (ahead ?? 0) > 0 || !!res?.files.length && ahead === null || engaged)
  const step = dirty ? 'commit' : ahead !== 0 ? 'push' : 'pr'
  useEffect(() => { if (shipRequest && showBar) { shipForm.current?.scrollIntoView?.({ block: 'nearest' }); shipForm.current?.querySelector('input')?.focus() } }, [shipRequest, showBar])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-3 py-2">
        {res ? <span className="text-body text-muted-foreground">{res.files.length} {res.files.length === 1 ? 'file' : 'files'} changed</span> : <span />}
        {res && <Stat add={res.files.reduce((n, f) => n + f.additions, 0)} del={res.files.reduce((n, f) => n + f.deletions, 0)} className="ml-auto" />}
        <Button variant="ghost" size="icon" aria-label="Refresh" onClick={() => void load()}><RefreshCw /></Button>
      </div>
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 pb-2">
        <Select label="Diff scope" value={scope} onChange={(v) => setScope(v as Scope)} options={[{ value: 'uncommitted', label: 'Uncommitted' }, { value: 'branch', label: 'Branch vs base' }]} />
        {onOpenAll && <Button variant="ghost" size="sm" disabled={!res?.files.length} onClick={onOpenAll}>All changes</Button>}
      </div>
      {info && <div className="border-b border-border px-3 py-1.5 font-mono text-small break-all text-muted-foreground">{info}</div>}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        {noCommits && <p className="text-small text-muted-foreground">No commits yet. Make an initial commit to see changes.</p>}
        {!res && !noCommits && <Loading>Loading changes…</Loading>}
        {res && res.files.length === 0 && <div className="rounded-md border border-dashed border-border"><Empty icon={FileDiff}>No changes yet. They show up here as the agent edits files.</Empty></div>}
        {res?.files.map((f) => {
          const dir = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : ''
          return (
            <div key={f.path} className="group flex items-center rounded-md hover:bg-accent focus-within:bg-accent">
              <button type="button" onClick={() => onOpen?.(f.path)} className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left focus-visible:outline-2 focus-visible:outline-ring">
                <span className={`w-4 shrink-0 text-center font-mono text-meta font-medium ${f.status === 'A' ? 'text-ok' : f.status === 'D' ? 'text-destructive' : 'text-muted-foreground'}`} aria-label={{ A: 'Added', D: 'Deleted' }[f.status] ?? 'Modified'}>{f.status}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-small" title={f.path}><span className="text-faint">{dir ? `${dir}/` : ''}</span><span className="font-medium">{f.path.split('/').pop()}</span></span>
                <Stat add={f.additions} del={f.deletions} />
              </button>
              {scope === 'uncommitted' && <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" aria-label={`Revert ${f.path}`} onClick={() => setReverting({ path: f.path })}><Undo2 /></Button>}
            </div>
          )
        })}
      </div>
      {showBar && hasGh === false && <Banner className="border-t border-b-0">GitHub CLI not found. Install <code className="font-mono">gh</code> to open pull requests.</Banner>}
      {showBar && (
        <div ref={shipForm} className="flex flex-col gap-2 border-t border-border p-3">
          {step === 'commit' && (
            <Field label="Commit message">
              <div className="flex gap-2">
                <Input className="min-w-0 flex-1" value={msg} onChange={(e) => setMsg(e.target.value)} />
                <Button disabled={busy || !msg.trim()} onClick={() => run(async () => { await window.api.commitSession(sessionId, msg); if (!title) setTitle(msg); setMsg(''); actions.ok('Committed') })}>Commit</Button>
              </div>
            </Field>
          )}
          {step === 'push' && (
            <div className="flex items-center gap-2">
              <span className="flex-1 text-small text-muted-foreground" role="status">{ahead === null ? 'Not pushed yet' : `${ahead} ahead of remote`}</span>
              <Button disabled={busy} onClick={() => run(() => window.api.pushSession(sessionId).then((r) => { actions.ok('Pushed'); return r }))}>Push</Button>
            </div>
          )}
          {step === 'pr' && (
            <Field label="Pull request title">
              <div className="flex gap-2">
                <Input className="min-w-0 flex-1" value={title} onChange={(e) => setTitle(e.target.value)} disabled={hasGh === false} placeholder={hasGh === false ? 'GitHub CLI not found' : ''} />
                <Button variant="default" disabled={busy || hasGh === false || !title.trim()} onClick={() => run(() => window.api.createPr(sessionId, title, '').then((url) => { actions.ok('Pull request created', { label: 'View PR', run: () => window.open(url) }); return url }))}>Create PR</Button>
              </div>
            </Field>
          )}
        </div>
      )}
      <ConfirmDialog
        open={!!reverting} onOpenChange={(o) => !o && setReverting(null)} destructive
        title={`Revert ${reverting?.path.split('/').pop() ?? 'file'}?`} confirmLabel="Revert"
        description="Discards this file's uncommitted changes. This can't be undone."
        onConfirm={() => reverting && run(async () => { await window.api.revertFile(sessionId, reverting.path); actions.ok('Reverted') })}
      />
    </div>
  )
}
