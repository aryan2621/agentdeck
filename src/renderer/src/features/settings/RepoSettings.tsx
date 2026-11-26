import { useEffect, useState } from 'react'
import { Info, Plus, Trash2, X } from 'lucide-react'
import type { ProjectInfo } from '../../../../shared/ipc'
import { actions, useStore } from '../../state/store'
import { Disclosure } from '../../components/ui/collapsible'
import { Button } from '../../components/ui/button'
import { Field, Loading, SettingsRow, SettingsSection, ToggleRow } from '../../components/ui/field'
import { Input, Textarea } from '../../components/ui/input'
import RunTab from '../session/RunTab'
import { Select } from '../../components/ui/select'
import { ConfirmDialog } from '../../components/ui/dialog'
import { DEFAULT_REPO_ACTIONS, DEFAULT_REPO_PREFS, INSTRUCTION_KEYS, type RepoActions as RepoActionsPrefs, type Preview, type RepoPrefs, type Settings } from '../../../../shared/types'

type SaveFn = (p: Partial<Settings>) => void
const useRepoPrefs = (project: ProjectInfo, settings: Settings, save: SaveFn): [RepoPrefs, (patch: Partial<RepoPrefs>) => void] => {
  const cur = { ...DEFAULT_REPO_PREFS, ...settings.repoPrefs[project.id] }
  return [cur, (patch) => save({ repoPrefs: { ...settings.repoPrefs, [project.id]: { ...cur, ...patch } } })]
}

/** Files copied into each new worktree. Shared by General and Scripts; both write the same agentdeck.json `copy`. */
function CopyFiles({ projectId }: { projectId: string }): React.JSX.Element {
  const [copy, setCopy] = useState<string | null>(null)
  useEffect(() => { window.api.getProjectConfig(projectId).then((c) => setCopy((c.copy ?? []).join('\n')), actions.fail) }, [projectId])
  if (copy === null) return <Loading />
  // Re-read before writing so Scripts and General never clobber each other's fields.
  const commit = (): void => { void window.api.getProjectConfig(projectId).then((c) => window.api.setProjectConfig(projectId, { ...c, copy: copy.split('\n') })).then(() => actions.ok('Saved agentdeck.json'), actions.fail) }
  return (
    <SettingsRow stacked label="Files to copy" description="AgentDeck copies these paths (one per line, relative to the repo root) into each new workspace.">
      <Textarea rows={3} aria-label="Files to copy" className="font-mono" value={copy} onChange={(e) => setCopy(e.target.value)} onBlur={commit} placeholder={'.env\n.env.local'} />
    </SettingsRow>
  )
}

function PreviewList({ prefs, set }: { prefs: RepoPrefs; set: (p: Partial<RepoPrefs>) => void }): React.JSX.Element {
  const [rows, setRows] = useState<Preview[]>(prefs.previews)
  const persist = (next: Preview[]): void => set({ previews: next.filter((r) => r.name.trim() && /^https?:\/\//.test(r.url)) })
  const edit = (i: number, patch: Partial<Preview>): void => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const remove = (i: number): void => { const next = rows.filter((_, j) => j !== i); setRows(next); persist(next) }
  return (
    <SettingsRow stacked label="Preview URLs" description={<>Set the terminal panel's Open URLs. The first URL is the default; additional URLs appear in its menu. <code className="font-mono">$AGENTDECK_PORT</code> is the session's port.</>}>
      <div className="flex w-full flex-col gap-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input aria-label={`Preview ${i + 1} name`} className="w-36" placeholder="Name" value={r.name} onChange={(e) => edit(i, { name: e.target.value })} onBlur={() => persist(rows)} />
            <Input aria-label={`Preview ${i + 1} URL`} className="font-mono" placeholder="http://localhost:$AGENTDECK_PORT" value={r.url} onChange={(e) => edit(i, { url: e.target.value })} onBlur={() => persist(rows)} />
            <Button variant="ghost" size="icon" className="size-6 shrink-0" aria-label={`Remove preview ${r.name || i + 1}`} onClick={() => remove(i)}><X /></Button>
          </div>
        ))}
        <div><Button variant="outline" onClick={() => setRows([...rows, { name: '', url: '' }])}><Plus />Add preview URL</Button></div>
      </div>
    </SettingsRow>
  )
}

const Warn = ({ children }: { children: string }): React.JSX.Element => <span className="inline-flex items-center gap-1.5"><Info className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden />{children}</span>
/** A path with its last segment emphasised, like Conductor's repo page. */
const PathText = ({ path }: { path: string }): React.JSX.Element => {
  const cut = path.lastIndexOf('/') + 1
  return <span className="font-mono text-small text-muted-foreground">{path.slice(0, cut)}<span className="text-foreground">{path.slice(cut)}</span></span>
}

export function RepoGeneral({ project, settings, save }: { project: ProjectInfo; settings: Settings; save: SaveFn }): React.JSX.Element {
  const [prefs, setPrefs] = useRepoPrefs(project, settings, save)
  const [root, setRoot] = useState('')
  const [removing, setRemoving] = useState(false)
  useEffect(() => { void window.api.getWorktreesRoot().then(setRoot) }, [])
  return (
    <>
      <SettingsSection>
        <SettingsRow stacked label="Root path" description={<Warn>Do not move or delete this directory. Instead, remove the repository in AgentDeck.</Warn>}><PathText path={project.path} /></SettingsRow>
        {root && <SettingsRow stacked label="Workspaces path" description={<Warn>Do not move or delete the workspace subdirectories. Instead, archive sessions in AgentDeck.</Warn>}><PathText path={`${root}/${project.name}`} /></SettingsRow>}
      </SettingsSection>
      <SettingsSection>
        <PreviewList key={project.id} prefs={prefs} set={setPrefs} />
        <ToggleRow label="Open previews on plain localhost" description="Open http://localhost:PORT instead of a per-session address." checked={prefs.plainLocalhost} onChange={(v) => setPrefs({ plainLocalhost: v })} />
        <CopyFiles projectId={project.id} />
      </SettingsSection>
      <div><Button variant="outline" className="text-destructive" onClick={() => setRemoving(true)}><Trash2 className="size-4" aria-hidden />Remove repository</Button></div>
      <ConfirmDialog open={removing} onOpenChange={setRemoving} destructive title={`Remove ${project.name}?`} confirmLabel="Remove" description="It disappears from AgentDeck. The folder and its files stay where they are. Archive its sessions first." onConfirm={() => void actions.removeProject(project.id)} />
    </>
  )
}

const HEAD = ''
/** Per-repository git settings: where new worktrees branch from and which remote they push to. */
export function RepoGit({ project, settings, save }: { project: ProjectInfo; settings: Settings; save: (p: Partial<Settings>) => void }): React.JSX.Element {
  const [refs, setRefs] = useState<{ branches: string[]; remotes: string[] } | null>(null)
  useEffect(() => { void window.api.listRefs(project.id).then(setRefs, () => setRefs({ branches: [], remotes: [] })) }, [project.id])
  const [prefs, setPrefs] = useRepoPrefs(project, settings, save)
  const cur = settings.repoGit[project.id] ?? { baseBranch: '', remote: '' }
  const set = (patch: Partial<typeof cur>): void => save({ repoGit: { ...settings.repoGit, [project.id]: { ...cur, ...patch } } })
  if (!refs) return <Loading />
  const withCurrent = (list: string[], v: string): string[] => (v && !list.includes(v) ? [v, ...list] : list)
  return (
    <SettingsSection>
      <SettingsRow stacked label="Branch new workspaces from" description="Each session worktree is an isolated copy of your codebase, branched from here.">
        <Select label="Base branch" className="w-auto min-w-32" value={cur.baseBranch} onChange={(v) => set({ baseBranch: v })} options={[{ value: HEAD, label: 'Current branch' }, ...withCurrent(refs.branches, cur.baseBranch).map((b) => ({ value: b, label: b }))]} />
      </SettingsRow>
      <SettingsRow stacked label="Remote origin" description="Where should we push, pull, and create PRs?">
        <Select label="Remote" className="w-auto min-w-32" value={cur.remote} onChange={(v) => set({ remote: v })} options={[{ value: '', label: 'origin' }, ...withCurrent(refs.remotes, cur.remote).filter((r) => r !== 'origin').map((r) => ({ value: r, label: r }))]} />
      </SettingsRow>
      <ToggleRow label="Archive on merge" description="Archive a session when its pull request is merged." checked={prefs.archiveOnMerge} onChange={(v) => setPrefs({ archiveOnMerge: v })} />
      <ToggleRow label="Set upstream on push" description="Track the remote branch when pushing a session." checked={prefs.setUpstream} onChange={(v) => setPrefs({ setUpstream: v })} />
      <ToggleRow label="Delete branch on archive" description="Delete the local branch when archiving a session. Applies to every repository." checked={settings.deleteBranchOnArchive} onChange={(v) => save({ deleteBranchOnArchive: v })} />
    </SettingsSection>
  )
}

/** Custom actions, run mode, and the custom instructions prepended to each agent prompt. */
export function RepoActions({ project }: { project: ProjectInfo }): React.JSX.Element {
  const { settings } = useStore()
  const cur = settings.repoActions[project.id] ?? DEFAULT_REPO_ACTIONS
  const set = (patch: Partial<RepoActionsPrefs>): void => void actions.saveSettings({ repoActions: { ...settings.repoActions, [project.id]: { ...cur, ...patch } } })
  return (
    <>
      <RunTab projectId={project.id} page />
      <SettingsSection>
        <SettingsRow label="Run mode" description="Nonconcurrent stops other sessions' running actions in this repository when you start one.">
          <Select label="Run mode" className="w-auto min-w-32" value={cur.runMode} onChange={(v) => set({ runMode: v as RepoActionsPrefs['runMode'] })} options={[{ value: 'concurrent', label: 'Concurrent' }, { value: 'nonconcurrent', label: 'Nonconcurrent' }]} />
        </SettingsRow>
      </SettingsSection>
      <SettingsSection>
        <div className="flex flex-col gap-1">
          {INSTRUCTION_KEYS.map(([k, label]) => (
            <Disclosure key={k} head={<span className="block text-left"><span className="block text-prose font-medium">{label} preferences</span><span className="block text-prose font-normal text-muted-foreground">{k === 'general' ? 'Add custom instructions sent to the agent at the start of every new chat.' : k === 'branchRename' ? 'Add custom instructions for generating branch names from your messages.' : `Add custom instructions sent to the agent when you click the ${k === 'review' ? 'Review' : label} button.`}</span></span>}>
              <Textarea key={project.id} rows={4} aria-label={`${label} instructions`} defaultValue={cur.instructions[k] ?? ''} onBlur={(e) => e.target.value !== (cur.instructions[k] ?? '') && set({ instructions: { ...cur.instructions, [k]: e.target.value } })} />
            </Disclosure>
          ))}
        </div>
      </SettingsSection>
    </>
  )
}

/** Edits the repo's agentdeck.json setup and archive commands. */
export function RepoScripts({ project }: { project: ProjectInfo }): React.JSX.Element {
  const [cfg, setCfg] = useState<{ setup: string; archive: string } | null>(null)
  const [orig, setOrig] = useState('')
  useEffect(() => {
    window.api.getProjectConfig(project.id).then((c) => {
      const v = { setup: c.setup ?? '', archive: c.archive ?? '' }
      setCfg(v); setOrig(JSON.stringify(v))
    }, actions.fail)
  }, [project.id])
  if (!cfg) return <Loading />
  const save = (): void => {
    window.api.getProjectConfig(project.id).then((c) => window.api.setProjectConfig(project.id, { ...c, ...cfg })).then(() => { setOrig(JSON.stringify(cfg)); actions.ok('Saved agentdeck.json') }, actions.fail)
  }
  const script = (key: 'setup' | 'archive', title: string, hint: string): React.JSX.Element => (
    <Field label={title}>
      <span className="text-small text-muted-foreground">{hint}</span>
      <Textarea rows={3} className="font-mono" value={cfg[key]} onChange={(e) => setCfg({ ...cfg, [key]: e.target.value })} />
    </Field>
  )
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save() }}>
      <p className="text-small text-muted-foreground">Commands that run when sessions are set up or archived.</p>
      {script('setup', 'Setup script', 'Runs when a new session is created')}
      <hr className="border-border" />
      {script('archive', 'Archive script', 'Runs before a session is archived')}
      <div><Button variant="default" disabled={JSON.stringify(cfg) === orig}>Save</Button></div>
    </form>
  )
}
