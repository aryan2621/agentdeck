import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { PROVIDERS, hasAccounts, type AccountProvider, type NotifyKind, type PermissionMode, type ProviderId } from '../../../shared/types'
import { actions, useStore } from '../store'
import { Checkbox } from './ui/checkbox'
import { Field } from './ui/field'
import { Input } from './ui/input'
import { Select } from './ui/select'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import Limits from './Limits'
import { cn } from '../lib/utils'

const MODES: PermissionMode[] = ['supervised', 'auto-edit', 'full-access', 'plan']
const NOTIFY: { kind: NotifyKind; label: string }[] = [
  { kind: 'done', label: 'A session finishes' },
  { kind: 'needs-you', label: 'A session needs your approval' },
  { kind: 'error', label: 'A session fails' },
]

const SECTIONS = ['General', 'Accounts', 'Notifications', 'CLI paths'] as const

export default function SettingsPanel(): React.JSX.Element {
  const { settings, accounts } = useStore()
  const [label, setLabel] = useState('')
  const [prov, setProv] = useState<AccountProvider>('claude')
  const [tab, setTab] = useState<(typeof SECTIONS)[number]>('General')
  const save = actions.saveSettings
  return (
    <div className="flex min-h-0 flex-1">
      <nav className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-border p-2" aria-label="Settings sections">
        <h2 className="px-2 py-1.5 text-sm font-semibold">Settings</h2>
        {SECTIONS.map((t) => (
          <button key={t} aria-current={t === tab} onClick={() => setTab(t)} className={cn('rounded-md px-2 py-1.5 text-left transition-colors duration-100 hover:bg-accent', t === tab && 'bg-accent font-medium')}>{t}</button>
        ))}
      </nav>
      <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-6 [&>*]:w-full [&>*]:max-w-xl">
      {tab === 'General' && <>
        <Field label="Default provider">
          <Select label="Default provider" className="w-full" value={settings.defaultProvider} onChange={(v) => void save({ defaultProvider: v as ProviderId })} options={PROVIDERS.map((p) => ({ value: p.id, label: p.label }))} />
        </Field>
        <Field label="Default permission mode">
          <Select label="Default permission mode" className="w-full" value={settings.defaultMode} onChange={(v) => void save({ defaultMode: v as PermissionMode })} options={MODES.map((m) => ({ value: m, label: m }))} />
        </Field>
        <Field label="Default model">
          <Input
            key={settings.defaultModels[settings.defaultProvider] ?? ''}
            defaultValue={settings.defaultModels[settings.defaultProvider] ?? ''}
            placeholder="Model id; empty = provider default"
            aria-label="Default model"
            onBlur={(e) => { if (e.target.value.trim() !== (settings.defaultModels[settings.defaultProvider] ?? '')) void save({ defaultModels: { [settings.defaultProvider]: e.target.value.trim() } }) }}
          />
        </Field>
      </>}
      {tab === 'Accounts' && <>
        {accounts.map((a) => (
          <div key={a.id} className="flex items-center gap-2 text-xs"><span className="flex-1 truncate">{a.label}</span><Badge>{a.provider}</Badge></div>
        ))}
        <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); void actions.addAccount(prov, label); setLabel('') }}>
          <Field label="Provider">
            <Select label="Provider" className="w-full" value={prov} onChange={(v) => setProv(v as AccountProvider)} options={PROVIDERS.filter((x) => hasAccounts(x.id)).map((x) => ({ value: x.id, label: x.label }))} />
          </Field>
          <Field label="Account name">
            <div className="flex gap-2"><Input value={label} onChange={(e) => setLabel(e.target.value)} /><Button disabled={!label.trim()}><UserPlus />Add</Button></div>
          </Field>
        </form>
        <Limits />
      </>}
      {tab === 'Notifications' && <>
        <div className="font-medium">Notify me when</div>
        {NOTIFY.map((n) => (
          <label key={n.kind} className="flex items-center gap-2">
            <Checkbox checked={settings.notify[n.kind]} onCheckedChange={(c) => void save({ notify: { ...settings.notify, [n.kind]: c === true } })} />{n.label}
          </label>
        ))}
      </>}
      {tab === 'CLI paths' && <>
        <p className="text-xs text-muted-foreground">Leave empty to use the command found on your PATH. Applies to sessions started after you change it.</p>
        {PROVIDERS.map((p) => (
          <Field key={p.id} label={p.label}>
            <Input
              key={settings.cliPaths[p.id] ?? ''}
              className="font-mono"
              defaultValue={settings.cliPaths[p.id] ?? ''}
              placeholder="/usr/local/bin/…"
              aria-label={`${p.label} path`}
              onBlur={(e) => { if (e.target.value !== (settings.cliPaths[p.id] ?? '')) void save({ cliPaths: { [p.id]: e.target.value.trim() } }) }}
            />
          </Field>
        ))}
      </>}
      </div>
    </div>
  )
}
