import { spawn } from 'node:child_process'
import type {
  AcpAgent, AgentEvent, ApprovalDecision, ImageAttachment, LimitWindow, PermissionMode, ProviderAdapter, ProviderId, StartOptions,
} from '../../shared/types'
import { cliPath } from '../settings'
import { RpcClient, type RpcChild } from './rpc'

export type AcpSpawnFn = (agent: AcpAgent, cwd: string) => RpcChild

const defaultSpawn = (id: ProviderId): AcpSpawnFn => (agent, cwd) =>
  spawn(cliPath(id, agent.command), [...agent.args], { cwd, stdio: ['pipe', 'pipe', 'inherit'] }) as unknown as RpcChild

interface PermOption { optionId: string; kind: string }
interface Session {
  client: RpcClient
  acpId: string
  opts: StartOptions
  emit: (e: AgentEvent) => void
  text: string // assistant text of the running turn
  loading: boolean // session/load replays history; drop those updates (already in the DB)
  approvals: Map<string, { rpcId: number | string; options: PermOption[] }>
}

const pick = (options: PermOption[], ...kinds: string[]): PermOption | undefined =>
  kinds.map((k) => options.find((o) => o.kind === k)).find(Boolean)

const toolKind = (k?: string): 'command' | 'edit' | 'other' => (k === 'execute' ? 'command' : k === 'edit' || k === 'delete' || k === 'move' ? 'edit' : 'other')

const contentText = (content: any[] | undefined): string | undefined => {
  const t = (content ?? []).filter((c) => c.type === 'content' && c.content?.type === 'text').map((c) => c.content.text)
  return t.length ? t.join('\n') : undefined
}

/** Generic Agent Client Protocol adapter: one child process per session. */
export class AcpAdapter implements ProviderAdapter {
  readonly permissionModes: readonly PermissionMode[] = ['supervised', 'auto-edit', 'full-access']
  private sessions = new Map<string, Session>()

  constructor(readonly id: ProviderId, private agent: AcpAgent, private spawnFn: AcpSpawnFn = defaultSpawn(id)) {}

  // shortcut: no model list; the agent picks its own default. Upgrade by reading session/new `models`.
  async listModels() { return [] }
  async getLimits(): Promise<LimitWindow[]> { return [] }

  async start(opts: StartOptions, onEvent: (e: AgentEvent) => void): Promise<void> {
    const child = this.spawnFn(this.agent, opts.cwd)
    const s: Session = { client: undefined as never, acpId: '', opts, emit: onEvent, text: '', loading: false, approvals: new Map() }
    const client = new RpcClient(child, (m, p) => this.onNotify(s, m, p), (id, m, p) => this.onRequest(s, id, m, p), { jsonrpc: '2.0' })
    s.client = client
    const fail = (e: Error): void => {
      client.failAll(e)
      onEvent({ type: 'status', status: 'error', error: (e as NodeJS.ErrnoException).code === 'ENOENT' ? `${this.agent.command} not found on PATH` : e.message })
    }
    child.on?.('error', fail)
    this.sessions.set(opts.sessionId, s)
    try {
      const init = await client.call('initialize', {
        protocolVersion: 1,
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      })
      const params = { cwd: opts.cwd, mcpServers: [] }
      if (opts.resumeToken && init?.agentCapabilities?.loadSession) {
        s.acpId = opts.resumeToken
        s.loading = true
        try { await client.call('session/load', { ...params, sessionId: opts.resumeToken }) } finally { s.loading = false }
      } else {
        s.acpId = (await client.call('session/new', params)).sessionId
      }
    } catch (e) {
      this.sessions.delete(opts.sessionId)
      client.kill()
      throw e
    }
  }

  private get(sessionId: string): Session {
    const s = this.sessions.get(sessionId)
    if (!s) throw new Error(`unknown session ${sessionId}`)
    return s
  }

  async send(sessionId: string, text: string, images: ImageAttachment[] = []): Promise<void> {
    const s = this.get(sessionId)
    s.text = ''
    s.emit({ type: 'status', status: 'working' })
    try {
      const r = await s.client.call('session/prompt', { sessionId: s.acpId, prompt: [...(text ? [{ type: 'text', text }] : []), ...images.map((i) => ({ type: 'image', data: i.data, mimeType: i.mimeType }))] })
      if (s.text) s.emit({ type: 'message', role: 'assistant', text: s.text })
      s.emit({ type: 'status', status: r?.stopReason === 'cancelled' ? 'idle' : r?.stopReason === 'refusal' ? 'error' : 'done' })
    } catch (e) {
      s.emit({ type: 'status', status: 'error', error: (e as Error).message })
    }
  }

  async interrupt(sessionId: string): Promise<void> {
    const s = this.get(sessionId)
    s.approvals.forEach((a) => s.client.respond(a.rpcId, { outcome: { outcome: 'cancelled' } }))
    s.approvals.clear()
    s.client.notify('session/cancel', { sessionId: s.acpId })
  }

  async respondToApproval(sessionId: string, approvalId: string, d: ApprovalDecision): Promise<void> {
    const s = this.get(sessionId)
    const a = s.approvals.get(approvalId)
    if (!a) throw new Error(`unknown approval ${approvalId}`)
    s.approvals.delete(approvalId)
    const o = d.allow ? (d.always ? pick(a.options, 'allow_always', 'allow_once') : pick(a.options, 'allow_once', 'allow_always')) : pick(a.options, 'reject_once', 'reject_always')
    s.client.respond(a.rpcId, { outcome: o ? { outcome: 'selected', optionId: o.optionId } : { outcome: 'cancelled' } })
  }

  getResumeToken(sessionId: string): string | undefined { return this.sessions.get(sessionId)?.acpId || undefined }

  async close(sessionId: string): Promise<void> {
    this.sessions.get(sessionId)?.client.kill()
    this.sessions.delete(sessionId)
  }

  /** Kill every agent process (app shutdown). */
  dispose(): void { this.sessions.forEach((s) => s.client.kill()); this.sessions.clear() }

  private onRequest(s: Session, rpcId: number | string, method: string, p: any): void {
    if (method !== 'session/request_permission') return s.client.respondError(rpcId, `unsupported: ${method}`)
    const options: PermOption[] = p.options ?? []
    const kind = toolKind(p.toolCall?.kind)
    const mode = s.opts.permissionMode
    if (mode === 'full-access' || (mode === 'auto-edit' && kind === 'edit')) {
      const o = pick(options, 'allow_once', 'allow_always')
      return s.client.respond(rpcId, { outcome: o ? { outcome: 'selected', optionId: o.optionId } : { outcome: 'cancelled' } })
    }
    const id = String(rpcId)
    s.approvals.set(id, { rpcId, options })
    s.emit({ type: 'approval_request', id, kind, summary: (p.toolCall?.title ?? 'Permission requested') as string, detail: p.toolCall })
  }

  private onNotify(s: Session, method: string, p: any): void {
    if (method !== 'session/update' || s.loading) return
    const u = p?.update
    switch (u?.sessionUpdate) {
      case 'agent_message_chunk':
        if (u.content?.type !== 'text') return
        s.text += u.content.text
        return s.emit({ type: 'message', role: 'assistant', text: u.content.text, partial: true }) // delta, like the other adapters
      case 'tool_call':
      case 'tool_call_update': {
        s.emit({ type: 'tool_call', id: u.toolCallId, name: u.title ?? u.kind ?? 'tool', input: u.rawInput, output: contentText(u.content) })
        for (const c of (u.content ?? []) as any[]) {
          if (c.type === 'diff') s.emit({ type: 'file_change', path: c.path, diff: c.newText })
        }
      }
    }
  }
}
