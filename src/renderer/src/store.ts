import { useSyncExternalStore } from 'react'
import { DEFAULT_SETTINGS, type ProviderId, type Settings } from '../../shared/types'
import { forkPrompt } from './transcript'
import type { AccountInfo, ProjectInfo, SessionInfo } from '../../shared/ipc'

export type View =
  | { kind: 'session' }
  | { kind: 'new'; projectId: string } // new-session form
  | { kind: 'tools'; projectId: string } // import/MCP panel
  | { kind: 'grid' } // overview of all sessions
  | { kind: 'settings' }
  | { kind: 'login'; key: string } // terminal key of an account login in progress

export interface Toast { id: number; kind: 'error' | 'ok'; text: string }

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
}

let state: State = { projects: [], sessions: {}, selectedId: null, view: { kind: 'session' }, toasts: [], accounts: [], settings: DEFAULT_SETTINGS, forkText: '', queues: {} }
const listeners = new Set<() => void>()
const set = (p: Partial<State>): void => {
  state = { ...state, ...p }
  listeners.forEach((l) => l())
}
let toastId = 0
const dismiss = (id: number): void => set({ toasts: state.toasts.filter((t) => t.id !== id) })
const toast = (kind: Toast['kind'], text: string): void => {
  const id = ++toastId
  set({ toasts: [...state.toasts.slice(-3), { id, kind, text }] })
  if (kind === 'ok') setTimeout(() => dismiss(id), 4000) // errors stay until dismissed
}
const fail = (e: unknown): void => toast('error', e instanceof Error ? e.message : String(e))

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
    } catch (e) {
      fail(e)
    }
  },
  async addProject(): Promise<void> {
    try {
      const p = await window.api.addProject()
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
  closeLogin: (): void => set({ view: { kind: 'settings' } }),
  select: (selectedId: string): void => set({ selectedId, view: { kind: 'session' } }),
  openSettings: (): void => set({ view: { kind: 'settings' } }),
  async saveSettings(patch: Partial<Settings>): Promise<void> {
    try { set({ settings: await window.api.setSettings(patch) }) } catch (e) { fail(e) }
  },
  openTools: (projectId: string): void => set({ view: { kind: 'tools', projectId } }),
  openNew: (projectId: string): void => set({ view: { kind: 'new', projectId }, forkText: '' }),
  closeNew: (): void => set({ view: { kind: 'session' } }),
  toggleGrid: (): void => set({ view: { kind: state.view.kind === 'grid' ? 'session' : 'grid' } as View }),
  /** Opens the new-session form in the same project with this session's chat as the first message. */
  async fork(s: SessionInfo): Promise<void> {
    try {
      set({ forkText: forkPrompt(await window.api.getEvents(s.id), s.title), view: { kind: 'new', projectId: s.projectId } })
    } catch (e) {
      fail(e)
    }
  },
  dismiss,
  ok: (text: string): void => toast('ok', text),
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

export const findSession = (s: State, id: string | null): SessionInfo | undefined =>
  Object.values(s.sessions).flat().find((x) => x.id === id)
