import { useCallback, useEffect, useState } from 'react'
import type { DiffResult } from '../../../main/git'
import { ChevronDown, GitCommit, GitPullRequest, RefreshCw, Upload } from 'lucide-react'
import { actions } from '../store'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Disclosure } from './ui/collapsible'
import { Input } from './ui/input'
import { Menu, MenuContent, MenuItem, MenuTrigger } from './ui/menu'
import { Select } from './ui/select'
import { Tip } from './ui/tooltip'
import { Diff, Stat } from './Diff'

type Scope = 'uncommitted' | 'branch'
const perFile = (diff: string): string[] => diff.split(/^(?=diff --git )/m).filter(Boolean)

export default function DiffPanel({ sessionId, status }: { sessionId: string; status: string }): React.JSX.Element {
  const [scope, setScope] = useState<Scope>('uncommitted')
  const [res, setRes] = useState<DiffResult | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')

  const load = useCallback(() => window.api.sessionDiff(sessionId, scope).then(setRes, actions.fail), [sessionId, scope])
  useEffect(() => void load(), [load, status]) // reload when the agent changes status

  const run = (fn: () => Promise<string | void>): void => {
    setBusy(true)
    fn().then((r) => { setInfo(r ? String(r).trim() : ''); return load() }, actions.fail).finally(() => setBusy(false))
  }
  const need = (go: () => void): void => (msg.trim() ? go() : actions.fail(new Error('Enter a commit message / PR title first')))
  const chunks = res ? perFile(res.diff) : []

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Select label="Diff scope" value={scope} onChange={(v) => setScope(v as Scope)} options={[{ value: 'uncommitted', label: 'Uncommitted' }, { value: 'branch', label: 'Branch vs base' }]} />
        <Tip label="Refresh"><Button variant="ghost" size="icon" aria-label="Refresh" onClick={() => void load()}><RefreshCw /></Button></Tip>
        {res && <Stat className="ml-auto" add={res.files.reduce((n, f) => n + f.additions, 0)} del={res.files.reduce((n, f) => n + f.deletions, 0)} />}
      </div>
      {info && <div className="border-b border-border px-3 py-1.5 font-mono text-xs break-all text-muted-foreground">{info}</div>}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        {res && res.files.length === 0 && <p className="text-xs text-muted-foreground">No changes.</p>}
        {res?.files.map((f, i) => (
          <Disclosure key={f.path} head={
            <>
              <Badge tone={f.status === 'A' ? 'ok' : f.status === 'D' ? 'danger' : 'primary'}>{f.status}</Badge>
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{f.path}</span>
              <Stat add={f.additions} del={f.deletions} />
            </>
          }>
            <Diff diff={chunks[i] ?? ''} path={f.path} />
          </Disclosure>
        ))}
      </div>
      {res && res.files.length > 0 && (
        <div className="flex items-center gap-2 border-t border-border p-3">
          <Input className="min-w-0 flex-1" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Commit message / PR title" aria-label="Commit message" />
          <div className="flex">
            <Button className="rounded-r-none" disabled={busy} onClick={() => need(() => run(async () => { await window.api.commitSession(sessionId, msg); setMsg(''); actions.ok('Committed') }))}><GitCommit />Commit</Button>
            <Menu>
              <Tip label="More"><MenuTrigger asChild><Button className="rounded-l-none border-l border-primary-foreground/20" size="icon" disabled={busy} aria-label="More commit actions"><ChevronDown /></Button></MenuTrigger></Tip>
              <MenuContent>
                <MenuItem onSelect={() => run(() => window.api.pushSession(sessionId).then((r) => { actions.ok('Pushed'); return r }))}><Upload />Push</MenuItem>
                <MenuItem onSelect={() => need(() => run(() => window.api.createPr(sessionId, msg, '').then((r) => { actions.ok('Pull request created'); return r })))}><GitPullRequest />Create PR</MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </div>
      )}
    </div>
  )
}