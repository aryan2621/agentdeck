import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { PROVIDERS, hasAccounts, type AccountProvider, type NotifyKind, type PermissionMode, type ProviderId } from '../../../shared/types'
import { actions, useStore } from '../store'
import { Checkbox } from './ui/checkbox'
import { Loading, SettingsRow, SettingsSection } from './ui/field'
import { Input } from './ui/input'
import { Select } from './ui/select'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import Limits from './Limits'
import { MODES, MODE_LABEL } from '../lib/modes'
import { Row } from './ui/row'
import { Kbd } from './ui/kbd'
import { ConfirmDialog } from './ui/dialog'
import { SHORTCUTS } from '../lib/shortcuts'
import type { ModelInfo } from '../../../shared/ipc'
import { cn } from '../lib/utils'

const NOTIFY: { kind: NotifyKind; label: string }[] = [
  { kind: 'done', label: 'A session finishes' },
  { kind: 'needs-you', label: 'A session needs your approval' },
  { kind: 'error', label: 'A session fails' },
]

const SECTIONS = ['General', 'Appearance', 'Accounts', 'Notifications', 'Keyboard shortcuts', 'CLI paths'] as const
const THEMES = [{ value: 'system', label: 'Match system' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]

export default function SettingsPanel(): React.JSX.Element {
  const { settings, accounts, view } = useStore()
  const [label, setLabel] = useState('')
  const [prov, setProv] = useState<AccountProvider>('claude')
  const [tab, setTab] = useState<(typeof SECTIONS)[number]>(SECTIONS.find((s) => view.kind === 'settings' && s === view.tab) ?? 'General')
  const [saved, setSaved] = useState(false)
  useEffect(() => { if (!saved) return; const t = setTimeout(() => setSaved(false), 1500); return () => clearTimeout(t) }, [saved])
  const save = (patch: Parameters<typeof actions.saveSettings>[0]): Promise<void> => actions.saveSettings(patch).then(() => setSaved(true))
  const [models, setModels] = useState<ModelInfo[] | null>(null)
  useEffect(() => { setModels(null); window.api.listModels(settings.defaultProvider).then(setModels, () => setModels([])) }, [settings.defaultProvider])
  const [removing, setRemoving] = useState<{ id: string; label: string } | null>(null)
  const [found, setFound] = useState<Record<string, boolean>>({})
  useEffect(() => {
    if (tab === 'CLI paths') void Promise.all([...PROVIDERS.map((p) => p.id), 'gh' as const].map(async (id) => [id, await window.api.checkTool(id)] as const)).then((r) => setFound(Object.fromEntries(r)))
  }, [tab, settings.cliPaths])
  const dm = settings.defaultModels[settings.defaultProvider] ?? ''
  return (
    <div className="flex min-h-0 flex-1">
      <nav className="flex w-[200px] shrink-0 flex-col gap-0.5 border-r border-border bg-chrome p-3" aria-label="Settings sections">
        <h2 className="px-2 py-2 text-body font-medium">Settings</h2>
        {SECTIONS.map((t) => (
          <Row key={t} active={t === tab} onClick={() => setTab(t)} className={cn('h-8 items-center', t === tab && 'font-medium')}>{t}</Row>
        ))}
      </nav>
      <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-6 [&>*]:w-full [&>*]:max-w-[680px]">
        <div className="flex items-baseline gap-3"><h1 className="text-title">{tab}</h1><span aria-live="polite" className="text-small text-ok">{saved ? 'Saved' : ''}</span></div>
        {tab === 'General' && (
          <SettingsSection title="Defaults" description="Applied to new sessions.">
            <SettingsRow label="Provider">
              <Select label="Default provider" className="w-48" value={settings.defaultProvider} onChange={(v) => void save({ defaultProvider: v as ProviderId })} options={PROVIDERS.map((p) => ({ value: p.id, label: p.label }))} />
            </SettingsRow>
            <SettingsRow label="Permission mode">
              <Select label="Default permission mode" className="w-48" value={settings.defaultMode} onChange={(v) => void save({ defaultMode: v as PermissionMode })} options={MODES.map((m) => ({ value: m, label: MODE_LABEL[m] }))} />
            </SettingsRow>
            <SettingsRow label="Model" description="Used when a session does not pick one.">
              {models === null ? <Loading>Loading models…</Loading> : (
                <Select label="Default model" className="w-48" value={dm} onChange={(v) => void save({ defaultModels: { [settings.defaultProvider]: v } })} options={[{ value: '', label: 'Provider default' }, ...(dm && !models.some((m) => m.id === dm) ? [{ value: dm, label: dm }] : []), ...models.map((m) => ({ value: m.id, label: m.label }))]} />
              )}
            </SettingsRow>
          </SettingsSection>
        )}
        {tab === 'Appearance' && (
          <SettingsSection title="Theme">
            <SettingsRow label="Color theme" description="Match system follows macOS light and dark.">
              <Select label="Color theme" className="w-48" value={settings.theme} onChange={(v) => void save({ theme: v as typeof settings.theme })} options={THEMES} />
            </SettingsRow>
          </SettingsSection>
        )}
        {tab === 'Keyboard shortcuts' && (
          <SettingsSection title="Shortcuts">
            {SHORTCUTS.map((k) => <SettingsRow key={k.id} label={k.label}><Kbd>{k.keys}</Kbd></SettingsRow>)}
          </SettingsSection>
        )}
        {tab === 'Accounts' && <>
          <SettingsSection title="Accounts" description="Extra logins per provider. Sessions can be moved between them.">
            {accounts.length === 0 && <SettingsRow label="No accounts yet" description="Sessions use the default login." />}
            {accounts.map((a) => (
              <SettingsRow key={a.id} label={a.label}>
                <span className="font-mono text-small text-muted-foreground">{a.provider}</span>
                <Button variant="ghost" size="icon" aria-label={`Remove ${a.label}`} onClick={() => setRemoving(a)}><Trash2 /></Button>
              </SettingsRow>
            ))}
          </SettingsSection>
          <form onSubmit={(e) => { e.preventDefault(); void actions.addAccount(prov, label); setLabel('') }}>
            <SettingsSection title="Add account">
              <SettingsRow label="Provider">
                <Select label="Provider" className="w-48" value={prov} onChange={(v) => setProv(v as AccountProvider)} options={PROVIDERS.filter((x) => hasAccounts(x.id)).map((x) => ({ value: x.id, label: x.label }))} />
              </SettingsRow>
              <SettingsRow label="Name">
                <Input className="w-48" placeholder="e.g. Work" aria-label="Account name" value={label} onChange={(e) => setLabel(e.target.value)} />
                <Button disabled={!label.trim()}>Add</Button>
              </SettingsRow>
            </SettingsSection>
          </form>
          <Limits />
        </>}
        {tab === 'Notifications' && (
          <SettingsSection title="Notify me when">
            {NOTIFY.map((n) => (
              <SettingsRow key={n.kind} label={n.label}>
                <Checkbox aria-label={n.label} checked={settings.notify[n.kind]} onCheckedChange={(c) => void save({ notify: { ...settings.notify, [n.kind]: c === true } })} />
              </SettingsRow>
            ))}
          </SettingsSection>
        )}
        {tab === 'CLI paths' && (
          <SettingsSection title="Executables" description="Leave empty to use the command on your PATH. Applies to sessions started after you change it.">
            {PROVIDERS.map((p) => (
              <SettingsRow key={p.id} label={p.label}>
                <Input
                  key={settings.cliPaths[p.id] ?? ''} className="w-64 font-mono" defaultValue={settings.cliPaths[p.id] ?? ''}
                  placeholder="/usr/local/bin/…" aria-label={`${p.label} path`}
                  onBlur={(e) => { if (e.target.value !== (settings.cliPaths[p.id] ?? '')) void save({ cliPaths: { [p.id]: e.target.value.trim() } }) }}
                />
                <ToolState ok={found[p.id]} />
              </SettingsRow>
            ))}
            <SettingsRow label="GitHub CLI (gh)"><span className="text-small text-muted-foreground">Needed for Create PR</span><ToolState ok={found.gh} /></SettingsRow>
          </SettingsSection>
        )}
      </div>
      <ConfirmDialog
        open={!!removing} onOpenChange={(o) => !o && setRemoving(null)} destructive
        title={`Remove ${removing?.label ?? 'account'}?`} confirmLabel="Remove"
        description="Deletes this login and its saved credentials from AgentDeck. Not allowed while sessions use it."
        onConfirm={() => removing && void actions.removeAccount(removing.id)}
      />
    </div>
  )
}

const ToolState = ({ ok }: { ok?: boolean }): React.JSX.Element | null =>
  ok === undefined ? null : <Badge tone={ok ? 'ok' : 'warn'}>{ok ? 'Found' : 'Not found'}</Badge>
