import { useEffect, useState } from 'react'
import { Folder } from 'lucide-react'
import { Button } from './ui/button'
import { SettingsRow, SettingsSection } from './ui/field'
import { Input } from './ui/input'
import type { Settings } from '../../../shared/types'

/** Advanced: where session worktrees live. Existing worktrees keep their own paths. */
export default function AdvancedPage({ settings, save }: { settings: Settings; save: (p: Partial<Settings>) => void }): React.JSX.Element {
  const [shown, setShown] = useState('')
  useEffect(() => { void window.api.getWorktreesRoot().then(setShown) }, [settings.worktreesDir])
  const browse = async (): Promise<void> => { const p = await window.api.pickDirectory(); if (p) save({ worktreesDir: p }) }
  return (
    <SettingsSection title="Workspaces" description="Each new session gets its own git worktree under this folder.">
      <SettingsRow stacked label="Workspaces root directory" description="Where AgentDeck creates a worktree for each new session. Sessions that already exist stay where they are.">
        <Input key={settings.worktreesDir} className="flex-1 font-mono" aria-label="Workspaces root directory" defaultValue={settings.worktreesDir} placeholder={shown}
          onBlur={(e) => { const v = e.target.value.trim(); if (v !== settings.worktreesDir && (v === '' || v.startsWith('/'))) save({ worktreesDir: v }) }} />
        <Button variant="outline" onClick={() => void browse()}><Folder className="size-4" strokeWidth={1.5} aria-hidden />Browse</Button>
        {settings.worktreesDir && <Button variant="outline" onClick={() => save({ worktreesDir: '' })}>Reset</Button>}
      </SettingsRow>
    </SettingsSection>
  )
}
