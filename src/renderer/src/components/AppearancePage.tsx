import { THEMES } from '../lib/themes'
import Markdown, { CODE_THEMES, CodeBlock } from './Markdown'
import { Input } from './ui/input'
import { MONO, terminalStack } from '../lib/fonts'
import { Switch } from './ui/checkbox'
import { SettingsRow } from './ui/field'
import { Select } from './ui/select'
import { cn } from '../lib/utils'
import type { Settings } from '../../../shared/types'

const MODE = [{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]
const ZOOM = [80, 90, 100, 110, 125, 150].map((n) => ({ value: String(n), label: `${n}%` }))
const ACCESSIBLE = [{ value: 'default', label: 'Default' }, { value: 'colorblind', label: 'Colour-blind safe' }]
const CODE = Object.keys(CODE_THEMES).map((id) => ({ value: id, label: id === 'default' ? 'Default' : id.replace(/(^|-)(\w)/g, (_, d, c: string) => (d ? ' ' : '') + c.toUpperCase()) }))
const SAMPLE = `// Fetch user data
async function getUser(id: number): Promise<User> {
  const response = await fetch(\`/api/users/\${id}\`);
  const data = await response.json();
  return { name: data.name, active: true };
}`

const MONO_OPTIONS = Object.entries(MONO).map(([value, f]) => ({ value, label: f.label }))
const MD_STYLES = [{ value: 'default', label: 'Default' }, { value: 'serif', label: 'Serif' }, { value: 'compact', label: 'Compact' }]
const MONO_SAMPLE = `// Preview
const greeting = 'Hello, World!';
function sum(a, b) { return a + b; }`
const MD_SAMPLE = '# Add New Button\n\nBelieve it or not, this plan will add a new button to the interface.'

/** Appearance settings: palette grid, then one row per display option. */
export default function AppearancePage({ settings, save }: { settings: Settings; save: (p: Partial<Settings>) => void }): React.JSX.Element {
  return (
    <div className="flex flex-col divide-y divide-border">
      <div className="flex flex-col gap-4 pb-6">
        <SettingsRow label="Theme" description="Light, dark, or follow macOS.">
          <Select label="Theme" className="w-40" value={settings.theme} onChange={(v) => save({ theme: v as Settings['theme'] })} options={MODE} />
        </SettingsRow>
        <div role="radiogroup" aria-label="Color theme" className="flex flex-wrap gap-3">
          {THEMES.map((t) => {
            const on = settings.colorTheme === t.id
            return (
              <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => save({ colorTheme: t.id })} className="group flex flex-col items-center gap-1.5 text-small text-muted-foreground aria-checked:text-foreground aria-checked:font-medium">
                <span
                  className={cn('flex h-14 w-24 flex-col justify-between rounded-lg border p-2 text-prose text-foreground', on ? 'border-2 border-ring' : 'border-border group-hover:border-input')}
                  style={{ background: `light-dark(${t.bg[0]}, ${t.bg[1]})`, color: 'light-dark(oklch(0.18 0 0), oklch(0.95 0 0))' }}
                >
                  <span className="flex items-start justify-between leading-none"><span>Aa</span><span className="h-3.5 w-2 rounded-sm" style={{ background: `light-dark(${t.accent[0]}, ${t.accent[1]})` }} /></span>
                  <span className="flex gap-0.5" aria-hidden><i className="size-2 rounded-full bg-current" /><i className="size-2 rounded-full" style={{ background: `light-dark(${t.accent[0]}, ${t.accent[1]})` }} /></span>
                </span>
                {t.label}
              </button>
            )
          })}
        </div>
      </div>
      <SettingsRow label="Thanksgiving theme" description="Warm autumn accent over any palette."><Switch aria-label="Thanksgiving theme" checked={settings.seasonal} onCheckedChange={(v) => save({ seasonal: v === true })} /></SettingsRow>
      <SettingsRow label="Low-contrast dark mode"><Switch aria-label="Low-contrast dark mode" checked={settings.lowContrast} onCheckedChange={(v) => save({ lowContrast: v === true })} /></SettingsRow>
      <SettingsRow label="App zoom" description="Scales the whole app."><Select label="App zoom" className="w-32" value={String(settings.zoom)} onChange={(v) => save({ zoom: Number(v) })} options={ZOOM} /></SettingsRow>
      <SettingsRow label="Show sidebar diffs" description="Added and removed line counts on each session."><Switch aria-label="Show sidebar diffs" checked={settings.sidebarDiffs} onCheckedChange={(v) => save({ sidebarDiffs: v === true })} /></SettingsRow>
      <SettingsRow label="Accessible colors" description="Theme optimized for color vision differences."><Select label="Accessible colors" className="w-44" value={settings.accessibleColors} onChange={(v) => save({ accessibleColors: v as Settings['accessibleColors'] })} options={ACCESSIBLE} /></SettingsRow>
      <div className="flex flex-col gap-3 py-4">
        <SettingsRow label="Code theme" description="Syntax highlighting colors for code blocks and editors."><Select label="Code theme" className="w-44" value={settings.codeTheme} onChange={(v) => save({ codeTheme: v })} options={CODE} /></SettingsRow>
        <CodeBlock code={SAMPLE} lang="ts" />
      </div>
      <div className="flex flex-col gap-3 py-4">
        <SettingsRow label="Mono font" description="Font used for code and diffs."><Select label="Mono font" className="w-44" value={settings.monoFont} onChange={(v) => save({ monoFont: v })} options={MONO_OPTIONS} /></SettingsRow>
        <CodeBlock code={MONO_SAMPLE} lang="ts" />
      </div>
      <SettingsRow label="Code ligatures" description="Use font ligatures in file editors and diffs."><Switch aria-label="Code ligatures" checked={settings.codeLigatures} onCheckedChange={(v) => save({ codeLigatures: v === true })} /></SettingsRow>
      <div className="flex flex-col gap-3 py-4">
        <SettingsRow label="Markdown style" description="Rendering style for markdown files."><Select label="Markdown style" className="w-44" value={settings.markdownStyle} onChange={(v) => save({ markdownStyle: v as Settings['markdownStyle'] })} options={MD_STYLES} /></SettingsRow>
        <div className="rounded-md border border-border bg-panel p-4"><Markdown text={MD_SAMPLE} /></div>
      </div>
      <div className="flex flex-col gap-3 py-4">
        <label className="flex flex-col gap-1">
          <span className="text-prose font-medium">Terminal font</span>
          <Input
            key={settings.terminalFont} defaultValue={settings.terminalFont} placeholder="Leave empty for default" aria-describedby="terminal-font-hint"
            onBlur={(e) => { const v = e.target.value.trim(); if (v !== settings.terminalFont && /^[\w .-]{0,60}$/.test(v)) save({ terminalFont: v }) }}
          />
          <span id="terminal-font-hint" className="text-small text-muted-foreground">Enter font name exactly as installed, e.g. Arial, Papyrus, FiraCode Nerd Font</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-prose font-medium">Terminal font size<span className="tnum font-normal text-muted-foreground">{settings.terminalFontSize}px</span></span>
          <input type="range" min={8} max={24} step={1} value={settings.terminalFontSize} onChange={(e) => save({ terminalFontSize: Number(e.target.value) })} className="w-full accent-[var(--ring)] focus-visible:outline-2 focus-visible:outline-ring" />
        </label>
        <pre aria-label="Terminal preview" className="overflow-x-auto rounded-md bg-panel p-3 text-foreground" style={{ fontFamily: terminalStack(settings), fontSize: settings.terminalFontSize }}>
          <span className="text-ok">~/project main ±3 ?2</span>{'\n'}<span className="text-ok">❯</span> npm test <span className="text-ok">✓</span>{'\n'}<span className="text-ok">╰─▶ All tests passed!</span>
        </pre>
      </div>
    </div>
  )
}
