import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Plus, Search, Settings2 } from 'lucide-react'
import type { SessionInfo } from '../../../shared/ipc'
import { actions, useStore } from '../store'
import { cap, nextEffort } from '../lib/stats'
import { keysOf } from '../lib/shortcuts'
import { Button } from './ui/button'
import { Kbd } from './ui/kbd'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger } from './ui/menu'
import ProviderIcon from './ProviderIcon'
import { cn } from '../lib/utils'

/** Model chip and its popover: search, loadout models, effort, shortcuts. Changes apply from the next message. */
export default function ModelPopover({ session, locked }: { session: SessionInfo; locked: boolean }): React.JSX.Element {
  const { catalog, settings } = useStore()
  const [q, setQ] = useState('')
  const field = useRef<HTMLInputElement>(null)
  const models = catalog[session.provider]?.models ?? []
  const cur = models.find((m) => m.id === session.model)
  const efforts = cur?.efforts
  const set = (opts: { model?: string | null; effort?: string | null }): void => { window.api.configureSession(session.id, opts).then(actions.upsertSession, actions.fail) }
  useEffect(() => {
    const k = (e: KeyboardEvent): void => {
      if (locked || !efforts?.length || !e.metaKey || !e.shiftKey || e.code !== 'Slash') return
      e.preventDefault()
      set({ effort: nextEffort(efforts, session.effort) })
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })
  const fav = new Set(settings.loadout.filter((s) => s.provider === session.provider).map((s) => s.model))
  const needle = q.trim().toLowerCase()
  // Loadout models by default (all when none are set for this provider); a search covers every model.
  const rows = models.filter((m) => (needle ? m.label.toLowerCase().includes(needle) : !fav.size || fav.has(m.id)))
  const effortLabel = session.effort ? cap(session.effort) : ''
  const trigger = (
    <Button type="button" variant="ghost" aria-label="Model" disabled={locked} className="h-7 gap-1.5 px-2 text-small text-muted-foreground">
      <span className="text-foreground">{cur?.label ?? session.model ?? 'Default model'}</span>{effortLabel}<ChevronDown />
    </Button>
  )
  return (
    <Menu onOpenChange={(o) => { if (o) { setQ(''); setTimeout(() => field.current?.focus(), 50) } }}>
      <MenuTrigger asChild>{trigger}</MenuTrigger>
      <MenuContent align="start" side="top" className="w-80 p-0">
        <label className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-3.5 text-muted-foreground" />
          <input ref={field} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => !(['Escape', 'ArrowDown', 'ArrowUp'].includes(e.key)) && e.stopPropagation()} placeholder="Search models" aria-label="Search models" className="h-9 w-full bg-transparent text-body outline-none placeholder:text-muted-foreground" />
        </label>
        <div className="max-h-64 overflow-y-auto p-1">
          {rows.map((m) => (
            <MenuItem key={m.id} onSelect={() => set({ model: m.id })}>
              <ProviderIcon id={session.provider} />
              <span className="truncate text-foreground">{m.label}</span>
              {m.id === session.model && effortLabel && <span className="text-muted-foreground">{effortLabel}</span>}
              <Check className={cn('ml-auto', m.id !== session.model && 'invisible')} />
            </MenuItem>
          ))}
          {!rows.length && <p className="px-2.5 py-2 text-small text-muted-foreground">No models match.</p>}
          <MenuItem onSelect={() => actions.openSettings('Default models')}><Plus /><span className="text-muted-foreground">Add models</span></MenuItem>
        </div>
        {efforts && (
          <div className="border-t border-border p-1">
            <MenuSub>
              <MenuSubTrigger><span className="text-foreground">Effort</span><span className="ml-auto text-muted-foreground">{effortLabel || 'Default'}</span><ChevronRight /></MenuSubTrigger>
              <MenuSubContent>
                {efforts.map((e) => <MenuItem key={e} onSelect={() => set({ effort: e })}><Check className={cn(e !== session.effort && 'invisible')} />{cap(e)}</MenuItem>)}
              </MenuSubContent>
            </MenuSub>
            {/* Fast tier: neither the Claude SDK nor Codex adapter exposes one here, so no row. */}
          </div>
        )}
        <MenuSeparator />
        <div className="flex items-center justify-between px-1 pb-1 text-small text-muted-foreground">
          <MenuItem className="h-7" onSelect={() => actions.openSettings('Default models')}><Settings2 />Edit</MenuItem>
          {efforts && <span className="flex items-center gap-1.5 pr-2"><Kbd>{keysOf('cycleEffort')}</Kbd>Cycle effort</span>}
        </div>
      </MenuContent>
    </Menu>
  )
}
