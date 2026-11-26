import { useState } from 'react'
import { actions } from '../store'
import { FolderOpen, FolderPlus, Globe } from 'lucide-react'
import { Wordmark } from './Logo'

const tile = 'flex h-32 min-w-0 flex-col justify-between rounded-lg border border-input/70 bg-panel p-4 text-left text-prose transition-colors duration-100 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring'

/** Home: add a project by opening, cloning or creating one. A dropped folder opens too. */
export default function Welcome(): React.JSX.Element {
  const [over, setOver] = useState(false)
  const tiles = [
    { icon: FolderOpen, label: 'Open project', run: () => void actions.addProject() },
    { icon: Globe, label: 'Open GitHub project', run: () => actions.openProjectDialog('clone') },
    { icon: FolderPlus, label: 'Quick start', run: () => actions.openProjectDialog('create') }
  ]
  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${over ? 'bg-accent' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) void actions.addProject(window.api.pathForFile(f)) }}
    >
      <div className="h-10 shrink-0 border-b border-border [-webkit-app-region:drag]" aria-hidden />
      <div className="mx-auto flex w-full max-w-[704px] flex-col gap-12 px-8 pt-[clamp(72px,18vh,200px)] pb-12">
        <Wordmark />
        <div className="grid grid-cols-3 gap-3">
          {tiles.map((t) => <button key={t.label} type="button" onClick={t.run} className={tile}><t.icon className="size-4 text-foreground" strokeWidth={1.5} aria-hidden />{t.label}</button>)}
        </div>
      </div>
    </div>
  )
}
