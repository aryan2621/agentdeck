import { useState } from 'react'
import type { ProjectInfo } from '../../../shared/ipc'
import { actions, useStore } from '../store'
import { Button } from './ui/button'
import { Field } from './ui/field'
import { Input } from './ui/input'
import { DialogShell, DialogTitle, DialogDescription } from './ui/dialog'

/** Create a session from an existing branch or a pull request number instead of the repo's base branch. */
export default function CreateFromDialog({ project, onClose }: { project: ProjectInfo | null; onClose: () => void }): React.JSX.Element {
  const { settings } = useStore()
  const [ref, setRef] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async (): Promise<void> => {
    if (!project || !ref.trim()) return
    setBusy(true)
    try {
      const s = await window.api.createSession({ projectId: project.id, provider: settings.defaultProvider, model: settings.defaultModels[settings.defaultProvider] || undefined, permissionMode: settings.defaultMode, useWorktree: true, baseRef: ref.trim() })
      actions.upsertSession(s); actions.select(s.id); setRef(''); onClose()
    } catch (e) { actions.fail(e) }
    setBusy(false)
  }
  return (
    <DialogShell open={!!project} onOpenChange={(o) => !o && !busy && onClose()} className="top-1/3 left-1/2 flex w-[min(26rem,90vw)] -translate-x-1/2 flex-col gap-3 p-6">
      <DialogTitle className="text-title">Create from…</DialogTitle>
      <DialogDescription className="text-body text-muted-foreground">Start a session in {project?.name} from an existing branch or pull request.</DialogDescription>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void go() }}>
        <Field label="Branch name or PR number"><Input autoFocus value={ref} onChange={(e) => setRef(e.target.value)} placeholder="main, origin/feature, or 123" /></Field>
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="default" disabled={busy || !ref.trim()} aria-busy={busy}>{busy ? 'Creating…' : 'Create session'}</Button>
        </div>
      </form>
    </DialogShell>
  )
}
