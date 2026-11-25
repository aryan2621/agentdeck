import { useEffect, useRef, useState } from 'react'
import type { ImageAttachment, SessionStatus } from '../../../shared/types'
import { ArrowUp, ImagePlus, ListPlus, Paperclip, Square, X } from 'lucide-react'
import { actions, useStore } from '../store'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Textarea } from './ui/input'
import { ConfirmDialog } from './ui/dialog'
import { Tip } from './ui/tooltip'

const MENTION = /(^|\s)@(\S*)$/
const MAX_IMAGE = 5 * 1024 * 1024

const readImage = (f: File): Promise<ImageAttachment> =>
  new Promise((resolve, reject) => {
    if (f.size > MAX_IMAGE) return reject(new Error(`${f.name || 'Image'} is over 5 MB`))
    const r = new FileReader()
    r.onload = () => resolve({ mimeType: f.type, data: String(r.result).split(',')[1] })
    r.onerror = () => reject(r.error)
    r.readAsDataURL(f)
  })

export default function Composer({ sessionId, status }: { sessionId: string; status: SessionStatus }): React.JSX.Element {
  const [text, setText] = useState('')
  const { queues } = useStore()
  const queue = queues[sessionId] ?? []
  const setQueue = (q: string[]): void => actions.setQueue(sessionId, q)
  const [files, setFiles] = useState<string[] | null>(null)
  const [images, setImages] = useState<ImageAttachment[]>([])
  const [rewind, setRewind] = useState<{ id: string; label: string } | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const busy = status === 'working' || status === 'needs-you'
  const working = status === 'working'

  const post = (t: string, imgs?: ImageAttachment[]): void => { window.api.sendMessage(sessionId, t, imgs).catch(actions.fail) }
  const attach = (list: FileList | File[]): void => {
    const imgs = [...list].filter((f) => f.type.startsWith('image/'))
    Promise.all(imgs.map(readImage)).then((r) => setImages((cur) => [...cur, ...r]), actions.fail)
  }

  const slash = (t: string): boolean => {
    if (t === '/stop') window.api.interrupt(sessionId).catch(actions.fail)
    else if (t === '/clear-queue') setQueue([])
    else if (t === '/rewind') {
      // Latest checkpoint = files as they were before the last prompt.
      window.api.listCheckpoints(sessionId).then((cks) => {
        const ck = cks.filter((c) => c.label !== 'Before rewind').at(-1)
        if (!ck) throw new Error('No checkpoint to rewind to')
        setRewind(ck)
      }).catch(actions.fail)
    } else return false
    return true
  }

  const send = (): void => {
    const t = text.trim()
    if (!t && !images.length) return
    setText('')
    if (images.length) { post(t, images); setImages([]); return } // images go out now; they are not queued
    if (slash(t)) return
    if (t.startsWith('/steer ')) return post(t.slice(7)) // sent into the running turn (Claude, Codex); ACP agents may reject it
    if (busy) setQueue([...queue, t])
    else post(t)
  }

  const m = MENTION.exec(text)
  useEffect(() => {
    if (m && files === null) window.api.listFiles(sessionId).then(setFiles, actions.fail)
  }, [!!m]) // eslint-disable-line react-hooks/exhaustive-deps
  const matches = m && files ? files.filter((f) => f.toLowerCase().includes(m[2].toLowerCase())).slice(0, 8) : []

  return (
    <div className="flex flex-col gap-2 border-t border-border bg-panel p-3">
      {queue.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <ListPlus className="size-3.5" />Queued
          {queue.map((q, i) => (
            <Tip key={i} label="Remove from queue">
              <button onClick={() => setQueue(queue.filter((_, j) => j !== i))}><Badge className="hover:bg-accent">{q.slice(0, 40)}<X className="size-3" /></Badge></button>
            </Tip>
          ))}
        </div>
      )}
      {matches.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Paperclip className="size-3.5" />
          {matches.map((f) => (
            <button key={f} onClick={() => setText(text.replace(MENTION, `$1${f} `))}><Badge tone="primary" className="font-mono hover:bg-primary/20">{f}</Badge></button>
          ))}
        </div>
      )}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((im, i) => (
            <div key={i} className="relative">
              <img src={`data:${im.mimeType};base64,${im.data}`} alt="Attachment preview" className="size-14 rounded border border-border object-cover" />
              <Tip label="Remove image"><Button variant="secondary" size="icon" className="absolute -top-1.5 -right-1.5 size-5 rounded-full" aria-label="Remove image" onClick={() => setImages(images.filter((_, j) => j !== i))}><X className="size-3" /></Button></Tip>
            </div>
          ))}
        </div>
      )}
      <div
        className="flex flex-col gap-1 rounded-md border border-input bg-background p-2 focus-within:border-primary"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); attach(e.dataTransfer.files) }}
      >
        <input ref={picker} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) attach(e.target.files); e.target.value = '' }} />
        <label className="min-w-0">
          <span className="sr-only">Message</span>
          <Textarea
            className="max-h-48 w-full border-0 bg-transparent px-1 focus-visible:ring-0 [field-sizing:content]"
            rows={1}
            placeholder="Message the agent. / for commands, @ for files"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); attach(e.clipboardData.files) } }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() }
            }}
          />
        </label>
        <div className="flex items-center gap-1">
          <Tip label="Attach image"><Button variant="ghost" size="icon" aria-label="Attach image" onClick={() => picker.current?.click()}><ImagePlus /></Button></Tip>
          <span className="flex-1" />
          {working && <Tip label="Stop"><Button variant="destructive" size="icon" aria-label="Stop" onClick={() => window.api.interrupt(sessionId).catch(actions.fail)}><Square /></Button></Tip>}
          <Tip label={busy && !images.length ? 'Queue (Enter)' : 'Send (Enter)'}>
            <Button variant="default" size="icon" aria-label={busy && !images.length ? 'Queue' : 'Send'} onClick={send} disabled={!text.trim() && !images.length}>{busy && !images.length ? <ListPlus /> : <ArrowUp />}</Button>
          </Tip>
        </div>
      </div>
      <ConfirmDialog
        open={!!rewind}
        onOpenChange={(o) => !o && setRewind(null)}
        title="Rewind files?"
        description={`Restore files to before "${rewind?.label}". Chat history is not changed.`}
        confirmLabel="Rewind"
        onConfirm={() => rewind && window.api.rewindSession(sessionId, rewind.id).catch(actions.fail)}
      />
    </div>
  )
}
