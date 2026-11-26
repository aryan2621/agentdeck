import { useEffect, useMemo, useState } from 'react'
import { Check, ExternalLink, ChevronRight, File, Folder, FolderOpen, GitPullRequest, Loader2, RefreshCw, Search, X } from 'lucide-react'
import { actions, useStore } from '../../state/store'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Empty, Loading } from '../../components/ui/field'
import { cn } from '../../lib/utils'

type Pr = Awaited<ReturnType<typeof window.api.prStatus>>

interface TreeNode { name: string; path: string; children: TreeNode[] }
function fileTree(files: string[]): TreeNode[] {
  const root: TreeNode[] = []
  for (const path of files) {
    let level = root
    const parts = path.split('/')
    parts.forEach((name, i) => {
      let node = level.find((n) => n.name === name)
      if (!node) { node = { name, path: parts.slice(0, i + 1).join('/'), children: [] }; level.push(node) }
      level = node.children
    })
  }
  const sort = (nodes: TreeNode[]): TreeNode[] => nodes.sort((a, b) => Number(!!b.children.length) - Number(!!a.children.length) || a.name.localeCompare(b.name)).map((n) => ({ ...n, children: sort(n.children) }))
  return sort(root)
}

/** Folder hierarchy over the existing file list; files retain their external-editor action. */
export function AllFiles({ sessionId, status }: { sessionId: string; status?: string }): React.JSX.Element {
  const [files, setFiles] = useState<string[] | null>(null)
  const [q, setQ] = useState('')
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [filtering, setFiltering] = useState(false)
  const refresh = (): void => { void window.api.listFiles(sessionId).then(setFiles, actions.fail) }
  useEffect(() => { let alive = true; void window.api.listFiles(sessionId).then((f) => alive && setFiles(f), actions.fail); return () => { alive = false } }, [sessionId, status])
  const tree = useMemo(() => fileTree((files ?? []).filter((f) => f.toLowerCase().includes(q.toLowerCase()))), [files, q])
  const toggle = (path: string): void => setExpandedPaths((old) => { const next = new Set(old); if (next.has(path)) next.delete(path); else next.add(path); return next })
  const nodes = (list: TreeNode[], depth = 0): React.ReactNode => list.map((n) => {
    const folder = !!n.children.length
    const expanded = !!q || expandedPaths.has(n.path)
    return <li key={n.path}>
      <button type="button" title={folder ? n.path : `Open ${n.path} in default app`} aria-expanded={folder ? expanded : undefined} onClick={() => folder ? toggle(n.path) : void window.api.openFile(sessionId, n.path).catch(actions.fail)} className="flex h-7 w-full items-center gap-2 rounded-md pr-2 text-left font-mono text-small hover:bg-accent" style={{ paddingLeft: 8 + depth * 14 }}>
        {folder ? <ChevronRight className={cn('size-3 shrink-0 text-faint', expanded && 'rotate-90')} /> : <span className="w-3 shrink-0" />}
        {folder ? (expanded ? <FolderOpen className="size-3.5 shrink-0 text-faint" /> : <Folder className="size-3.5 shrink-0 text-faint" />) : <File className="size-3.5 shrink-0 text-faint" />}
        <span className="truncate">{n.name}</span>
      </button>
      {folder && expanded && <ul>{nodes(n.children, depth + 1)}</ul>}
    </li>
  })
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="flex h-9 shrink-0 items-center gap-1 px-3">
      <span className="min-w-0 flex-1 truncate text-small text-muted-foreground">Files</span>
      <Button variant="ghost" size="icon" className="size-6" aria-label="Filter files" onClick={() => setFiltering(!filtering)}><Search /></Button>
      <Button variant="ghost" size="icon" className="size-6" aria-label="Refresh files" onClick={refresh}><RefreshCw /></Button>
    </div>
    {(filtering || q) && <div className="px-3 pb-2"><Input autoFocus aria-label="File search" placeholder="Filter files" value={q} onChange={(e) => setQ(e.target.value)} /></div>}
    <div className="min-h-0 flex-1 overflow-auto px-2 pb-3">
      {!files && <Loading>Loading files…</Loading>}
      {files && !tree.length && <p className="px-2 py-3 text-small text-muted-foreground">{q ? 'No matching files.' : 'No files yet.'}</p>}
      <ul aria-label="Project files">{nodes(tree)}</ul>
    </div>
  </div>
}

/** Files the agent left in the worktree's `.context` folder. */
export function Artifacts({ sessionId, status }: { sessionId: string; status: string }): React.JSX.Element {
  const [files, setFiles] = useState<string[] | null>(null)
  useEffect(() => { let alive = true; void window.api.listArtifacts(sessionId).then((f) => alive && setFiles(f), actions.fail); return () => { alive = false } }, [sessionId, status])
  if (!files) return <Loading>Loading artifacts…</Loading>
  if (!files.length) return <div className="m-3 flex flex-1 rounded-md border border-dashed border-border"><Empty icon={File}>No artifacts yet. Files in the .context folder show up here.</Empty></div>
  return <ul aria-label="Artifacts" className="min-h-0 flex-1 overflow-auto px-2 py-2">{files.map((f) => <li key={f}>
    <button type="button" title={`Open ${f} in default app`} onClick={() => void window.api.openFile(sessionId, `.context/${f}`).catch(actions.fail)} className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-left font-mono text-small hover:bg-accent"><File className="size-3.5 shrink-0 text-faint" /><span className="truncate">{f}</span></button>
  </li>)}</ul>
}

const ICON = { pass: <Check className="size-3.5 text-ok" aria-label="Passed" />, fail: <X className="size-3.5 text-destructive" aria-label="Failed" />, pending: <Loader2 className="size-3.5 animate-spin text-faint" aria-label="Pending" /> }

/** The branch's pull request and its CI checks. */
export function Checks({ sessionId, status }: { sessionId: string; status: string }): React.JSX.Element {
  const [pr, setPr] = useState<Pr | undefined>()
  const { automerge, optionalChecksBlocking } = useStore().settings
  const load = (): void => void window.api.prStatus(sessionId).then(setPr)
  useEffect(load, [sessionId, status]) // eslint-disable-line react-hooks/exhaustive-deps
  const merge = (auto: boolean): void => void window.api.mergePr(sessionId, auto).then((m) => { actions.ok(m || (auto ? 'Automerge enabled' : 'Merged')); load() }, actions.fail)
  if (pr === undefined) return <Loading>Loading checks…</Loading>
  if (!pr) return <div className="m-3 flex flex-1 rounded-lg border border-dashed border-border"><Empty icon={GitPullRequest}>No pull request yet. Commit, push and open one from Changes.</Empty></div>
  const open = pr.state === 'OPEN' && !pr.conflicts
  const failed = pr.checks.some((c) => c.state === 'fail')
  const canMerge = open && !(optionalChecksBlocking && failed) // gh can't tell optional checks apart, so this is all-or-nothing
  const canAutomerge = automerge && open && !failed && pr.checks.some((c) => c.state === 'pending')
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-small font-medium">#{pr.number}</span><span className="text-small text-muted-foreground">{pr.state.toLowerCase()}</span>
        <span className="ml-auto flex gap-1">
          {canMerge && <Button size="sm" variant="outline" onClick={() => merge(false)}>Merge</Button>}
          {canAutomerge && <Button size="sm" variant="outline" onClick={() => merge(true)}>Automerge</Button>}
          <Button size="sm" variant="ghost" onClick={() => window.open(pr.url)}>View PR<ExternalLink /></Button>
        </span>
      </div>
      {pr.checks.length === 0 && <p className="px-3 py-3 text-small text-muted-foreground">No checks reported.</p>}
      {pr.checks.map((c) => <div key={c.name} className={cn('flex items-center gap-2 border-b border-border px-3 py-2 text-small')}>{ICON[c.state]}<span className="min-w-0 flex-1 truncate">{c.name}</span></div>)}
    </div>
  )
}
