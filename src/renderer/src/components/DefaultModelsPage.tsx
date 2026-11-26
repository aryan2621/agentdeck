import { useState } from 'react'
import { Check, GripVertical } from 'lucide-react'
import { LOADOUT_SLOTS, PROVIDERS, type LoadoutSlot, type Settings } from '../../../shared/types'
import type { ModelInfo } from '../../../shared/ipc'
import ProviderIcon from './ProviderIcon'
import { Badge } from './ui/badge'
import { Loading } from './ui/field'
import { cn } from '../lib/utils'

type Catalog = Partial<Record<string, { models: ModelInfo[] }>>
const same = (a: LoadoutSlot, b: LoadoutSlot): boolean => a.provider === b.provider && a.model === b.model

/** Loadout strip (slot 1 = default for new sessions) above one model column per provider. Click or drag a model to use it. */
export default function DefaultModelsPage({ settings, catalog, save }: { settings: Settings; catalog: Catalog; save: (p: Partial<Settings>) => void }): React.JSX.Element {
  const [drag, setDrag] = useState<string | null>(null)
  const label = (s: LoadoutSlot): string => catalog[s.provider]?.models.find((m) => m.id === s.model)?.label ?? s.model
  const slots: LoadoutSlot[] = settings.loadout.length ? settings.loadout : [{ provider: settings.defaultProvider, model: settings.defaultModels[settings.defaultProvider] ?? catalog[settings.defaultProvider]?.models[0]?.id ?? '' }].filter((s) => s.model)
  const commit = (next: LoadoutSlot[]): void => {
    if (!next.length) return // always keep a default
    save({ loadout: next, defaultProvider: next[0].provider, defaultModels: { [next[0].provider]: next[0].model } })
  }
  const toggle = (s: LoadoutSlot): void => {
    const at = slots.findIndex((x) => same(x, s))
    if (at >= 0) commit(slots.filter((_, i) => i !== at))
    else if (slots.length < LOADOUT_SLOTS) commit([...slots, s])
  }
  const place = (s: LoadoutSlot, to: number): void => {
    const rest = slots.filter((x) => !same(x, s))
    if (rest.length >= LOADOUT_SLOTS) rest.pop() // dropping a new model on a full strip replaces the last one
    rest.splice(Math.min(to, rest.length), 0, s)
    commit(rest)
  }
  const drop = (to: number): void => {
    if (!drag) return
    const [p, ...m] = drag.split(':')
    place({ provider: p as LoadoutSlot['provider'], model: m.join(':') }, to)
    setDrag(null)
  }
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <div><h2 className="text-prose font-medium">Loadout</h2><p className="text-prose text-muted-foreground">Choose which models you want to use. The first slot is the default for new sessions.</p></div>
        <ol className="grid grid-cols-5 divide-x divide-border rounded-md border border-border" aria-label="Loadout slots">
          {Array.from({ length: LOADOUT_SLOTS }, (_, i) => {
            const s = slots[i]
            return (
              <li key={i} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(i)} className="flex min-w-0 flex-col">
                {s ? (
                  <button type="button" draggable onDragStart={() => setDrag(`${s.provider}:${s.model}`)} onClick={() => place(s, 0)} aria-label={`${label(s)}${i === 0 ? ', default' : ', make default'}`} className="flex h-full flex-col gap-1 p-3 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
                    <span className="flex items-center justify-between text-small text-muted-foreground"><ProviderIcon id={s.provider} />{i === 0 && <Badge>Default</Badge>}</span>
                    <span className="truncate font-mono text-prose">{label(s)}</span>
                  </button>
                ) : (
                  <div className="flex h-full flex-col justify-between p-3 font-mono text-small text-faint"><span>{drag ? 'DROP MODEL HERE' : 'EMPTY'}</span><span className="self-end">{i + 1}</span></div>
                )}
              </li>
            )
          })}
        </ol>
      </section>
      <div className="grid divide-x divide-border rounded-md border border-border" style={{ gridTemplateColumns: `repeat(${PROVIDERS.length}, minmax(0, 1fr))` }}>
        {PROVIDERS.map((p) => {
          const models = catalog[p.id]?.models
          return (
            <div key={p.id} className="flex min-w-0 flex-col">
              <div className="flex border-b border-border bg-accent/40 px-3 py-2.5 text-muted-foreground"><ProviderIcon id={p.id} /></div>
              {!models ? <Loading>Loading models…</Loading> : models.length === 0 ? <p className="p-3 text-prose text-muted-foreground">No models found. Check the executable path under Agents.</p> : (
                <ul className="divide-y divide-border">
                  {models.map((m) => {
                    const s = { provider: p.id, model: m.id }
                    const on = slots.some((x) => same(x, s))
                    return (
                      <li key={m.id}>
                        <button type="button" draggable aria-pressed={on} onDragStart={() => setDrag(`${p.id}:${m.id}`)} onDragEnd={() => setDrag(null)} onClick={() => toggle(s)} className={cn('flex h-10 w-full items-center gap-2 px-3 text-left text-prose transition-colors duration-100 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring', drag === `${p.id}:${m.id}` && 'opacity-50')}>
                          <span className="truncate">{m.label}</span>
                          {on && <Check className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                          <GripVertical className="ml-auto size-3.5 shrink-0 text-faint" aria-hidden />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
