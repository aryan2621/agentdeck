import { Switch } from './ui/checkbox'
import { SettingsRow, SettingsSection } from './ui/field'
import type { Settings } from '../../../shared/types'

const FLAGS: { key: 'bigTerminal' | 'menuBarTray' | 'autoMode'; label: string; description: string }[] = [
  { key: 'bigTerminal', label: 'Big terminal mode', description: 'Create big terminals in the center pane with ⌘⇧T' },
  { key: 'autoMode', label: 'Auto permission mode', description: 'Adds an Auto mode for Claude sessions where a classifier approves safe actions instead of asking.' },
  { key: 'menuBarTray', label: 'Menu bar', description: 'Show usage and recent sessions in the macOS menu bar.' },
]

/** Only flags backed by a real feature; each is read where the feature lives. */
export default function ExperimentalPage({ settings, save }: { settings: Settings; save: (p: Partial<Settings>) => void }): React.JSX.Element {
  return (
    <SettingsSection title="Early features" description="Off by default. They may change or be removed.">
      {FLAGS.map((f) => (
        <SettingsRow key={f.key} label={f.label} description={f.description}>
          <Switch aria-label={f.label} checked={settings[f.key]} onCheckedChange={(c) => save({ [f.key]: c === true })} />
        </SettingsRow>
      ))}
    </SettingsSection>
  )
}
