import { useEffect, useState } from 'react'
import { Play, Plus, X } from 'lucide-react'
import type { ProjectConfig } from '../../../shared/ipc'
import { actions } from '../store'
import { Button } from './ui/button'
import { Input } from './ui/input'

/** What the agentdeck.json setup script printed when this session's worktree was created. */
export function SetupTab({ sessionId, projectId }: { sessionId: string; projectId: string }): React.JSX.Element {
  const [out, setOut] = useState<{ setup?: string; output: string } | null>(null)
  useEffect(() => { void Promise.all([window.api.getProjectConfig(projectId), window.api.setupOutput(sessionId)]).then(([c, o]) => setOut({ setup: c.setup, output: o.output }), actions.fail) }, [sessionId, projectId])
  if (!out) return <></>
  if (!out.setup) return <p className="p-3 text-body text-muted-foreground">No setup script. Add a setup command to agentdeck.json in repository settings, Scripts.</p>
  return <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-3">
    <div className="font-mono text-small text-muted-foreground">$ {out.setup}</div>
    <pre className="whitespace-pre-wrap break-all font-mono text-small" aria-label="Setup output">{out.output.trim() || 'Setup finished with no output.'}</pre>
  </div>
}

/** Actions from the repo's agentdeck.json; Run types the command into the session terminal. */
export default function RunTab({ projectId, onRun, page }: { projectId: string; onRun?: (command: string) => void; page?: boolean }): React.JSX.Element {
  const [cfg, setCfg] = useState<ProjectConfig | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ name: '', command: '' })
  useEffect(() => { window.api.getProjectConfig(projectId).then(setCfg, actions.fail) }, [projectId])
  if (!cfg) return <></>
  const list = cfg.actions ?? []
  const save = (next: typeof list): void => {
    window.api.setProjectConfig(projectId, { ...cfg, actions: next }).then(() => setCfg({ ...cfg, actions: next }), actions.fail)
  }
  const add = (): void => {
    if (!draft.name.trim() || !draft.command.trim()) return
    save([...list, draft]); setDraft({ name: '', command: '' }); setAdding(false)
  }
  return (
    <div className={page ? 'flex flex-col gap-4 border-b border-border pb-6' : 'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3'}>
      {page && (
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-prose font-medium">Custom actions</h2><p className="text-prose text-muted-foreground">Shortcuts for quick actions, like running your dev server or test suite. Run them from the Run tab.</p></div>
          {!adding && <Button variant="outline" className="shrink-0" onClick={() => setAdding(true)}><Plus />Add action</Button>}
        </div>
      )}
      {list.length === 0 && !adding && !page && (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border p-6 text-center text-body text-muted-foreground">
          Run tests or a development server to test changes in this workspace
          <Button variant="outline" onClick={() => setAdding(true)}>Add action</Button>
        </div>
      )}
      {page && list.length === 0 && !adding && <p className="text-prose text-muted-foreground">No custom actions yet. Add one to get started.</p>}
      <div className={page && list.length ? 'rounded-md border border-border' : 'contents'}>
      {list.map((a, i) => (
        <div key={a.name + i} className={page ? 'flex h-10 items-center gap-2 border-b border-border px-3 text-prose last:border-b-0' : 'flex h-8 items-center gap-2 text-body'}>
          {onRun && <Button variant="ghost" size="icon" className="size-6" aria-label={`Run ${a.name}`} onClick={() => onRun(a.command)}><Play /></Button>}
          <span className="shrink-0 font-medium">{a.name}</span>
          <span className="min-w-0 flex-1 truncate font-mono text-small text-muted-foreground">{a.command}</span>
          <Button variant="ghost" size="icon" className="size-6" aria-label={`Remove ${a.name}`} onClick={() => save(list.filter((_, j) => j !== i))}><X /></Button>
        </div>
      ))}
      </div>
      {adding ? (
        <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); add() }}>
          <Input autoFocus aria-label="Action name" placeholder="Name, e.g. Dev server" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Input aria-label="Command" className="font-mono" placeholder="pnpm dev" value={draft.command} onChange={(e) => setDraft({ ...draft, command: e.target.value })} />
          <div className="flex gap-2"><Button variant="default" type="submit">Save</Button><Button variant="outline" type="button" onClick={() => setAdding(false)}>Cancel</Button></div>
        </form>
      ) : !page && list.length > 0 && <div><Button variant="ghost" onClick={() => setAdding(true)}><Plus />Add action</Button></div>}
    </div>
  )
}
