import { useEffect, useState } from 'react'
import { actions } from '../../state/store'
import { ConfirmDialog } from '../../components/ui/dialog'

const SHOWN = 8

/** Confirm a file rewind and list the files it would change. Shared by the header menu and /rewind. */
export default function RewindDialog({ sessionId, checkpoint, onClose }: { sessionId: string; checkpoint: { id: string; label: string } | null; onClose: () => void }): React.JSX.Element {
  const [files, setFiles] = useState<string[] | null>(null)
  useEffect(() => {
    setFiles(null)
    if (checkpoint) window.api.rewindPreview(sessionId, checkpoint.id).then(setFiles, () => setFiles([]))
  }, [sessionId, checkpoint])
  return (
    <ConfirmDialog
      open={!!checkpoint} onOpenChange={(o) => !o && onClose()} destructive confirmLabel="Restore files"
      title="Rewind files?" description={`Restore files to before "${checkpoint?.label.slice(0, 80) ?? ''}". Chat history and agent memory are not changed.`}
      onConfirm={() => checkpoint && window.api.rewindSession(sessionId, checkpoint.id).catch(actions.fail)}
    >
      <div className="text-small text-muted-foreground">
        {files === null ? 'Checking files…' : files.length === 0 ? 'No files would change.' : (
          <>
            <p>{files.length} {files.length === 1 ? 'file' : 'files'} will change:</p>
            <ul className="mt-1 font-mono">
              {files.slice(0, SHOWN).map((f) => <li key={f} className="truncate">{f}</li>)}
              {files.length > SHOWN && <li>and {files.length - SHOWN} more</li>}
            </ul>
          </>
        )}
      </div>
    </ConfirmDialog>
  )
}
