import { useEffect, useState } from 'react'
import { CornerDownLeft, GitBranch, Plus, X } from 'lucide-react'
import { PROVIDERS, hasAccounts, type PermissionMode, type ProviderId } from '../../../shared/types'
import { actions, useStore } from '../store'
import { Button } from './ui/button'
import { Textarea } from './ui/input'
import { COLORS, SHAPES, ProjectAvatar } from './Avatar'
import ProviderIcon from './ProviderIcon'
import { DialogShell, DialogTitle } from './ui/dialog'
import { Pick } from './ui/pick'
import { MODES, MODE_LABEL } from '../lib/modes'
import { cn } from '../lib/utils'

/** Quick create: a prompt box with the project, agent, model and permission mode as compact pickers. Enter creates; Shift+Enter is a new line. */
export default function NewSessionForm({ projectId }: { projectId: string }): React.JSX.Element {
  const { accounts, forkText, settings, catalog, projects } = useStore()
  const [pid, setPid] = useState(projectId)
  const [provider, setProvider] = useState<ProviderId>(settings.defaultProvider)
  const [accountId, setAccountId] = useState('')
  const entry = catalog[provider]
  const models = entry?.models ?? []
  const modes = entry?.modes.length ? entry.modes : MODES
  const [model, setModel] = useState('')
  const [mode, setMode] = useState<PermissionMode>('supervised')
  const [useWorktree, setUseWorktree] = useState(true)
  const [msg, setMsg] = useState(forkText)
  const [busy, setBusy] = useState(false)
  /** Extra agents that get the same prompt, each in its own worktree. */
  const [extras, setExtras] = useState<{ provider: ProviderId; account: string; model: string }[]>([])
  const [look] = useState(() => ({ color: Math.floor(Math.random() * COLORS.length), shape: Math.floor(Math.random() * SHAPES.length) }))

  useEffect(() => { // defaults for the chosen provider, once its models are known
    if (!entry) return
    const m = entry.models, pm = entry.modes
    setModel(m.find((x) => x.id === settings.defaultModels[provider])?.id ?? m[0]?.id ?? ''); setMode(pm.includes(settings.defaultMode) ? settings.defaultMode : (pm[0] ?? 'supervised'))
  }, [provider, entry])

  const submit = async (e?: React.FormEvent): Promise<void> => {
    e?.preventDefault()
    if (!msg.trim() || busy) return
    setBusy(true)
    try {
      const groupId = extras.length ? crypto.randomUUID() : undefined
      let first: string | undefined
      // One at a time: parallel `git worktree add` calls on one repo race on its lock.
      for (const run of [{ provider, account: accountId, model }, ...extras]) {
        const s = await window.api.createSession({ projectId: pid, provider: run.provider, model: run.model || undefined, permissionMode: mode, useWorktree: useWorktree || !!groupId, accountId: run.account || undefined, firstMessage: msg.trim(), avatar: first ? undefined : look, groupId })
        actions.upsertSession(s)
        first ??= s.id
      }
      actions.select(first!)
    } catch (err) {
      actions.fail(err)
      setBusy(false)
    }
  }

  const project = projects.find((p) => p.id === pid)
  // One list for the agent picker: each provider's default login, then its saved accounts.
  const agents = PROVIDERS.flatMap((p) => [
    { id: `${p.id}:`, label: `${p.label}`, provider: p.id, account: '' },
    ...(hasAccounts(p.id) ? accounts.filter((a) => a.provider === p.id).map((a) => ({ id: `${p.id}:${a.id}`, label: `${p.label} · ${a.label}`, provider: p.id, account: a.id })) : [])
  ])
  const risky = mode === 'full-access'
  return (
    <DialogShell open onOpenChange={(o) => !o && actions.closeNew()} className="top-[18%] left-1/2 w-[min(44rem,92vw)] -translate-x-1/2 overflow-hidden">
      <DialogTitle className="sr-only">New session</DialogTitle>
      <form onSubmit={submit} className="flex flex-col">
        <div className="flex h-12 items-center gap-1 border-b border-border px-3">
          <Pick label="Project" align="start" value={pid} onPick={setPid} options={projects.map((p) => ({ id: p.id, label: p.name }))} className="text-foreground">
            <ProjectAvatar name={project?.name ?? ''} size={20} /><span className="text-prose font-medium">{project?.name}</span>
          </Pick>
            <Button type="button" variant="ghost" size="icon" aria-label="Separate git worktree" aria-pressed={useWorktree} className={cn(useWorktree ? 'text-foreground' : 'text-faint')} onClick={() => setUseWorktree(!useWorktree)}><GitBranch /></Button>
          <Pick label="Agent" className="ml-auto" value={`${provider}:${accountId}`} options={agents} onPick={(id) => { const a = agents.find((x) => x.id === id); if (a) { setProvider(a.provider); setAccountId(a.account) } }}>
            <ProviderIcon id={provider} />
          </Pick>
        </div>
        <Textarea
          autoFocus rows={7} aria-label="What should it do?" placeholder="Describe what to do…" value={msg} onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit() } }}
          className="resize-none rounded-none border-0 bg-transparent px-4 py-3 text-prose focus-visible:outline-none"
        />
        <div className="flex items-center gap-1 px-3 py-2">
          <Pick label="Model" align="start" value={model} onPick={setModel} options={models.length ? models.map((m) => ({ id: m.id, label: m.label })) : [{ id: '', label: entry ? 'Provider default' : 'Loading…' }]}>
            <span className="text-prose text-foreground">{models.find((m) => m.id === model)?.label ?? (entry ? 'Provider default' : 'Loading…')}</span>
          </Pick>
          <Pick label="Permission mode" align="start" value={mode} onPick={(m) => setMode(m as PermissionMode)} options={modes.map((m) => ({ id: m, label: MODE_LABEL[m] }))} className={cn(risky && 'text-destructive')}>
            <span className="text-prose">{MODE_LABEL[mode]}</span>
          </Pick>
          {extras.map((x, i) => (
            <Button key={i} type="button" variant="outline" size="sm" aria-label={`Remove ${agents.find((a) => a.provider === x.provider && a.account === x.account)?.label}`} onClick={() => setExtras(extras.filter((_, j) => j !== i))}>
              <ProviderIcon id={x.provider} />{catalog[x.provider]?.models.find((m) => m.id === x.model)?.label ?? 'Default'}<X />
            </Button>
          ))}
          <Pick label="Add agent" align="start" value="" onPick={(id) => { const a = agents.find((x) => x.id === id); if (a) setExtras([...extras, { provider: a.provider, account: a.account, model: settings.defaultModels[a.provider] ?? catalog[a.provider]?.models[0]?.id ?? '' }]) }} options={agents}>
            <Plus className="size-3.5" /><span className="text-prose">Agent</span>
          </Pick>
          <Button type="submit" className="ml-auto" loading={busy} disabled={!msg.trim()}>{extras.length ? `Create ${extras.length + 1}` : 'Create'}<CornerDownLeft /></Button>
        </div>
      </form>
    </DialogShell>
  )
}
