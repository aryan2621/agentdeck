import { Fragment, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { ProjectAvatar } from '../../components/Avatar'
import { pageOf } from '../../lib/settingsPages'
import { RepoActions, RepoGeneral, RepoGit, RepoScripts } from './RepoSettings'
import ProjectTools from '../../components/ProjectTools'
import { PROVIDERS, hasAccounts, type AccountProvider, type ProviderId } from '../../../../shared/types'
import { actions, useStore } from '../../state/store'
import { SettingsRow, SettingsSection } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { Badge } from '../../components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Button } from '../../components/ui/button'
import Limits from '../../components/Limits'
import { Kbd } from '../../components/ui/kbd'
import { ConfirmDialog } from '../../components/ui/dialog'
import { SHORTCUTS } from '../../lib/shortcuts'
import UsageView from '../../components/UsageView'
import AppearancePage from './AppearancePage'
import DefaultModelsPage from './DefaultModelsPage'
import GitPage from './GitPage'
import AdvancedPage from './AdvancedPage'
import AccountProfile from './AccountProfile'
import { AgentAuth, ClaudeExtras } from './AgentAuth'
import GeneralPage from './GeneralPage'
import EnvironmentPage from './EnvironmentPage'
import ExperimentalPage from './ExperimentalPage'
import ArtifactsPage from './ArtifactsPage'


export default function SettingsPanel(): React.JSX.Element {
  const { settings, accounts, view, catalog, projects } = useStore()
  const [label, setLabel] = useState('')
  const [prov, setProv] = useState<AccountProvider>('claude')
  const page = pageOf(view.kind === 'settings' ? view : {})
  const tab = page.tab
  const [saved, setSaved] = useState(false)
  useEffect(() => { if (!saved) return; const t = setTimeout(() => setSaved(false), 1500); return () => clearTimeout(t) }, [saved])
  const save = (patch: Parameters<typeof actions.saveSettings>[0]): Promise<void> => actions.saveSettings(patch).then(() => setSaved(true))
  const [removing, setRemoving] = useState<{ id: string; label: string } | null>(null)
  const [found, setFound] = useState<Record<string, boolean>>({})
  const [info, setInfo] = useState<{ label: string; value: string }[]>([])
  const [agent, setAgent] = useState<ProviderId>(settings.defaultProvider)
  const check = (): void => {
    void window.api.agentInfo(agent).then(setInfo, () => setInfo([]))
    void Promise.all([...PROVIDERS.map((p) => p.id), 'gh' as const].map(async (id) => [id, await window.api.checkTool(id)] as const)).then((r) => setFound(Object.fromEntries(r)))
  }
  useEffect(() => { if (tab === 'Agents' && !page.projectId) check() }, [tab, agent, settings.cliPaths]) // eslint-disable-line react-hooks/exhaustive-deps
  const repo = page.projectId ? projects.find((p) => p.id === page.projectId) : undefined
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Same height as the nav's Back row so the rules line up. */}
      <div className="h-10 shrink-0 border-b border-border [-webkit-app-region:drag]" aria-hidden />
      <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="settings-page flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <div className="flex items-center gap-3"><h1 className="text-[24px] leading-8 font-medium">{page.title}</h1><span aria-live="polite" className="text-small text-ok">{saved ? 'Saved' : ''}</span></div>
        </header>
        {repo && tab === 'General' && <><div className="flex items-center gap-4 border-b border-border pb-5"><ProjectAvatar name={repo.name} size={64} /><h2 className="text-[20px] font-medium">{repo.name}</h2></div><RepoGeneral key={repo.id} project={repo} settings={settings} save={(p) => void save(p)} /></>}
        {repo && tab === 'Git' && <RepoGit key={repo.id} project={repo} settings={settings} save={(p) => void save(p)} />}
        {repo && tab === 'Actions' && <RepoActions key={repo.id} project={repo} />}
        {repo && tab === 'Scripts' && <RepoScripts key={repo.id} project={repo} />}
        {repo && tab === 'History & MCP' && <ProjectTools key={repo.id} projectId={repo.id} />}
        {!page.projectId && tab === 'General' && <GeneralPage settings={settings} save={(p) => void save(p)} />}
        {!page.projectId && tab === 'Environment' && <EnvironmentPage settings={settings} save={(p) => void save(p)} />}
        {repo && tab === 'Environment' && <EnvironmentPage key={repo.id} projectId={repo.id} settings={settings} save={(p) => void save(p)} />}
        {!page.projectId && tab === 'Experimental' && <ExperimentalPage settings={settings} save={(p) => void save(p)} />}
        {!page.projectId && tab === 'Artifacts' && <ArtifactsPage />}
        {!page.projectId && tab === 'Default models' && <DefaultModelsPage settings={settings} catalog={catalog} save={(p) => void save(p)} />}
        {!page.projectId && tab === 'Git' && <GitPage settings={settings} save={(p) => void save(p)} />}
        {!page.projectId && tab === 'Advanced' && <AdvancedPage settings={settings} save={(p) => void save(p)} />}
        {!page.projectId && tab === 'Appearance' && <AppearancePage settings={settings} save={(p) => void save(p)} />}
        {!page.projectId && tab === 'Keyboard shortcuts' && (
          <>
            {[['Global', (id: string) => !['approve', 'always', 'deny'].includes(id)], ['When approving', (id: string) => ['approve', 'always', 'deny'].includes(id)]].map(([title, f]) => (
              <SettingsSection key={title as string} title={title as string}>
                {SHORTCUTS.filter((k) => (f as (id: string) => boolean)(k.id)).map((k) => <SettingsRow key={k.id} label={k.label}><Kbd>{k.keys}</Kbd></SettingsRow>)}
              </SettingsSection>
            ))}
          </>
        )}
        {!page.projectId && tab === 'Account' && <>
          <AccountProfile settings={settings} save={(p) => void save(p)} />
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
                <Input className="w-56" placeholder="e.g. Work" aria-label="Account name" value={label} onChange={(e) => setLabel(e.target.value)} />
                <Button variant="outline" disabled={!label.trim()}>Add</Button>
              </SettingsRow>
            </SettingsSection>
          </form>
          <Limits />
        </>}
        {!page.projectId && tab === 'Usage' && <UsageView />}
        {!page.projectId && tab === 'Agents' && (
          <>
            <Tabs value={agent} onValueChange={(v) => setAgent(v as ProviderId)}>
              <TabsList aria-label="Agent" className="gap-7 border-b border-border px-0 py-0">
                {PROVIDERS.map((p) => <TabsTrigger key={p.id} value={p.id} className="-mb-px h-10 rounded-none border-b-2 border-transparent bg-transparent px-0 text-prose font-medium data-[state=active]:border-ring data-[state=active]:bg-transparent">{p.label}</TabsTrigger>)}
              </TabsList>
            </Tabs>
            <AgentAuth agent={agent} cliFound={found[agent]} />
            {agent === 'claude' && <ClaudeExtras settings={settings} save={(p) => void save(p)} />}
            {info.length > 0 && (
              <dl aria-label="Account details" className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-2.5 rounded-md border border-border px-4 py-3 text-small">
                {info.map((r) => (
                  <Fragment key={r.label}>
                    <dt className="text-muted-foreground">{r.label}</dt>
                    <dd className={`m-0 truncate text-foreground ${r.label === 'Version' || r.label === 'Email' ? 'font-mono' : ''}`} title={r.value}>{r.value}</dd>
                  </Fragment>
                ))}
              </dl>
            )}
            <SettingsSection title="Status">
              <SettingsRow label={found[agent] === undefined ? 'Checking…' : found[agent] ? 'Connected' : 'Not found'} description={found[agent] === false ? 'Not on your PATH and no path set below.' : undefined}>
                <ToolState ok={found[agent]} />
                <Button variant="outline" onClick={check}>Refresh</Button>
              </SettingsRow>
              <SettingsRow stacked label={`${PROVIDERS.find((p) => p.id === agent)?.label} executable path`} description="Leave empty to use the command on your PATH. Applies to sessions started after you change it.">
                <Input
                  key={`${agent}${settings.cliPaths[agent] ?? ''}`} className="flex-1 font-mono" defaultValue={settings.cliPaths[agent] ?? ''}
                  placeholder="/usr/local/bin/…" aria-label={`${agent} path`}
                  onBlur={(e) => { if (e.target.value !== (settings.cliPaths[agent] ?? '')) void save({ cliPaths: { [agent]: e.target.value.trim() } }) }}
                />
              </SettingsRow>
            </SettingsSection>
          </>
        )}
      <ConfirmDialog
        open={!!removing} onOpenChange={(o) => !o && setRemoving(null)} destructive
        title={`Remove ${removing?.label ?? 'account'}?`} confirmLabel="Remove"
        description="Deletes this login and its saved credentials from AgentDeck. Not allowed while sessions use it."
        onConfirm={() => removing && void actions.removeAccount(removing.id)}
      />
      </div>
      </div>
    </div>
  )
}

const ToolState = ({ ok }: { ok?: boolean }): React.JSX.Element | null =>
  ok === undefined ? null : <Badge tone={ok ? 'ok' : 'warn'}>{ok ? 'Found' : 'Not found'}</Badge>
