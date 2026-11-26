import { useSyncExternalStore } from 'react'
import { DEFAULT_SETTINGS, PROVIDERS, hasAccounts, type LimitWindow, type PermissionMode, type ProviderId, type Settings } from '../../shared/types'
import { forkPrompt, lastText } from './transcript'
import type { AccountInfo, ModelInfo, ProjectInfo, SessionInfo } from '../../shared/ipc'
import type { UsageRow } from '../../main/db'

type View =
  | { kind: 'session' }
  | { kind: 'new'; projectId: string } // new-session form
  | { kind: 'tools'; projectId: string } // import/MCP panel
  | { kind: 'settings'; tab?: string }
  | { kind: 'login'; key: string } // terminal key of an account login in progress

interface Toast { id: number; kind: 'error' | 'ok'; text: string; action?: { label: string; run: () => void } }

const load = <T>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? '') as T } catch { return fallback } }
const save = (key: string, v: unknown): void => localStorage.setItem(key, JSON.stringify(v))

interface State {
  projects: ProjectInfo[]
  sessions: Record<string, SessionInfo[]>
  selectedId: string | null
  view: View // what the main pane shows
  toasts: Toast[]
  accounts: AccountInfo[]
  queues: Record<string, string[]> // messages waiting for the running turn to end, per session
  settings: Settings
  forkText: string // prefilled first message of the new-session form (fork/handoff)
  unread: Record<string, true> // sessions with a new agent message since you last opened them
  previews: Record<string, string> // last message of each session, one line, for the sidebar
  sidebarCollapsed: boolean
  recents: string[] // last selected sessions, newest first
  seen: Record<string, number> // when you last left each session (marks what is new on return)
  // Fetched once at startup so screens render instantly instead of loading on every visit.
  catalog: Partial<Record<ProviderId, { models: ModelInfo[]; modes: PermissionMode[] }>>
  limits: Record<string, LimitWindow[]>
  usage: UsageRow[] | null
}

let state: State = { projects: [], sessions: {}, selectedId: null, view: { kind: 'session' }, toasts: [], accounts: [], settings: DEFAULT_SETTINGS, forkText: '', queues: {}, unread: {}, previews: {}, sidebarCollapsed: localStorage.getItem('sidebar-collapsed') === '1', recents: load('recents', []), seen: load('seen', {}), catalog: {}, limits: {}, usage: null }
const listeners = new Set<() => void>()
const set = (p: Partial<State>): void => {
  state = { ...state, ...p }
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
  async addProject(path?: string): Promise<void> {
    try {
      const p = await window.api.addProject(path)
      if (p && !state.projects.some((x) => x.id === p.id))
        set({ projects: [...state.projects, p], sessions: { ...state.sessions, [p.id]: [] } })
    } catch (e) {
      fail(e)
    }
  },
  upsertSession(s: SessionInfo): void {
    const list = state.sessions[s.projectId] ?? []
    const next = list.some((x) => x.id === s.id) ? list.map((x) => (x.id === s.id ? s : x)) : [s, ...list]
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
  closeLogin: (): void => set({ view: { kind: 'settings', tab: 'Accounts' } }),
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
  openSettings: (tab?: string): void => set({ view: { kind: 'settings', tab } }),
  closeSettings: (): void => set({ view: { kind: 'session' } }),
  async saveSettings(patch: Partial<Settings>): Promise<void> {
    try {
      set({ settings: await window.api.setSettings(patch) })
      if (patch.cliPaths) { actions.refreshCatalog(); actions.refreshLimits() } // a different binary can list different models
    } catch (e) { fail(e) }
  },
  openTools: (projectId: string): void => set({ view: { kind: 'tools', projectId } }),
  openNew: (projectId: string, text = ''): void => set({ view: { kind: 'new', projectId }, forkText: text }),
  closeNew: (): void => set({ view: { kind: 'session' } }),
  /** Opens the new-session form in the same project with this session's chat as the first message. */
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
  s.view.kind === 'tools' || s.view.kind === 'new' ? s.view.projectId : findSession(s, s.selectedId)?.projectId

export const findSession = (s: State, id: string | null): SessionInfo | undefined =>
  Object.values(s.sessions).flat().find((x) => x.id === id)
