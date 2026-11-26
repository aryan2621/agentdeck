import { useState } from 'react'
import { SettingsRow, SettingsSection } from '../../components/ui/field'
import { Textarea } from '../../components/ui/input'
import type { Settings } from '../../../../shared/types'

/** Environment (global, or one repository when `projectId` is set): KEY=value lines for agents, terminals and setup scripts. Repository values win. */
export default function EnvironmentPage({ settings, save, projectId }: { settings: Settings; save: (p: Partial<Settings>) => void; projectId?: string }): React.JSX.Element {
  const saved = projectId ? settings.repoEnv[projectId] ?? '' : settings.env
  const [text, setText] = useState(saved)
  const commit = (): void => { if (text !== saved) save(projectId ? { repoEnv: { [projectId]: text } } : { env: text }) }
  return (
    <SettingsSection title={projectId ? 'Repository variables' : 'Global variables'} description={projectId ? "Override the global values for this repository only." : "Apply to every repository unless it sets its own value."}>
      <SettingsRow stacked label="Environment variables"
        description={`One KEY=value per line. Passed to the terminal and setup scripts${projectId ? '' : ', and to agents'}. Agents already running keep their old values. Stored unencrypted in AgentDeck settings.`}>
        <Textarea rows={8} aria-label="Environment variables" className="font-mono" spellCheck={false} placeholder={'API_URL=http://localhost:3000'} value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} />
      </SettingsRow>
    </SettingsSection>
  )
}
