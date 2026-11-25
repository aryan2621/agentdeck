import { useEffect, useState } from 'react'
import type { ModelInfo } from '../../../shared/ipc'
import { PROVIDERS, hasAccounts, type PermissionMode, type ProviderId } from '../../../shared/types'
import { actions, useStore } from '../store'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Field } from './ui/field'
import { Textarea } from './ui/input'
import { Select } from './ui/select'

export default function NewSessionForm({ projectId }: { projectId: string }): React.JSX.Element {
  const { accounts, forkText, settings } = useStore()
  const [provider, setProvider] = useState<ProviderId>(settings.defaultProvider)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [modes, setModes] = useState<PermissionMode[]>([])
  const [model, setModel] = useState('')
  const [mode, setMode] = useState<PermissionMode>('supervised')
  const [useWorktree, setUseWorktree] = useState(true)
  const [accountId, setAccountId] = useState('')
  const [msg, setMsg] = useState(forkText)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    Promise.all([window.api.listModels(provider), window.api.providerModes(provider)]).then(([m, pm]) => {
      if (!live) return
      setModels(m); setModel(m.find((x) => x.id === settings.defaultModels[provider])?.id ?? m[0]?.id ?? ''); setModes(pm); setMode(pm.includes(settings.defaultMode) ? settings.defaultMode : (pm[0] ?? 'supervised'))
    }, actions.fail)
    return () => { live = false }
  }, [provider])

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    try {
      const s = await window.api.createSession({
        projectId, provider, model: model || undefined, permissionMode: mode, useWorktree, accountId: accountId || undefined,
        firstMessage: msg.trim() || undefined
      })
      actions.upsertSession(s)
      actions.select(s.id)
    } catch (err) {
      actions.fail(err)
      setBusy(false)
    }
  }

  return (
    <form className="flex w-full max-w-xl flex-col gap-4 overflow-y-auto p-6" onSubmit={submit}>
      <h2 className="text-base font-semibold">New session</h2>
      <Field label="What should the agent do?">
        <Textarea autoFocus rows={6} value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit() }} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Provider">
          <Select label="Provider" className="w-full" value={provider} onChange={(v) => { setProvider(v as ProviderId); setAccountId('') }} options={PROVIDERS.map((p) => ({ value: p.id, label: p.label }))} />
        </Field>
        {hasAccounts(provider) && (
          <Field label="Account">
            <Select label="Account" className="w-full" value={accountId} onChange={setAccountId} options={[{ value: '', label: 'Default login' }, ...accounts.filter((a) => a.provider === provider).map((a) => ({ value: a.id, label: a.label }))]} />
          </Field>
        )}
        <Field label="Model">
          <Select label="Model" className="w-full" value={model} onChange={setModel} options={models.length ? models.map((m) => ({ value: m.id, label: m.label })) : [{ value: '', label: 'Provider default' }]} />
        </Field>
        <Field label="Permission mode">
          <Select label="Permission mode" className="w-full" value={mode} onChange={(v) => setMode(v as PermissionMode)} options={modes.map((m) => ({ value: m, label: m }))} />
        </Field>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">Supervised asks before each edit or command. Other modes run with less confirmation.</p>
      <label className="flex items-center gap-2">
        <Checkbox checked={useWorktree} onCheckedChange={(c) => setUseWorktree(c === true)} />Work in a separate git worktree (keeps your checkout untouched)
      </label>
      <div className="flex gap-2">
        <Button variant="default" type="submit" disabled={busy}>Start session<kbd className="ml-1 font-sans opacity-70">⌘↵</kbd></Button>
        <Button type="button" onClick={actions.closeNew}>Cancel</Button>
      </div>
    </form>
  )
}
