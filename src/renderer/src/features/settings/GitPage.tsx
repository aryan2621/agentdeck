import { useEffect, useState } from 'react'
import { ToggleRow } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import type { Settings } from '../../../../shared/types'

const VALID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,29}$/
const code = 'rounded-sm bg-muted px-1 font-mono text-small'

type Flag = 'autoRenameBranches' | 'renameSessionOnBranch' | 'archiveOnMerge' | 'automerge' | 'optionalChecksBlocking' | 'ghStack' | 'deleteBranchOnArchive'
const FLAGS: { key: Flag; label: string; description?: React.ReactNode }[] = [
  { key: 'autoRenameBranches', label: 'Automatically rename new branches' },
  { key: 'renameSessionOnBranch', label: 'Rename session when branch is named' },
  { key: 'deleteBranchOnArchive', label: 'Delete branch on archive', description: <>Delete the local branch (and the worktree) when archiving a session. To delete the remote branch, <a className="underline" href="https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-the-automatic-deletion-of-branches" target="_blank" rel="noreferrer">configure it on GitHub</a>.</> },
  { key: 'archiveOnMerge', label: 'Archive on merge', description: 'Automatically archive a session after merging its PR in AgentDeck.' },
  { key: 'automerge', label: 'Automerge', description: 'Show an automerge button in the git panel when checks are pending. Requires automerge to be enabled in your GitHub repository settings. Automerge is not supported for stacked pull requests.' },
  { key: 'optionalChecksBlocking', label: 'Treat optional checks as blocking', description: 'Hide the merge button when any check has failed, including checks GitHub considers optional.' },
  { key: 'ghStack', label: 'Use GitHub stacked PRs', description: <>Instruct agents that they can use <code className={code}>gh stack</code> for PR stacking.</> },
]

/** Global Git settings: branch name prefix and the session/PR workflow toggles. */
export default function GitPage({ settings, save }: { settings: Settings; save: (p: Partial<Settings>) => void }): React.JSX.Element {
  const mode = settings.branchPrefixMode
  const [login, setLogin] = useState<string | null>(null)
  useEffect(() => { void window.api.gitIdentity().then((i) => setLogin(i.login), () => {}) }, [])
  const prefix = mode === 'none' ? '' : mode === 'github' ? (login ?? settings.branchPrefix) : settings.branchPrefix
  return (
    <div className="flex flex-col divide-y divide-border">
      <fieldset className="flex flex-col gap-3 py-4">
        <legend className="text-prose font-medium">Branch name prefix</legend>
        <p className="text-prose text-muted-foreground">Prefix for new session branch names, e.g. {prefix ? `${prefix}/1a2b3c4d` : '1a2b3c4d'}.</p>
        {([['github', login ? `GitHub username (${login})` : 'GitHub username'], ['custom', 'Custom'], ['none', 'None']] as const).map(([m, text]) => (
          <label key={m} className="flex items-center gap-2 text-prose">
            <input type="radio" name="branch-prefix" className="size-4 accent-[var(--ring)]" checked={mode === m} onChange={() => save({ branchPrefixMode: m })} />{text}
          </label>
        ))}
        {mode === 'custom' && (
          <Input
            key={settings.branchPrefix} className="w-56 font-mono" aria-label="Custom branch prefix" placeholder="e.g. rishabh" defaultValue={settings.branchPrefix}
            onBlur={(e) => { const v = e.target.value.trim(); if (VALID.test(v) && v !== settings.branchPrefix) save({ branchPrefix: v }) }}
          />
        )}
        {mode === 'github' && !login && <p className="text-small text-muted-foreground">No GitHub login found (run <code className={code}>gh auth login</code>); the custom prefix &quot;{settings.branchPrefix}&quot; is used.</p>}
      </fieldset>
      {FLAGS.map((f) => (
        <ToggleRow key={f.key} label={f.label} description={f.description} checked={settings[f.key]} onChange={(v) => save({ [f.key]: v })} />
      ))}
    </div>
  )
}
