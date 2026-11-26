import { useSyncExternalStore } from 'react'
import { DEFAULT_SETTINGS, PROVIDERS, hasAccounts, type LimitWindow, type PermissionMode, type ProviderId, type Settings } from '../../../shared/types'
import { forkPrompt, lastText } from './transcript'
import { NOT_GIT, type AccountInfo, ModelInfo, ProjectInfo, SessionInfo } from '../../../shared/ipc'
import type { UsageRow } from '../../../main/db'

type View =
  | { kind: 'session' }
  | { kind: 'new'; projectId: string } // new-session form
  | { kind: 'settings'; tab?: string; projectId?: string }
  | { kind: 'dashboard' }
  | { kind: 'compare'; groupId: string } // side-by-side diffs of one run group
  | { kind: 'login'; key: string } // terminal key of an account login in progress

interface Toast { id: number; kind: 'error' | 'ok'; text: string; action?: { label: string; run: () => void } }

const load = <T>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? '') as T } catch { return fallback } }
const save = (key: string, v: unknown): void => localStorage.setItem(key, JSON.stringify(v))

interface State {
  initPath: string | null // folder awaiting "initialise git" confirmation
  projectDialog: 'create' | 'clone' | null
  projects: ProjectInfo[]
  sessions: Record<string, SessionInfo[]>
  selectedId: string | null
  view: View // what the main pane shows
  nav: { back: boolean; forward: boolean } // whether the back/forward arrows have somewhere to go
  toasts: Toast[]
  accounts: AccountInfo[]
  queues: Record<string, string[]> // messages waiting for the running turn to end, per session
  settings: Settings
  forkText: string // prefilled first message of the new-session form (fork/handoff)
  unread: Record<string, true> // sessions with a new agent message since you last opened them
  previews: Record<string, string> // last message of each session, one line, for the sidebar
  sidebarCollapsed: boolean
  split: string | null // second session shown beside the selected one
  statsOpen: boolean
  recents: string[] // last selected sessions, newest first
  seen: Record<string, number> // when you last left each session (marks what is new on return)
  // Fetched once at startup so screens render instantly instead of loading on every visit.
  catalog: Partial<Record<ProviderId, { models: ModelInfo[]; modes: PermissionMode[] }>>
  limits: Record<string, LimitWindow[]>
  usage: UsageRow[] | null
}

let state: State = { initPath: null, projectDialog: null, projects: [], sessions: {}, selectedId: null, view: { kind: 'session' }, nav: { back: false, forward: false }, toasts: [], accounts: [], settings: DEFAULT_SETTINGS, forkText: '', queues: {}, unread: {}, previews: {}, split: null, sidebarCollapsed: localStorage.getItem('sidebar-collapsed') === '1', statsOpen: localStorage.getItem('stats-open') === '1', recents: load('recents', []), seen: load('seen', {}), catalog: {}, limits: {}, usage: null }
const listeners = new Set<() => void>()
// Back/forward trail of (selected session, view) pairs; every navigation appends, going back keeps the rest so forward works.
interface Spot { selectedId: string | null; view: View }
let trail: Spot[] = [{ selectedId: null, view: { kind: 'session' } }]
let at = 0
let travelling = false
const set = (p: Partial<State>): void => {
  state = { ...state, ...p }
  if (!travelling && ('selectedId' in p || 'view' in p)) {
    const here = trail[at]
    if (here.selectedId !== state.selectedId || JSON.stringify(here.view) !== JSON.stringify(state.view)) {
      trail = [...trail.slice(0, at + 1), { selectedId: state.selectedId, view: state.view }].slice(-50)
      at = trail.length - 1
    }
  }
  state = { ...state, nav: { back: at > 0, forward: at < trail.length - 1 } }
  listeners.forEach((l) => l())
}
let toastId = 0
const dismiss = (id: number): void => set({ toasts: state.toasts.filter((t) => t.id !== id) })
const toast = (kind: Toast['kind'], text: string, action?: Toast['action']): void => {
  const id = ++toastId
  set({ toasts: [...state.toasts.slice(-3), { id, kind, text, action }] })
  if (kind === 'ok') setTimeout(() => dismiss(id), 4000) // errors stay until dismissed
}
const fail = (e: unknown): void => toast('error', e instanceof Error ? e.message : String(e))

window.api?.onEvent((sid, e) => { // api is absent in unit tests
  if (e.type === 'message' && !e.partial) set({ previews: { ...state.previews, [sid]: lastText([e]) }, unread: sid === state.selectedId || e.role !== 'assistant' ? state.unread : { ...state.unread, [sid]: true } })
})

export const useStore = (): State =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state
  )

export const actions = {
  async load(): Promise<void> {
    try {
      const projects = await window.api.listProjects()
      const lists = await Promise.all(projects.map((p) => window.api.listSessions(p.id)))
      set({ accounts: await window.api.listAccounts(), settings: await window.api.getSettings() })
      set({ projects, sessions: Object.fromEntries(projects.map((p, i) => [p.id, lists[i]])) })
      // shortcut: one getEvents per session at startup; add a lastMessage field to listSessions if this gets slow.
      actions.refreshCatalog(); actions.refreshLimits(); actions.refreshUsage()
      lists.flat().forEach((s) => window.api.getEvents(s.id).then((ev) => set({ previews: { ...state.previews, [s.id]: lastText(ev) } }), () => {}))
    } catch (e) {
      fail(e)
    }
  },
  /** Models and modes per provider. A provider that fails (CLI missing) gets an empty entry so forms don't wait forever. */
  refreshCatalog(): void {
    PROVIDERS.forEach(({ id }) => Promise.all([window.api.listModels(id), window.api.providerModes(id)]).then(
      ([models, modes]) => set({ catalog: { ...state.catalog, [id]: { models, modes } } }),
      () => set({ catalog: { ...state.catalog, [id]: { models: [], modes: [] } } })
    ))
  },
  refreshLimits(): void {
    PROVIDERS.filter((p) => hasAccounts(p.id)).forEach(({ id }) => window.api.getLimits(id).then((w) => set({ limits: { ...state.limits, [id]: w } }), () => {}))
  },
  refreshUsage(): void { window.api.usageSummary().then((usage) => set({ usage }), fail) },
  async addProject(path?: string, init?: 'private' | 'public' | 'local'): Promise<void> {
    try {
      const p = init ? await window.api.initProject(path!, init === 'local' ? undefined : init) : await window.api.addProject(path)
      if (p && !state.projects.some((x) => x.id === p.id))
        set({ projects: [...state.projects, p], sessions: { ...state.sessions, [p.id]: [] } })
    } catch (e) {
      const m = e instanceof Error ? e.message : ''
      const i = m.indexOf(` ${NOT_GIT}`)
      if (i > 0 && !init) set({ initPath: m.slice(m.lastIndexOf('Error: ') < 0 ? 0 : m.lastIndexOf('Error: ') + 7, i) })
      else fail(e)
    }
  },
  closeInit(): void { set({ initPath: null }) },
  compare: (groupId: string): void => set({ view: { kind: 'compare', groupId } }),
  split: (split: string | null): void => set({ split }),
  dashboard: (): void => set({ view: { kind: 'dashboard' } }),
  home: (): void => set({ selectedId: null, view: { kind: 'session' } }),
  openProjectDialog: (projectDialog: 'create' | 'clone'): void => set({ projectDialog }),
  closeProjectDialog: (): void => set({ projectDialog: null }),
  /** Create or clone a project, add it to the list and open its new-session form. */
  async makeProject(p: Promise<ProjectInfo | null>, onAdded?: () => void): Promise<boolean> {
    try {
      const info = await p
      if (!info) return false
      if (!state.projects.some((x) => x.id === info.id)) set({ projects: [...state.projects, info], sessions: { ...state.sessions, [info.id]: [] } })
      if (onAdded) { // quick start: also open a first session, without a prompt
        onAdded()
        const cfg = state.settings
        try {
          const s = await window.api.createSession({ projectId: info.id, provider: cfg.defaultProvider, model: cfg.defaultModels[cfg.defaultProvider] || undefined, permissionMode: cfg.defaultMode, useWorktree: true })
          actions.upsertSession(s); set({ projectDialog: null }); actions.select(s.id)
          return true
        } catch (e) { fail(e) }
      }
      set({ projectDialog: null })
      actions.openNew(info.id)
      const remote = await window.api.projectRemoteUrl(info.id).catch(() => null)
      actions.ok('Project created.', remote ? { label: 'Open in GitHub', run: () => window.open(remote) } : undefined)
      return true
    } catch (e) { fail(e); return false }
  },
  upsertSession(s: SessionInfo): void {
    const list = state.sessions[s.projectId] ?? []
    const next = (s.status as string) === 'archived' ? list.filter((x) => x.id !== s.id) : list.some((x) => x.id === s.id) ? list.map((x) => (x.id === s.id ? s : x)) : [s, ...list]
    const was = list.find((x) => x.id === s.id)?.status
    set({ sessions: { ...state.sessions, [s.projectId]: next } })
    // Turn ended: send the next queued message (one per turn end), even if another session is on screen.
    const busy = (x?: string): boolean => x === 'working' || x === 'needs-you'
    const q = state.queues[s.id]
    if (busy(was) && !busy(s.status) && q?.length) {
      set({ queues: { ...state.queues, [s.id]: q.slice(1) } })
      window.api.sendMessage(s.id, q[0]).catch(fail)
    }
  },
  setQueue(id: string, q: string[]): void { set({ queues: { ...state.queues, [id]: q } }) },
  async addAccount(provider: ProviderId, label: string): Promise<void> {
    try {
      const a = await window.api.addAccount(provider, label)
      set({ accounts: [...state.accounts, a], view: { kind: 'login', key: await window.api.accountLogin(a.id) } })
    } catch (e) {
      fail(e)
    }
  },
  async removeAccount(id: string): Promise<void> {
    try { await window.api.removeAccount(id); set({ accounts: state.accounts.filter((a) => a.id !== id) }) } catch (e) { fail(e) }
  },
  closeLogin: (): void => set({ view: { kind: 'settings', tab: 'Account' } }),
  /** Back/forward through visited sessions and pages, skipping sessions that no longer exist. */
  go(dir: -1 | 1): void {
    const alive = (sp: Spot): boolean => sp.selectedId === null || Object.values(state.sessions).flat().some((x) => x.id === sp.selectedId)
    let i = at + dir
    while (trail[i] && !alive(trail[i])) i += dir
    if (!trail[i]) return
    at = i; travelling = true
    set({ selectedId: trail[i].selectedId, view: trail[i].view })
    travelling = false
  },
  /** Un-archives a session and opens it. */
  restore: (id: string): Promise<void> => window.api.restoreSession(id).then((s) => { actions.upsertSession(s); actions.select(s.id) }, fail),
  select(selectedId: string): void {
    const prev = state.selectedId
    const seen = prev && prev !== selectedId ? { ...state.seen, [prev]: Date.now() } : state.seen
    const recents = [selectedId, ...state.recents.filter((r) => r !== selectedId)].slice(0, 5)
    save('seen', seen); save('recents', recents)
    set({ selectedId, seen, recents, view: { kind: 'session' }, unread: Object.fromEntries(Object.entries(state.unread).filter(([k]) => k !== selectedId)) })
  },
  toggleSidebar(): void {
    localStorage.setItem('sidebar-collapsed', state.sidebarCollapsed ? '0' : '1')
    set({ sidebarCollapsed: !state.sidebarCollapsed })
  },
  toggleStats(): void {
    localStorage.setItem('stats-open', state.statsOpen ? '0' : '1')
    set({ statsOpen: !state.statsOpen })
  },
  async removeProject(id: string): Promise<void> {
    try {
      await window.api.removeProject(id)
      set({ projects: state.projects.filter((p) => p.id !== id), view: { kind: 'settings' } })
    } catch (e) { fail(e) }
  },
  openSettings: (tab?: string, projectId?: string): void => set({ view: { kind: 'settings', tab, projectId } }),
  closeSettings: (): void => { if (state.view.kind === 'settings') set({ view: { kind: 'session' } }) },
  async saveSettings(patch: Partial<Settings>): Promise<void> {
    try {
      set({ settings: await window.api.setSettings(patch) })
      if (patch.autoMode !== undefined) actions.refreshCatalog()
      if (patch.cliPaths) { actions.refreshCatalog(); actions.refreshLimits() } // a different binary can list different models
    } catch (e) { fail(e) }
  },
  openTools: (projectId: string): void => actions.openSettings('History & MCP', projectId),
  openNew: (projectId: string, text = ''): void => set({ view: { kind: 'new', projectId }, forkText: text }),
  closeNew: (): void => set({ view: { kind: 'session' } }),
  /** Opens the new-session form in the same project with this session's chat as the first message. */
  /** Continues this session's chat with the other agent in a new session on the same worktree. */
  async switchAgent(s: SessionInfo): Promise<void> {
    try {
      const next = PROVIDERS.find((p) => p.id !== s.provider)!
      const to = next.id
      const prompt = forkPrompt(await window.api.getEvents(s.id), s.title)
      const n = await window.api.createSession({ projectId: s.projectId, provider: to, title: `${s.title} (${next.label})`, permissionMode: s.permissionMode, useWorktree: !!s.worktreePath, shareWorktreeOf: s.id, firstMessage: prompt })
      actions.upsertSession(n)
      actions.select(n.id)
    } catch (e) { fail(e) }
  },
  async fork(s: SessionInfo, upTo?: number): Promise<void> {
    try {
      const ev = await window.api.getEvents(s.id)
      set({ forkText: forkPrompt(upTo ? ev.filter((e) => !e.ts || e.ts <= upTo) : ev, s.title), view: { kind: 'new', projectId: s.projectId } })
    } catch (e) {
      fail(e)
    }
  },
  dismiss,
  ok: (text: string, action?: Toast['action']): void => toast('ok', text, action),
  rename: (id: string, title: string): Promise<void> => window.api.renameSession(id, title).then(actions.upsertSession, fail),
  /** Archives (keeps the worktree) and moves selection to another session. */
  async archive(s: SessionInfo): Promise<void> {
    try {
      await window.api.archiveSession(s.id, false)
      const rest = (state.sessions[s.projectId] ?? []).filter((x) => x.id !== s.id)
      set({ sessions: { ...state.sessions, [s.projectId]: rest }, selectedId: state.selectedId === s.id ? (rest[0]?.id ?? null) : state.selectedId })
    } catch (e) { fail(e) }
  },
  fail
}

/** The project the user is working in: the one being tooled/created in, else the selected session's. */
export const currentProjectId = (s: State): string | undefined =>
  (s.view.kind === 'new' || s.view.kind === 'settings' ? s.view.projectId : undefined) ?? findSession(s, s.selectedId)?.projectId

export const findSession = (s: State, id: string | null): SessionInfo | undefined =>
  Object.values(s.sessions).flat().find((x) => x.id === id)
