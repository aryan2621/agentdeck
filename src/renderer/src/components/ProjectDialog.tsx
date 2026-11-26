import { useEffect, useState } from 'react'
import { Check, Circle, Loader2 } from 'lucide-react'
import { DialogShell, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Field } from './ui/field'
import { Input } from './ui/input'
import { Select } from './ui/select'
import { actions, useStore } from '../store'

const PARENT = 'projectParent'
const STEPS = [['folder', 'Create folder'], ['git', 'Initialize Git'], ['github', 'Create private GitHub repo'], ['add', 'Add project'], ['workspace', 'Create workspace']] as const

/** Live checklist for createProject; main reports each step as it starts. */
function Progress({ name, github, workspace }: { name: string; github: boolean; workspace: boolean }): React.JSX.Element {
  const [step, setStep] = useState('folder')
  useEffect(() => window.api.onProjectProgress(setStep), [])
  const steps = STEPS.filter(([id]) => github || id !== 'github')
  const at = steps.findIndex(([id]) => id === (workspace ? 'workspace' : step)) // main reports up to 'add'; the first session is made here
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <DialogTitle className="text-[20px] leading-7 font-medium">Creating {name}</DialogTitle>
      <ul className="flex flex-col gap-2 text-body">
        {steps.map(([id, label], i) => (
          <li key={id} className={`flex items-center gap-3 ${i > at ? 'text-muted-foreground' : ''}`}>
            {i < at ? <Check className="size-4" aria-hidden /> : i === at ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Circle className="size-4" aria-hidden />}
            {label}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Second confirm before publishing: pick the owner, edit the repo name, see live whether it is free. */
function GithubConfirm({ open, defaultName, path, onCancel, onConfirm }: { open: boolean; defaultName: string; path: string; onCancel: () => void; onConfirm: (slug: string) => void }): React.JSX.Element {
  const [owners, setOwners] = useState<string[]>([])
  const [owner, setOwner] = useState('')
  const [name, setName] = useState(defaultName)
  const [free, setFree] = useState<boolean | null>(null)
  useEffect(() => { if (open) { setName(defaultName); void window.api.githubOwners().then((o) => { setOwners(o); setOwner(o[0] ?? '') }, actions.fail) } }, [open, defaultName])
  const slug = owner && name.trim() ? `${owner}/${name.trim()}` : ''
  useEffect(() => {
    if (!open || !slug) return
    setFree(null)
    const t = setTimeout(() => void window.api.githubRepoAvailable(slug).then(setFree, () => setFree(false)), 300)
    return () => clearTimeout(t)
  }, [open, slug])
  return (
    <DialogShell open={open} onOpenChange={(o) => !o && onCancel()} className="top-1/3 left-1/2 flex w-[min(26rem,90vw)] -translate-x-1/2 flex-col gap-3 p-6">
      <DialogTitle className="text-title">Create a private GitHub repo?</DialogTitle>
      <DialogDescription className="text-body text-muted-foreground">AgentDeck will create {path}, run git init, create a private GitHub repo, and push the first commit.</DialogDescription>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (free && slug) onConfirm(slug) }}>
        <Field label="Owner"><Select label="Owner" className="w-full" value={owner} onChange={setOwner} options={owners.map((o) => ({ value: o, label: o }))} /></Field>
        <Field label="Repository name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <p role="status" className="text-small text-muted-foreground">{slug ? <>Will create <code className="font-mono">{slug}</code>. {free === null ? 'Checking name…' : free ? 'Repository name is available.' : 'Repository name is not available.'}</> : 'Loading owners…'}</p>
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" variant="default" disabled={!free || !slug}>Create project</Button>
        </div>
      </form>
    </DialogShell>
  )
}

/** Quick start (make a folder + repo) and Open GitHub project (clone); one form, two modes. */
export default function ProjectDialog(): React.JSX.Element {
  const mode = useStore().projectDialog
  const [text, setText] = useState('')
  const [parent, setParent] = useState(() => localStorage.getItem(PARENT) ?? '')
  const [github, setGithub] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [workspace, setWorkspace] = useState(false)
  const create = mode === 'create'
  const browse = async (): Promise<void> => { const p = await window.api.pickDirectory(); if (p) setParent(p) }
  const go = async (slug?: string): Promise<void> => {
    setConfirming(false)
    setBusy(true)
    localStorage.setItem(PARENT, parent)
    const ok = await actions.makeProject(create ? window.api.createProject(text, parent, github ? 'private' : undefined, slug) : window.api.cloneProject(text, parent), create ? () => setWorkspace(true) : undefined)
    setBusy(false); setWorkspace(false)
    if (ok) setText('')
  }
  return (
    <DialogShell open={!!mode} onOpenChange={(o) => !o && !busy && actions.closeProjectDialog()} className="top-1/2 left-1/2 w-[min(33rem,90vw)] -translate-x-1/2 -translate-y-1/2 p-6">
      {busy && create ? <Progress name={text.trim()} github={github} workspace={workspace} /> : <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); if (!text.trim() || !parent) return; if (create && github) setConfirming(true); else void go() }}>
        <DialogTitle className="text-[20px] leading-7 font-medium">{create ? 'Create project' : 'Open GitHub project'}</DialogTitle>
        <DialogDescription className="text-body text-muted-foreground">{create ? 'Create a local folder, private GitHub repo, and first workspace.' : 'Clone a repository with your logged-in GitHub account.'}</DialogDescription>
        <Field label={create ? 'Project name' : 'Repository'}>
          <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={create ? 'my-project' : 'owner/name or URL'} />
        </Field>
        <Field label="Parent folder">
          <div className="flex gap-2">
            <Input className="flex-1" value={parent} onChange={(e) => setParent(e.target.value)} placeholder="/Users/you/code" />
            <Button type="button" variant="outline" onClick={() => void browse()}>Browse</Button>
          </div>
        </Field>
        {create && <label className="flex items-center gap-2 text-body"><Checkbox checked={github} onCheckedChange={(c) => setGithub(c === true)} />Create a private GitHub repository</label>}
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={actions.closeProjectDialog}>Cancel</Button>
          <Button type="submit" variant="default" disabled={busy || !text.trim() || !parent} aria-busy={busy}>{busy ? (create ? 'Creating…' : 'Cloning…') : create ? 'Create' : 'Clone'}</Button>
        </div>
      </form>}
      {create && <GithubConfirm open={confirming} defaultName={text.trim()} path={`${parent}/${text.trim()}`} onCancel={() => setConfirming(false)} onConfirm={(slug) => void go(slug)} />}
    </DialogShell>
  )
}
