import { useEffect, useState } from 'react'
import type { ModelInfo } from '../../../shared/ipc'
import { PROVIDERS, hasAccounts, type PermissionMode, type ProviderId } from '../../../shared/types'
import { actions, useStore } from '../store'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Field } from './ui/field'
import { Input, Textarea } from './ui/input'
import Avatar, { COLORS, SHAPES } from './Avatar'
import { STARTERS } from '../lib/starters'
import { cn } from '../lib/utils'
import { Select } from './ui/select'
import { Kbd } from './ui/kbd'
import { Menu, MenuContent, MenuTrigger } from './ui/menu'
import { MODES } from '../lib/modes'
import { ModeSelector } from './ModeSelector'


/** Roving-tabindex radio row; arrow keys move and select. */
function Picker({ label, count, value, onChange, children }: { label: string; count: number; value: number; onChange: (i: number) => void; children: (i: number, on: boolean) => React.ReactNode }): React.JSX.Element {
  const key = (e: React.KeyboardEvent): void => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const n = (value + d + count) % count
    onChange(n)
    ;(e.currentTarget.children[n] as HTMLElement).focus()
  }
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={key} className="flex flex-wrap justify-center gap-2">
      {Array.from({ length: count }, (_, i) => (
        <button key={i} type="button" role="radio" aria-checked={i === value} aria-label={`${label} ${i + 1}`} tabIndex={i === value ? 0 : -1} onClick={() => onChange(i)}
          className={cn('flex size-8 items-center justify-center rounded-lg border border-transparent', i === value && 'border-border bg-muted')}>
          {children(i, i === value)}
        </button>
      ))}
    </div>
  )
}

export default function NewSessionForm({ projectId }: { projectId: string }): React.JSX.Element {
  const { accounts, forkText, settings } = useStore()
  const [provider, setProvider] = useState<ProviderId>(settings.defaultProvider)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [modes, setModes] = useState<PermissionMode[]>(MODES)
  const [model, setModel] = useState('')
  const [mode, setMode] = useState<PermissionMode>('supervised')
  const [useWorktree, setUseWorktree] = useState(true)
  const [accountId, setAccountId] = useState('')
  const [msg, setMsg] = useState(forkText)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [look, setLook] = useState(() => ({ color: Math.floor(Math.random() * COLORS.length), shape: Math.floor(Math.random() * SHAPES.length) }))

  useEffect(() => {
    let live = true
    setLoading(true)
    Promise.all([window.api.listModels(provider), window.api.providerModes(provider)]).then(([m, pm]) => {
      if (!live) return
      setModels(m); setModel(m.find((x) => x.id === settings.defaultModels[provider])?.id ?? m[0]?.id ?? ''); setModes(pm); setMode(pm.includes(settings.defaultMode) ? settings.defaultMode : (pm[0] ?? 'supervised')); setLoading(false)
    }, (err) => { setLoading(false); actions.fail(err) })
    return () => { live = false }
  }, [provider])

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    try {
      const s = await window.api.createSession({
        projectId, provider, model: model || undefined, permissionMode: mode, useWorktree, accountId: accountId || undefined,
        firstMessage: msg.trim() || undefined, title: name.trim() || undefined, avatar: look
      })
      actions.upsertSession(s)
      actions.select(s.id)
    } catch (err) {
      actions.fail(err)
      setBusy(false)
    }
  }

  const go = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => e.currentTarget.form?.requestSubmit()
  return (
    <form className="flex min-h-0 flex-1 flex-col overflow-y-auto" onSubmit={submit}>
      <div className="mx-auto mt-auto flex w-full max-w-[640px] flex-col gap-4 px-8 pt-12 pb-6">
        <div className="flex items-center gap-3">
          <Avatar seed={projectId} avatar={look} size={40} />
          <Menu>
            <MenuTrigger asChild><Button type="button" variant="ghost" size="sm">Customise look</Button></MenuTrigger>
            <MenuContent>
              <div className="flex flex-col gap-2 p-2">
                <Picker label="Colour" count={COLORS.length} value={look.color} onChange={(color) => setLook({ ...look, color })}>
                  {(i) => <span className="size-5 rounded-full" style={{ background: COLORS[i] }} />}
                </Picker>
                <Picker label="Shape" count={SHAPES.length} value={look.shape} onChange={(shape) => setLook({ ...look, shape })}>
                  {(i, on) => <span className={cn('size-5', on ? 'bg-foreground' : 'bg-faint')} style={{ borderRadius: SHAPES[i] }} />}
                </Picker>
              </div>
            </MenuContent>
          </Menu>
          <Input aria-label="Name (optional)" placeholder="Name (optional)" className="ml-auto max-w-64" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Field label="What should it do?" className="w-full">
          <Textarea autoFocus rows={5} className="bg-panel text-prose focus-visible:ring-1" value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) go(e) }} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Provider"><Select label="Provider" className="w-full" value={provider} onChange={(v) => { setProvider(v as ProviderId); setAccountId('') }} options={PROVIDERS.map((p) => ({ value: p.id, label: p.label }))} /></Field>
          <Field label="Model"><Select label="Model" className="w-full" value={model} onChange={setModel} options={loading ? [{ value: '', label: 'Loading…' }] : models.length ? models.map((m) => ({ value: m.id, label: m.label })) : [{ value: '', label: 'Provider default' }]} /></Field>
          {hasAccounts(provider) && <Field label="Account"><Select label="Account" className="w-full" value={accountId} onChange={setAccountId} options={[{ value: '', label: 'Default login' }, ...accounts.filter((a) => a.provider === provider).map((a) => ({ value: a.id, label: a.label }))]} /></Field>}
          <div className="col-span-2 flex flex-col"><span className="mb-1 text-small font-medium text-muted-foreground">Permission mode</span><ModeSelector value={mode} modes={modes} onChange={setMode} /></div>
        </div>
        <label className="flex items-center gap-2 text-small text-muted-foreground">
          <Checkbox checked={useWorktree} onCheckedChange={(c) => setUseWorktree(c === true)} />Work in a separate git worktree
        </label>
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={actions.closeNew}>Cancel</Button>
          <Button type="submit" loading={busy}>Get started<Kbd className="bg-primary-foreground/15 text-primary-foreground">⌘↵</Kbd></Button>
        </div>
      </div>
      <div className="mx-auto mb-auto flex w-full max-w-[640px] flex-col gap-2 px-8 pb-10">
        <span className="text-small text-faint">Suggestions</span>
        <div className="flex flex-col divide-y divide-border border-y border-border">
          {STARTERS.map((s) => (
            <button key={s.title} type="button" onClick={() => setMsg(s.prompt)} className="flex items-baseline gap-3 px-2 py-2 text-left transition-colors duration-100 hover:bg-accent focus-visible:bg-accent">
              <span className="text-body font-medium text-foreground">{s.title}</span>
              <span className="text-small text-muted-foreground">{s.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </form>
  )
}
