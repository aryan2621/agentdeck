import { useEffect, useRef, useState } from 'react'
import { usePaneActive } from '../../lib/pane'
import type { ImageAttachment, PermissionMode } from '../../../../shared/types'
import { ArrowUp, FileText, LayoutGrid, ListPlus, Paperclip, Square, TerminalSquare, X } from 'lucide-react'
import { actions, useStore } from '../../state/store'
import { Button } from '../../components/ui/button'
import { Textarea } from '../../components/ui/input'
import Mentions from './Mentions'
import ModelPopover from './ModelPopover'
import StatsStrip from '../../components/StatsStrip'
import RewindDialog from './RewindDialog'
import { Select } from '../../components/ui/select'
import { MODE_LABEL } from '../../lib/modes'
import { cn } from '../../lib/utils'
import type { SessionInfo } from '../../../../shared/ipc'

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
  const c = useStore().catalog[session.provider]
  const modes = c?.modes.length ? c.modes : [session.permissionMode]
  const set = (opts: { permissionMode?: PermissionMode }): void => { window.api.configureSession(session.id, opts).then(actions.upsertSession, actions.fail) }
  const chip = 'h-7 rounded-md border-transparent bg-transparent px-2 text-small text-muted-foreground'
  const wrap = (el: React.JSX.Element): React.JSX.Element => locked ? <span tabIndex={0}>{el}</span> : el
  return (
    <div className="flex items-center gap-1.5">
      <ModelPopover session={session} locked={locked} />
      {wrap(<Select label="Permission mode" className={cn(chip, session.permissionMode === 'full-access' && 'border-destructive/50 text-destructive')} disabled={locked} value={session.permissionMode} onChange={(v) => set({ permissionMode: v as PermissionMode })} options={modes.map((m) => ({ value: m, label: MODE_LABEL[m] ?? m }))} />)}
    </div>
  )
}

export default function Composer({ session, usage, placeholder }: { session: SessionInfo; usage?: string; placeholder?: string }): React.JSX.Element {
  const { id: sessionId, title, status } = session
  const [text, setRawText] = useState('')
  const { queues, settings, statsOpen } = useStore()
  const [pasted, setPasted] = useState<string[]>([]) // long pastes held as attachments (Settings > Auto-convert long text)
  const queue = queues[sessionId] ?? []
  const setQueue = (q: string[]): void => actions.setQueue(sessionId, q)
  const [files, setFiles] = useState<string[] | null>(null)
  const [images, setImages] = useState<ImageAttachment[]>([])
  const [sel, setSel] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const setText = (value: string): void => { setRawText(value); setSel(0); setDismissed(false) }
  const [drag, setDrag] = useState(false)
  const [rewind, setRewind] = useState<{ id: string; label: string } | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const active = usePaneActive()
  useEffect(() => {
    const k = (e: KeyboardEvent): void => { if (active.current && e.metaKey && !e.shiftKey && !e.altKey && e.key === 'l') { e.preventDefault(); field.current?.focus() } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  const [focused, setFocused] = useState(false)
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

  const send = (alt = false): void => {
    const t = [text.trim(), ...pasted.map((p) => '```\n' + p + '\n```')].filter(Boolean).join('\n\n')
    if (!t && !images.length) return
    setText('')
    setPasted([])
    if (images.length) { post(t, images); setImages([]); return } // images go out now; they are not queued
    if (slash(t)) return
    if (t.startsWith('/steer ')) return post(t.slice(7)) // sent into the running turn (Claude, Codex)
    // Steer = send into the running turn; ⌘↵ flips the Follow-up setting. Never steer while an approval is pending.
    if (working && (settings.followUp === 'steer') !== alt) post(t)
    else if (busy) setQueue([...queue, t])
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

  return (
    <div className="flex flex-col gap-2 px-8 pt-2 pb-4 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[800px]">
      {statsOpen && <StatsStrip session={session} />}
      {status === 'needs-you' && (
        <p className="flex items-center gap-2 px-1 text-small text-muted-foreground" role="status"><span className="size-1.5 shrink-0 rounded-full bg-warn" />Waiting for your approval above. New messages are queued.</p>
      )}
      {queue.length > 0 && (
        <div className="flex flex-col gap-0.5 text-small text-muted-foreground">
          <span className="flex items-center gap-1.5"><ListPlus className="size-3.5" />{queue.length} queued · sends after this turn</span>
          {queue.map((q, i) => (
            <div key={i} className="flex items-center gap-2 pl-5">
              <span className="min-w-0 flex-1 truncate text-foreground" title={q}>{q}</span>
              <Button variant="ghost" size="icon" className="size-7" aria-label={`Remove queued: ${q.slice(0, 40)}`} onClick={() => setQueue(queue.filter((_, j) => j !== i))}><X /></Button>
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
                className={`flex items-center gap-2 rounded-md px-2 py-1 text-small ${i === sel ? 'bg-accent' : ''}`}>
                {sl.length ? <TerminalSquare className="size-3.5 shrink-0 text-muted-foreground" /> : <FileText className="size-3.5 shrink-0 text-muted-foreground" />}
                <span className="min-w-0 truncate font-mono"><span className="text-faint">{dir}</span>{o.label.slice(dir.length)}</span>
                {o.hint && <span className="ml-auto shrink-0 text-meta text-muted-foreground">{o.hint}</span>}
              </li>
            )
          })}
        </ul>
      )}
      {pasted.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Pasted text">
          {pasted.map((t, i) => (
            <li key={i} className="flex h-7 items-center gap-1 rounded-md border border-border bg-panel pl-2 text-small text-muted-foreground">
              Pasted text · {t.length.toLocaleString()} chars
              <Button variant="ghost" size="icon" className="size-6" aria-label="Remove pasted text" onClick={() => setPasted(pasted.filter((_, j) => j !== i))}><X /></Button>
            </li>
          ))}
        </ul>
      )}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((im, i) => (
            <div key={i} className="relative">
              <img src={`data:${im.mimeType};base64,${im.data}`} alt="Attachment preview" className="size-14 rounded border border-border object-cover" />
              <Button variant="secondary" size="icon" className="absolute -top-1.5 -right-1.5 size-5 rounded-full" aria-label="Remove image" onClick={() => setImages(images.filter((_, j) => j !== i))}><X className="size-3" /></Button>
            </div>
          ))}
        </div>
      )}
      <div
        className={`group/c flex flex-col gap-1 rounded-lg border bg-panel p-2 transition-colors focus-within:border-ring ${drag ? 'border-dashed border-ring' : 'border-border'}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); attach(e.dataTransfer.files) }}
      >
        <input ref={picker} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) attach(e.target.files); e.target.value = '' }} />
        <div className="flex items-end gap-2">
        <Button variant="ghost" size="icon" aria-label="Attach image" onClick={() => picker.current?.click()}><Paperclip /></Button>
        <label className="min-w-0 flex-1 self-center">
          <span className="sr-only">Message</span>
          <div className="grid">
          <div aria-hidden className="pointer-events-none max-h-48 overflow-hidden px-1 py-1 text-body break-words whitespace-pre-wrap text-transparent [grid-area:1/1]"><Mentions text={text} className="rounded-sm bg-link/20 text-transparent" />{'\n'}</div>
          <Textarea
            ref={field}
            className="[grid-area:1/1] max-h-48 w-full border-0 bg-transparent px-1 py-1 focus-visible:ring-0 [field-sizing:content]"
            rows={4}
            placeholder={placeholder ?? `Message ${title}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            onPaste={(e) => {
              const long = e.clipboardData.getData('text')
              if (e.clipboardData.files.length) { e.preventDefault(); attach(e.clipboardData.files) }
              else if (settings.autoConvertLongText && long.length > 5000) { e.preventDefault(); setPasted((p) => [...p, long]) }
            }}
            role="combobox" aria-expanded={opts.length > 0} 
            onKeyDown={(e) => {
              if (opts.length) {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setSel((sel + (e.key === 'ArrowDown' ? 1 : opts.length - 1)) % opts.length); return }
                if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey && !e.nativeEvent.isComposing && !(sl.length && opts[sel]?.value === text)) { e.preventDefault(); pick(sel); return }
                if (e.key === 'Escape') { e.preventDefault(); setDismissed(true); return }
              }
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && (settings.sendKey === 'enter' || e.metaKey)) { e.preventDefault(); send(settings.sendKey === 'enter' && e.metaKey) }
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
        </div>
        {/* Collapsed to one line until focused, typed in, or a turn is running. */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Chips session={session} locked={busy} />
        <div className="flex items-center gap-1">
          {!focused && !text && !busy && <p className="text-meta text-faint">⌘L to focus</p>}
          {usage && <p className="truncate font-mono text-meta text-faint">{usage}</p>}
          <Button variant="ghost" size="icon" aria-label="Session stats" aria-pressed={statsOpen} onClick={actions.toggleStats}><LayoutGrid /></Button>
          {working && <Button variant="destructive" size="icon" aria-label="Stop" onClick={() => window.api.interrupt(sessionId).catch(actions.fail)}><Square /></Button>}
            <Button variant="default" size="icon" aria-label={busy && !images.length ? 'Queue' : 'Send'} onClick={() => send()} disabled={!text.trim() && !images.length && !pasted.length}>{busy && !images.length ? <ListPlus /> : <ArrowUp />}</Button>
        </div>
        </div>
      </div>
      <RewindDialog sessionId={sessionId} checkpoint={rewind} onClose={() => setRewind(null)} />
    </div>
  )
}
