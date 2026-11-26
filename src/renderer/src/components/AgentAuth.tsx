import { useEffect, useState } from 'react'
import { Check, ChevronDown, KeyRound, RefreshCw, TerminalSquare } from 'lucide-react'
import { actions } from '../store'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Switch } from './ui/checkbox'
import { SettingsRow } from './ui/field'
import { Menu, MenuContent, MenuItem, MenuTrigger } from './ui/menu'
import { cn } from '../lib/utils'
import type { ProviderId, Settings } from '../../../shared/types'

const KEY: Partial<Record<ProviderId, { name: string; url: string }>> = {
  claude: { name: 'Anthropic', url: 'https://console.anthropic.com/settings/keys' },
  codex: { name: 'OpenAI', url: 'https://platform.openai.com/api-keys' }
}
const tile = 'relative flex h-24 flex-col items-center justify-center gap-2 rounded-md border text-prose transition-colors'

/** CLI vs API key tiles for a provider. Choosing the CLI tile removes the saved key, so exactly one method is in use. */
export function AgentAuth({ agent, cliFound }: { agent: ProviderId; cliFound?: boolean }): React.JSX.Element {
  const k = KEY[agent]
  const [has, setHas] = useState<boolean | null>(null)
  const [picked, setPicked] = useState(false)
  const [value, setValue] = useState('')
  const refresh = (): void => { void window.api.apiKeyStatus(agent).then((h) => { setHas(h); setPicked(h) }, () => setHas(false)) }
  useEffect(() => { setValue(''); if (k) refresh(); else { setHas(false); setPicked(false) } }, [agent]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (key: string): Promise<void> => window.api.setApiKey(agent, key).then(refresh, actions.fail)
  const useKey = picked
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-prose font-medium">Authentication</h2>
      <div role="radiogroup" aria-label="Authentication method" className="grid grid-cols-2 gap-3">
        <button type="button" role="radio" aria-checked={!useKey} onClick={() => { setPicked(false); if (has) void set('') }} className={cn(tile, !useKey ? 'border-input bg-panel' : 'border-border text-muted-foreground hover:bg-accent')}>
          <TerminalSquare className="size-5 text-muted-foreground" strokeWidth={1.5} aria-hidden />CLI
          {!useKey && cliFound && <Check className="absolute top-3 right-3 size-4 text-muted-foreground" aria-label="Selected" />}
        </button>
        <button type="button" role="radio" aria-checked={useKey} disabled={!k} onClick={() => setPicked(true)} className={cn(tile, 'disabled:opacity-50', useKey ? 'border-input bg-panel' : 'border-border text-muted-foreground hover:bg-accent')}>
          <KeyRound className="size-5 text-muted-foreground" strokeWidth={1.5} aria-hidden />API key
          {useKey && <Check className="absolute top-3 right-3 size-4 text-muted-foreground" aria-label="Selected" />}
        </button>
      </div>
      {useKey && k && (
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (value.trim()) void set(value).then(() => setValue('')) }}>
          <div className="flex items-center justify-between text-prose">
            <span className="flex items-center gap-2"><span aria-hidden className={cn('size-2 rounded-full', has ? 'bg-ok' : 'bg-destructive')} />{has ? `${k.name} API key saved` : `No ${k.name} API key configured`}</span>
            <Button type="button" variant="ghost" onClick={refresh}><RefreshCw />Refresh</Button>
          </div>
          <div className="flex gap-2">
            <Input type="password" autoComplete="off" spellCheck={false} aria-label={`${k.name} API key`} placeholder={has ? 'Replace saved key' : `${k.name} API key`} className="flex-1" value={value} onChange={(e) => setValue(e.target.value)} />
            <Button variant="default" disabled={!value.trim()}>Save</Button>
          </div>
          <a href={k.url} target="_blank" rel="noreferrer" className="w-fit text-prose text-muted-foreground underline">Get key ↗</a>
        </form>
      )}
    </section>
  )
}

/** Claude Code only: Chrome toggle and the ~/.claude/settings.json row. */
export function ClaudeExtras({ settings, save }: { settings: Settings; save: (p: Partial<Settings>) => void }): React.JSX.Element {
  const open = (reveal: boolean): void => void window.api.openClaudeSettings(reveal).catch(actions.fail)
  return (
    <div className="flex flex-col divide-y divide-border">
      <SettingsRow label="Use Claude Code with Chrome" description={<>Allow Claude Code to control your Chrome browser. To use this feature, first install the <a className="text-foreground underline" href="https://claude.ai/chrome" target="_blank" rel="noreferrer">Claude Code Chrome extension</a>. View <a className="text-foreground underline" href="https://code.claude.com/docs/en/chrome" target="_blank" rel="noreferrer">the docs</a> to learn more.</>}>
        <Switch aria-label="Use Claude Code with Chrome" checked={settings.claudeChrome} onCheckedChange={(c) => save({ claudeChrome: c === true })} />
      </SettingsRow>
      <div className="flex items-center justify-between rounded-md border border-border px-4 py-4">
        <div><div className="text-prose font-medium">Claude settings</div><div className="font-mono text-small text-muted-foreground">~/.claude/settings.json</div></div>
        <div className="flex">
          <Button variant="outline" className="rounded-r-none border-r-0" onClick={() => open(false)}>Open in</Button>
          <Menu>
            <MenuTrigger asChild><Button variant="outline" size="icon" aria-label="More ways to open" className="h-8 rounded-l-none"><ChevronDown /></Button></MenuTrigger>
            <MenuContent><MenuItem onSelect={() => open(false)}>Default app</MenuItem><MenuItem onSelect={() => open(true)}>Reveal in Finder</MenuItem></MenuContent>
          </Menu>
        </div>
      </div>
    </div>
  )
}
