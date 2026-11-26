import { SettingsSection, ToggleRow } from '../../components/ui/field'
import type { Settings } from '../../../../shared/types'

const FLAGS: { key: 'bigTerminal' | 'menuBarTray' | 'autoMode'; label: string; description: string }[] = [
  { key: 'autoMode', label: 'Auto permission mode', description: 'Adds an Auto mode for Claude sessions where a classifier approves safe actions instead of asking.' },
  { key: 'bigTerminal', label: 'Big terminal mode', description: 'Create big terminals in the center pane with ⌘⇧T' },
  { key: 'menuBarTray', label: 'Menu bar', description: 'Show usage and recent sessions in the macOS menu bar.' },
]

/** Only flags backed by a real feature; each is read where the feature lives. */
export default function ExperimentalPage({ settings, save }: { settings: Settings; save: (p: Partial<Settings>) => void }): React.JSX.Element {
  return (
    <SettingsSection description="Experimental features that are under development. Expect breaking changes.">
      {FLAGS.map((f) => (
        <ToggleRow key={f.key} label={f.label} description={f.description} checked={settings[f.key]} onChange={(v) => save({ [f.key]: v })} />
      ))}
    </SettingsSection>
  )
}
