import { useState } from 'react'
import { DialogShell, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { Field } from './ui/field'
import { actions, useStore } from '../store'

const OPTIONS = [
  { id: 'private', label: 'Private GitHub repository', hint: 'Creates it on your logged-in GitHub account and pushes' },
  { id: 'public', label: 'Public GitHub repository', hint: 'Anyone can see it' },
  { id: 'local', label: 'Local only', hint: 'Just run git init and make the first commit' },
] as const

/** Shown when the picked folder is not a git repository: offer to initialise it instead of refusing. */
export default function InitRepoDialog(): React.JSX.Element {
  const path = useStore().initPath
  const [mode, setMode] = useState<(typeof OPTIONS)[number]['id']>('private')
  const [busy, setBusy] = useState(false)
  const go = async (): Promise<void> => {
    setBusy(true)
    await actions.addProject(path!, mode)
    setBusy(false)
    actions.closeInit()
  }
  return (
    <DialogShell open={!!path} onOpenChange={(o) => !o && !busy && actions.closeInit()} className="top-1/3 left-1/2 flex w-[min(26rem,90vw)] -translate-x-1/2 flex-col gap-3 p-6">
      <DialogTitle className="text-title">{path?.split('/').pop()} is not a git repository</DialogTitle>
      <DialogDescription className="text-body text-muted-foreground">Sessions run in git worktrees, so this folder needs a repository first.</DialogDescription>
      <Field label="Set up">
        <div role="radiogroup" className="flex flex-col rounded-md border border-border">
          {OPTIONS.map((o) => (
            <button key={o.id} type="button" role="radio" aria-checked={mode === o.id} disabled={busy} onClick={() => setMode(o.id)}
              className="flex flex-col items-start gap-0.5 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-accent aria-checked:bg-muted">
              <span className="text-body font-medium">{o.label}</span>
              <span className="text-small text-muted-foreground">{o.hint}</span>
            </button>
          ))}
        </div>
      </Field>
      <div className="mt-1 flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={actions.closeInit}>Cancel</Button>
        <Button type="button" variant="default" disabled={busy} aria-busy={busy} onClick={() => void go()}>{busy ? 'Setting up…' : 'Initialise and add'}</Button>
      </div>
    </DialogShell>
  )
}
