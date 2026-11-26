import { useEffect, useState } from 'react'
import { Check, GitBranch } from 'lucide-react'
import { ProjectAvatar } from '../../components/Avatar'
import { SettingsRow, ToggleRow } from '../../components/ui/field'
import { Select } from '../../components/ui/select'
import { Button } from '../../components/ui/button'
import type { Settings } from '../../../../shared/types'

const CODEX = [{ value: 'default', label: 'Default' }, { value: 'untrusted', label: 'Ask before running commands' }, { value: 'never', label: 'Never ask' }]
const ICON_BOX = 'flex size-10 shrink-0 items-center justify-center rounded-md border border-border'

/** Account page top: profile from git/gh config, GitHub connection, privacy and tool-approval toggles. */
export default function AccountProfile({ settings, save }: { settings: Settings; save: (p: Partial<Settings>) => void }): React.JSX.Element {
  const [id, setId] = useState<{ name: string; email: string; login: string | null } | null>(null)
  useEffect(() => { void window.api.gitIdentity().then(setId, () => {}) }, [])
  const name = id?.name || id?.login || 'AgentDeck'
  const toggle = (key: 'claudeToolApprovals', label: string, description?: string): React.JSX.Element => (
    <ToggleRow label={label} description={description} checked={settings[key]} onChange={(v) => save({ [key]: v })} />
  )
  return (
    <div className="flex flex-col divide-y divide-border">
      <div className="flex items-center gap-4 pb-5">
        <ProjectAvatar name={name} size={64} />
        <div><h2 className="text-[20px] leading-7 font-medium">{name}</h2>{id?.email && <p className="text-prose text-muted-foreground">{id.email}</p>}</div>
      </div>
      <div className="flex min-h-16 items-center gap-4 py-3">
        <span className={ICON_BOX}><GitBranch className="size-5" strokeWidth={1.5} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <div className="text-prose font-medium">GitHub</div>
          <p className="text-prose text-muted-foreground">{id === null ? 'Checking gh…' : id.login ? `Signed in to gh as ${id.login}. Used to clone repos, create PRs and load comments.` : <>Not connected. Run <code className="rounded-sm bg-muted px-1 font-mono text-small">gh auth login</code> in a terminal, then reopen this page.</>}</p>
        </div>
        {id?.login && <Button variant="outline" asChild><a href="https://github.com/settings/applications" target="_blank" rel="noreferrer">Manage<Check className="text-ok" aria-hidden /></a></Button>}
      </div>
      {toggle('claudeToolApprovals', 'Claude Code tool approvals', 'Require manual approval before agents can run tools.')}
      <SettingsRow label="Codex tool approvals"><Select label="Codex tool approvals" className="w-56" value={settings.codexApprovals} onChange={(v) => save({ codexApprovals: v as Settings['codexApprovals'] })} options={CODEX} /></SettingsRow>
    </div>
  )
}
