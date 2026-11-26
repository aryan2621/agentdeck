import { useEffect, useState } from 'react'
import { File, FolderOpen } from 'lucide-react'
import { actions, useStore } from '../store'
import { Button } from './ui/button'
import { Empty, Loading } from './ui/field'

interface Item { sessionId: string; title: string; file: string }

/** Settings > Artifacts: `.context` files from every session, newest sessions first. */
export default function ArtifactsPage(): React.JSX.Element {
  const { sessions } = useStore()
  const [items, setItems] = useState<Item[] | null>(null)
  const list = Object.values(sessions).flat().sort((a, b) => b.createdAt - a.createdAt)
  const key = list.map((s) => s.id + s.status).join()
  useEffect(() => {
    let alive = true
    void Promise.all(list.map(async (s) => (await window.api.listArtifacts(s.id).catch(() => [])).map((file) => ({ sessionId: s.id, title: s.title, file }))))
      .then((r) => alive && setItems(r.flat()))
    return () => { alive = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!items) return <Loading>Loading artifacts…</Loading>
  if (!items.length) return <div className="flex h-40 rounded-md border border-dashed border-border"><Empty icon={File}>No artifacts yet. Files an agent saves in a session's .context folder are listed here.</Empty></div>
  return (
    <ul aria-label="Artifacts" className="flex flex-col divide-y divide-border">
      {items.map((i) => (
        <li key={i.sessionId + i.file} className="flex h-9 items-center gap-2 text-small">
          <File className="size-3.5 shrink-0 text-faint" aria-hidden />
          <button type="button" title="Open in default app" onClick={() => void window.api.openFile(i.sessionId, `.context/${i.file}`).catch(actions.fail)} className="min-w-0 flex-1 truncate text-left font-mono hover:underline">{i.file}</button>
          <span className="max-w-48 shrink-0 truncate text-faint">{i.title}</span>
          <Button variant="outline" aria-label={`Reveal ${i.file} in Finder`} title="Reveal in Finder" onClick={() => void window.api.openFile(i.sessionId, `.context/${i.file}`, true).catch(actions.fail)}><FolderOpen className="size-4" strokeWidth={1.5} aria-hidden /></Button>
        </li>
      ))}
    </ul>
  )
}
