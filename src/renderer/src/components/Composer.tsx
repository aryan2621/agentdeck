import { useEffect, useRef, useState } from 'react'
import type { ImageAttachment, PermissionMode } from '../../../shared/types'
import { ArrowUp, FileText, ListPlus, Paperclip, Square, TerminalSquare, X } from 'lucide-react'
import { actions, useStore } from '../store'
import { Button } from './ui/button'
import { Textarea } from './ui/input'
import Mentions from './Mentions'
import RewindDialog from './RewindDialog'
import { Tip } from './ui/tooltip'
import { Select } from './ui/select'
import { MODE_LABEL } from '../lib/modes'
import { cn } from '../lib/utils'
import type { ModelInfo, SessionInfo } from '../../../shared/ipc'

const MENTION = /(^|\s)@(\S*)$/
const COMMANDS = [
  { cmd: '/stop', hint: 'Interrupt the running turn' },
  { cmd: '/clear-queue', hint: 'Drop all queued messages' },
  { cmd: '/rewind', hint: 'Restore files to before the last prompt' },
  { cmd: '/steer ', hint: 'Send a message into the running turn' }
]
const MAX_IMAGE = 5 * 1024 * 1024

const readImage = (f: File): Promise<ImageAttachment> =>
  new Promise((resolve, reject) => {
    if (f.size > MAX_IMAGE) return reject(new Error(`${f.name || 'Image'} is over 5 MB`))
    const r = new FileReader()
    r.onload = () => resolve({ mimeType: f.type, data: String(r.result).split(',')[1] })
    r.onerror = () => reject(r.error)
    r.readAsDataURL(f)
  })

/** Model and mode of this session; changes apply from the next message. */
function Chips({ session, locked }: { session: SessionInfo; locked: boolean }): React.JSX.Element {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [modes, setModes] = useState<PermissionMode[]>([session.permissionMode])
  useEffect(() => {
    window.api.listModels(session.provider).then(setModels, () => {})
    window.api.providerModes(session.provider).then(setModes, () => {})
  }, [session.provider])
  const set = (opts: { model?: string | null; permissionMode?: PermissionMode }): void => { window.api.configureSession(session.id, opts).then(actions.upsertSession, actions.fail) }
  const model = session.model ?? ''
  const modelOpts = [{ value: '', label: 'Provider default' }, ...models.map((m) => ({ value: m.id, label: m.label }))]
  if (model && !models.some((m) => m.id === model)) modelOpts.push({ value: model, label: model })
  const chip = 'h-6 rounded-md px-2 text-small'
  const wrap = (el: React.JSX.Element): React.JSX.Element => locked ? <Tip label="Stop the turn to change"><span tabIndex={0}>{el}</span></Tip> : el
  return (
    <div className="flex items-center gap-1.5">
      {wrap(<Select label="Model" className={chip} disabled={locked} value={model} onChange={(v) => set({ model: v || null })} options={modelOpts} />)}
      {wrap(<Select label="Permission mode" className={cn(chip, session.permissionMode === 'full-access' && 'border-destructive/50 text-destructive')} disabled={locked} value={session.permissionMode} onChange={(v) => set({ permissionMode: v as PermissionMode })} options={modes.map((m) => ({ value: m, label: MODE_LABEL[m] ?? m }))} />)}
    </div>
  )
}

export default function Composer({ session, usage }: { session: SessionInfo; usage?: string }): React.JSX.Element {
  const { id: sessionId, title, status } = session
  const [text, setText] = useState('')
  const { queues } = useStore()
  const queue = queues[sessionId] ?? []
  const setQueue = (q: string[]): void => actions.setQueue(sessionId, q)
  const [files, setFiles] = useState<string[] | null>(null)
  const [images, setImages] = useState<ImageAttachment[]>([])
  const [sel, setSel] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const [drag, setDrag] = useState(false)
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
    if (t.startsWith('/steer ')) return post(t.slice(7)) // sent into the running turn (Claude, Codex)
    if (busy) setQueue([...queue, t])
    else post(t)
  }

  const m = MENTION.exec(text)
  useEffect(() => {
    if (m && files === null) window.api.listFiles(sessionId).then(setFiles, actions.fail)
  }, [!!m]) // eslint-disable-line react-hooks/exhaustive-deps
  const matches = m && files ? files.filter((f) => f.toLowerCase().includes(m[2].toLowerCase())).slice(0, 8) : []
  const sl = /^\/\S*$/.test(text) ? COMMANDS.filter((c) => c.cmd.startsWith(text)) : []
  const opts = dismissed ? [] : sl.length ? sl.map((c) => ({ key: c.cmd, label: c.cmd, hint: c.hint, value: c.cmd })) : matches.map((f) => ({ key: f, label: f, hint: '', value: f }))
  const pick = (i: number): void => {
    const o = opts[i]
    if (!o) return
    setText(sl.length ? o.value : text.replace(MENTION, `$1@${o.value} `))
    setSel(0)
  }
  useEffect(() => { setSel(0); setDismissed(false) }, [text])

  return (
    <div className="flex flex-col gap-2 px-6 pt-2 pb-4 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[800px]">
      {status === 'needs-you' && (
        <p className="rounded-md border border-warn/50 bg-overlay px-3 py-1.5 text-small text-muted-foreground" role="status">Waiting for your approval above. Messages you send now are queued.</p>
      )}
      {queue.length > 0 && (
        <div className="flex flex-col gap-0.5 text-small text-muted-foreground">
          <span className="flex items-center gap-1.5"><ListPlus className="size-3.5" />{queue.length} queued · sends after this turn</span>
          {queue.map((q, i) => (
            <div key={i} className="flex items-center gap-2 pl-5">
              <span className="min-w-0 flex-1 truncate text-foreground" title={q}>{q}</span>
              <Tip label="Remove from queue"><Button variant="ghost" size="icon" className="size-6" aria-label={`Remove queued: ${q.slice(0, 40)}`} onClick={() => setQueue(queue.filter((_, j) => j !== i))}><X /></Button></Tip>
            </div>
          ))}
        </div>
      )}
      {opts.length > 0 && (
        <ul role="listbox" aria-label={sl.length ? 'Commands' : 'Files'} className="max-h-56 overflow-auto rounded-lg border border-border bg-overlay p-1 shadow-overlay">
          {opts.map((o, i) => {
            const slash = o.label.lastIndexOf('/'), dir = sl.length ? '' : o.label.slice(0, slash + 1)
            return (
              <li key={o.key} role="option" aria-selected={i === sel} onMouseDown={(e) => { e.preventDefault(); pick(i) }} onMouseEnter={() => setSel(i)}
                className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-small ${i === sel ? 'bg-accent' : ''}`}>
                {sl.length ? <TerminalSquare className="size-3.5 shrink-0 text-muted-foreground" /> : <FileText className="size-3.5 shrink-0 text-muted-foreground" />}
                <span className="min-w-0 truncate font-mono"><span className="text-faint">{dir}</span>{o.label.slice(dir.length)}</span>
                {o.hint && <span className="ml-auto shrink-0 text-meta text-muted-foreground">{o.hint}</span>}
              </li>
            )
          })}
        </ul>
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
        className={`flex min-h-12 items-end gap-2 rounded-lg border bg-overlay p-1.5 transition-colors focus-within:border-ring has-[textarea:not(:placeholder-shown)]:rounded-xl ${drag ? 'border-dashed border-ring' : 'border-input'}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); attach(e.dataTransfer.files) }}
      >
        <input ref={picker} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) attach(e.target.files); e.target.value = '' }} />
        <Tip label="Attach image"><Button variant="outline" size="icon" className="rounded-full" aria-label="Attach image" onClick={() => picker.current?.click()}><Paperclip /></Button></Tip>
        <label className="min-w-0 flex-1 self-center">
          <span className="sr-only">Message</span>
          <div className="grid">
          <div aria-hidden className="pointer-events-none max-h-48 overflow-hidden px-1 py-1 text-body break-words whitespace-pre-wrap text-transparent [grid-area:1/1]"><Mentions text={text} className="rounded-sm bg-link/20 text-transparent" />{'\n'}</div>
          <Textarea
            className="[grid-area:1/1] max-h-48 w-full border-0 bg-transparent px-1 py-1 focus-visible:ring-0 [field-sizing:content]"
            rows={1}
            placeholder={`Message ${title}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); attach(e.clipboardData.files) } }}
            role="combobox" aria-expanded={opts.length > 0} 
            onKeyDown={(e) => {
              if (opts.length) {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setSel((sel + (e.key === 'ArrowDown' ? 1 : opts.length - 1)) % opts.length); return }
                if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey && !e.nativeEvent.isComposing && !(sl.length && opts[sel]?.value === text)) { e.preventDefault(); pick(sel); return }
                if (e.key === 'Escape') { e.preventDefault(); setDismissed(true); return }
              }
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() }
              // A picked @file is one unit: Backspace right after it removes the whole mention.
              const el = e.currentTarget, at = el.selectionStart
              if (e.key === 'Backspace' && at === el.selectionEnd) {
                const hit = /(^|\s)@\S+ ?$/.exec(text.slice(0, at))
                if (hit) {
                  e.preventDefault()
                  const start = at - hit[0].length + hit[1].length
                  setText(text.slice(0, start) + text.slice(at))
                  requestAnimationFrame(() => el.setSelectionRange(start, start))
                }
              }
            }}
          />
          </div>
        </label>
        <div className="flex items-center gap-1">
          {working && <Tip label="Stop"><Button variant="destructive" size="icon" aria-label="Stop" onClick={() => window.api.interrupt(sessionId).catch(actions.fail)}><Square /></Button></Tip>}
          <Tip label={busy && !images.length ? 'Queue (↵)' : 'Send (↵)'}>
            <Button variant="default" size="icon" aria-label={busy && !images.length ? 'Queue' : 'Send'} onClick={send} disabled={!text.trim() && !images.length}>{busy && !images.length ? <ListPlus /> : <ArrowUp />}</Button>
          </Tip>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Chips session={session} locked={busy} />
        {usage && <p className="truncate font-mono text-meta text-faint">{usage}</p>}
      </div>
      <RewindDialog sessionId={sessionId} checkpoint={rewind} onClose={() => setRewind(null)} />
    </div>
  )
}
