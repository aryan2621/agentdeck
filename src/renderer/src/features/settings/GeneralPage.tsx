import { useEffect, useState } from 'react'
import { Plus, Volume2 } from 'lucide-react'
import { MODES, MODE_LABEL } from '../../lib/modes'
import { Button } from '../../components/ui/button'
import { Switch } from '../../components/ui/checkbox'
import { SettingsRow, SettingsSection, ToggleRow } from '../../components/ui/field'
import { Select } from '../../components/ui/select'
import { actions } from '../../state/store'
import type { NotifyKind, PermissionMode, Settings } from '../../../../shared/types'

const NOTIFY: { kind: NotifyKind; label: string }[] = [
  { kind: 'done', label: 'A session finishes' },
  { kind: 'needs-you', label: 'A session needs your approval' },
  { kind: 'error', label: 'A session fails' },
]
// macOS ships these in /System/Library/Sounds; the split mirrors Conductor's Classic / Novelty groups.
const CLASSIC = ['Glass', 'Ping', 'Tink', 'Hero', 'Submarine', 'Pop']
const NOVELTY = ['Bottle', 'Frog', 'Blow', 'Funk', 'Morse', 'Purr', 'Basso', 'Sosumi']
const base = (p: string): string => p.split('/').pop()?.replace(/\.[^.]+$/, '') ?? p

/** Settings > General: row order and wording follow Conductor. */
export default function GeneralPage({ settings, save }: { settings: Settings; save: (p: Partial<Settings>) => void }): React.JSX.Element {
  const [disk, setDisk] = useState<boolean | null>(null)
  const [custom, setCustom] = useState<string[]>([])
  useEffect(() => { void window.api.listSounds().then(setCustom, () => {}) }, [settings.completionSound])
  useEffect(() => {
    const check = (): void => { void window.api.fullDiskAccess().then(setDisk, () => setDisk(null)) }
    check()
    window.addEventListener('focus', check) // the user comes back from System Settings
    return () => window.removeEventListener('focus', check)
  }, [])
  const toggle = (key: keyof Settings, label: string, description?: string): React.JSX.Element => (
    <ToggleRow label={label} description={description} checked={settings[key] as boolean} onChange={(v) => save({ [key]: v })} />
  )
  const sounds = [
    { value: '', label: 'None' },
    ...CLASSIC.map((s) => ({ value: s, label: s, group: 'Classic' })),
    ...NOVELTY.map((s) => ({ value: s, label: s, group: 'Novelty' })),
    ...custom.map((p) => ({ value: p, label: base(p), group: 'Added' })),
  ]
  const addSound = (): void => { window.api.addSound().then((p) => { if (p) { save({ completionSound: p }); void window.api.playSound(p) } }, actions.fail) }
  return (
    <>
      <div className="flex flex-col divide-y divide-border">
        <SettingsRow label="Send messages with" description={<>Choose which key combination sends messages.<span className="mt-1 block text-small">Use ⇧↵ for new lines</span></>}>
          <Select label="Send messages with" className="w-40" value={settings.sendKey} onChange={(v) => save({ sendKey: v as Settings['sendKey'] })} options={[{ value: 'enter', label: 'Enter' }, { value: 'cmd-enter', label: '⌘Enter' }]} />
        </SettingsRow>
        <SettingsRow label="Follow-up behavior" description={<>Queue messages to send after the agent finishes, or steer the agent mid-turn.{settings.sendKey === 'enter' && <span className="mt-1 block text-small">Use ⌘↵ to {settings.followUp === 'steer' ? 'queue' : 'steer'}</span>}</>}>
          <Select label="Follow-up behavior" className="w-40" value={settings.followUp} onChange={(v) => save({ followUp: v as Settings['followUp'] })} options={[{ value: 'steer', label: 'Steer' }, { value: 'queue', label: 'Queue' }]} />
        </SettingsRow>
        {toggle('notifyAgents', 'Agent notifications', 'Get notified when an agent finishes working.')}
        <SettingsRow label="Completion sound" description="Choose what plays when AI finishes working in a chat.">
          <Select label="Completion sound" className="w-40" value={settings.completionSound} onChange={(v) => save({ completionSound: v })} options={sounds} />
          <Button variant="outline" onClick={() => void window.api.playSound()}><Volume2 aria-hidden />Test</Button>
          <Button variant="outline" onClick={addSound}><Plus aria-hidden />Add sound...</Button>
        </SettingsRow>
        <SettingsRow label="Full disk access permissions" description="To let agents work without repeated folder permission prompts.">
          <span className="text-prose text-muted-foreground" role="status">{disk === null ? 'Unknown' : disk ? 'Granted' : 'Not granted'}</span>
          <Button variant="outline" onClick={() => void window.api.openDiskAccessSettings()}>Open System Settings</Button>
        </SettingsRow>
        {toggle('arrangeManually', 'Arrange workspaces manually')}
        {toggle('autoConvertLongText', 'Auto-convert long text', 'Convert pasted text over 5000 characters into text attachments')}
        {toggle('stripAbsolutelyRight', "I'm not absolutely right, thank you very much", 'Strip "You\'re absolutely right!" from AI messages')}
        {toggle('caffeinate', 'Caffeinate while agents are running', 'Prevent your Mac from sleeping while an agent is actively working. Shuts off below 10% battery.')}
        {toggle('restartOnUpdate', 'Restart automatically on update', 'Install a downloaded update and restart without asking.')}
      </div>
      <SettingsSection title="Notify me when" description="Applies while Agent notifications is on.">
        {NOTIFY.map((n) => (
          <SettingsRow key={n.kind} label={n.label}>
            <Switch aria-label={n.label} disabled={!settings.notifyAgents} checked={settings.notify[n.kind]} onCheckedChange={(c) => save({ notify: { ...settings.notify, [n.kind]: c === true } })} />
          </SettingsRow>
        ))}
      </SettingsSection>
      <SettingsSection title="Sessions">
        <SettingsRow label="Permission mode" description="What new sessions may do without asking.">
          <Select label="Default permission mode" className="w-48" value={settings.defaultMode} onChange={(v) => save({ defaultMode: v as PermissionMode })} options={MODES.filter((m) => m !== 'auto' || settings.autoMode).map((m) => ({ value: m, label: MODE_LABEL[m] }))} />
        </SettingsRow>
        <SettingsRow label="Parallel sessions" description="Most sessions that can run a turn at once.">
          <Select label="Parallel sessions" className="w-48" value={String(settings.maxParallel)} onChange={(v) => save({ maxParallel: Number(v) })} options={[0, 1, 2, 3, 4, 6, 8].map((n) => ({ value: String(n), label: n ? String(n) : 'Unlimited' }))} />
        </SettingsRow>
      </SettingsSection>
    </>
  )
}
