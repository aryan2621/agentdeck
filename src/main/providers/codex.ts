import { spawn } from 'node:child_process'
import type {
  AgentEvent, ApprovalDecision, ImageAttachment, LimitWindow, PermissionMode, ProviderAdapter, StartOptions,
} from '../../shared/types'
import { cliPath, getSettings, userEnv } from '../settings'
import { apiKeyEnv } from '../apiKeys'
import { RpcClient, type RpcChild } from './rpc'

export type SpawnFn = (env: NodeJS.ProcessEnv) => RpcChild

const defaultSpawn: SpawnFn = (env) =>
  spawn(cliPath('codex', 'codex'), ['app-server'], { stdio: ['pipe', 'pipe', 'inherit'], env }) as unknown as RpcChild

// supervised: read-only + ask; auto-edit: workspace edits free, commands outside trust ask; full: no prompts.
const POLICY: Record<PermissionMode, { approvalPolicy: string; sandbox: string; sandboxPolicy: object }> = {
  supervised: { approvalPolicy: 'untrusted', sandbox: 'read-only', sandboxPolicy: { type: 'readOnly', networkAccess: false } },
  'auto-edit': {
    approvalPolicy: 'untrusted', sandbox: 'workspace-write',
    sandboxPolicy: { type: 'workspaceWrite', writableRoots: [], networkAccess: false, excludeTmpdirEnvVar: false, excludeSlashTmp: false },
  },
  plan: { approvalPolicy: 'untrusted', sandbox: 'read-only', sandboxPolicy: { type: 'readOnly', networkAccess: false } }, // not advertised; keeps the Record total
  auto: { approvalPolicy: 'untrusted', sandbox: 'read-only', sandboxPolicy: { type: 'readOnly', networkAccess: false } }, // not advertised
  'full-access': { approvalPolicy: 'never', sandbox: 'danger-full-access', sandboxPolicy: { type: 'dangerFullAccess' } },
}

/** The mode's policy, with the approval policy overridden by the Account page's Codex tool approvals ('default' keeps the mode's). */
const policyFor = (m: PermissionMode): (typeof POLICY)[PermissionMode] => {
  const o = getSettings().codexApprovals
  return o === 'default' ? POLICY[m] : { ...POLICY[m], approvalPolicy: o }
}

interface Session {
  client: RpcClient
  threadId: string
  turnId?: string
  opts: StartOptions
  emit: (e: AgentEvent) => void
}

const windowName = (mins: number | null, fallback: string): string =>
  mins === 300 ? '5h' : mins === 10080 ? 'weekly' : mins ? `${mins}m` : fallback

export function mapLimits(r: any): LimitWindow[] {
  const s = r?.rateLimits
  const out: LimitWindow[] = []
  for (const [w, fb] of [[s?.primary, 'primary'], [s?.secondary, 'secondary']] as const) {
    if (w) out.push({ name: windowName(w.windowDurationMins, fb), remainingPercent: 100 - w.usedPercent, resetsAt: w.resetsAt ?? undefined })
  }
  const i = s?.individualLimit
  if (i) out.push({ name: 'individual', remainingPercent: i.remainingPercent, resetsAt: i.resetsAt })
  return out
}

/** Split a unified diff into per-file chunks keyed by path. */
function splitDiff(diff: string): { path: string; diff: string }[] {
  return diff.split(/^(?=diff --git )/m).filter(Boolean).map((chunk) => ({
    path: /^diff --git a\/(.+?) b\//.exec(chunk)?.[1] ?? '',
    diff: chunk,
  }))
}

export class CodexAdapter implements ProviderAdapter {
  readonly id = 'codex' as const
  readonly permissionModes = ['supervised', 'auto-edit', 'full-access'] as const
  private clients = new Map<string, RpcClient>() // by configDir ('' = default)
  private sessions = new Map<string, Session>()
  private byThread = new Map<string, Session>()
  private approvals = new Map<string, { client: RpcClient; rpcId: number | string; fileChange: boolean }>()

  constructor(private spawnFn: SpawnFn = defaultSpawn) {}

  private client(configDir?: string, env: Record<string, string> = userEnv()): RpcClient {
    const key = `${configDir ?? ''}|${JSON.stringify(env)}` // one app-server per account+environment
    let c = this.clients.get(key)
    if (!c) {
      const child = this.spawnFn({ ...process.env, ...apiKeyEnv('codex'), ...env, ...(configDir ? { CODEX_HOME: configDir } : {}) })
      c = new RpcClient(child,
        (m, p) => this.onNotify(m, p),
        (id, m, p) => this.onRequest(c!, id, m, p))
      c.ready = c.call('initialize', { clientInfo: { name: 'agentdeck', version: '0.1.0' } }).then(() => c!.notify('initialized'))
      this.clients.set(key, c)
    }
    return c
  }

  async listModels(configDir?: string) {
    const r = await this.client(configDir).request('model/list', {})
    return (r.data as any[]).filter((m) => !m.hidden).map((m) => ({ id: m.id as string, label: m.displayName as string, ...(m.supportedReasoningEfforts?.length ? { efforts: m.supportedReasoningEfforts.map((e: any) => e.reasoningEffort as string) } : {}) }))
  }

  async getLimits(configDir?: string): Promise<LimitWindow[]> {
    return mapLimits(await this.client(configDir).request('account/rateLimits/read'))
  }

  async start(opts: StartOptions, onEvent: (e: AgentEvent) => void): Promise<void> {
    const client = this.client(opts.configDir, opts.env)
    const p = policyFor(opts.permissionMode)
    const params = { cwd: opts.cwd, model: opts.model, approvalPolicy: p.approvalPolicy, sandbox: p.sandbox }
    const r = opts.resumeToken
      ? await client.request('thread/resume', { ...params, threadId: opts.resumeToken })
      : await client.request('thread/start', params)
    const s: Session = { client, threadId: r.thread.id, opts, emit: onEvent }
    this.sessions.set(opts.sessionId, s)
    this.byThread.set(s.threadId, s)
  }

  private get(sessionId: string): Session {
    const s = this.sessions.get(sessionId)
    if (!s) throw new Error(`unknown session ${sessionId}`)
    return s
  }

  async send(sessionId: string, text: string, images: ImageAttachment[] = []): Promise<void> {
    const s = this.get(sessionId)
    // image items as data URLs (field name from memory, unverified live)
    const input = [...(text ? [{ type: 'text', text, text_elements: [] }] : []), ...images.map((i) => ({ type: 'image', url: `data:${i.mimeType};base64,${i.data}` }))]
    // Turn running: steer it instead of starting a second turn (field names from memory, unverified live).
    if (s.turnId) return void (await s.client.request('turn/steer', { threadId: s.threadId, input, expectedTurnId: s.turnId }))
    const p = policyFor(s.opts.permissionMode)
    await s.client.request('turn/start', {
      threadId: s.threadId,
      input,
      approvalPolicy: p.approvalPolicy,
      sandboxPolicy: p.sandboxPolicy,
      ...(s.opts.effort ? { effort: s.opts.effort } : {}),
    })
  }

  async interrupt(sessionId: string): Promise<void> {
    const s = this.get(sessionId)
    if (s.turnId) await s.client.request('turn/interrupt', { threadId: s.threadId, turnId: s.turnId })
  }

  async respondToApproval(_sessionId: string, approvalId: string, d: ApprovalDecision): Promise<void> {
    const a = this.approvals.get(approvalId)
    if (!a) throw new Error(`unknown approval ${approvalId}`)
    this.approvals.delete(approvalId)
    a.client.respond(a.rpcId, { decision: d.allow ? (d.always ? 'acceptForSession' : 'accept') : 'decline' })
  }

  getResumeToken(sessionId: string): string | undefined { return this.sessions.get(sessionId)?.threadId }

  async close(sessionId: string): Promise<void> {
    const s = this.sessions.get(sessionId)
    if (!s) return
    this.sessions.delete(sessionId)
    this.byThread.delete(s.threadId)
    // shortcut: the shared app-server stays alive until the process exits; kill it when idle if that leaks.
  }

  /** Kill every app-server (app shutdown). */
  dispose(): void { this.clients.forEach((c) => c.kill()); this.clients.clear() }

  private onRequest(client: RpcClient, rpcId: number | string, method: string, p: any): void {
    const s = this.byThread.get(p?.threadId)
    const fileChange = method === 'item/fileChange/requestApproval'
    if (!s || (!fileChange && method !== 'item/commandExecution/requestApproval')) {
      client.respond(rpcId, { decision: 'decline' }) // unsupported server request: refuse rather than hang the turn
      return
    }
    const id = String(rpcId)
    this.approvals.set(id, { client, rpcId, fileChange })
    s.emit({
      type: 'approval_request', id, kind: fileChange ? 'edit' : 'command',
      summary: (fileChange ? p.reason ?? 'Apply file changes' : p.command ?? p.reason ?? 'Run command') as string,
      detail: p,
    })
  }

  private onNotify(method: string, p: any): void {
    const s = this.byThread.get(p?.threadId)
    if (!s) return
    const emit = s.emit
    switch (method) {
      case 'turn/started':
        s.turnId = p.turn.id
        return emit({ type: 'status', status: 'working' })
      case 'turn/completed': {
        s.turnId = undefined
        const t = p.turn
        if (t.status === 'failed') return emit({ type: 'status', status: 'error', error: t.error?.message })
        return emit({ type: 'status', status: t.status === 'interrupted' ? 'idle' : 'done' })
      }
      case 'error':
        if (!p.willRetry) emit({ type: 'status', status: 'error', error: p.error?.message })
        return
      case 'item/agentMessage/delta':
        return emit({ type: 'message', role: 'assistant', text: p.delta, partial: true })
      case 'turn/diff/updated':
        return splitDiff(p.diff).forEach((f) => emit({ type: 'file_change', ...f }))
      case 'thread/tokenUsage/updated':
        return emit({ type: 'usage', inputTokens: p.tokenUsage.total.inputTokens, outputTokens: p.tokenUsage.total.outputTokens })
      case 'item/started':
      case 'item/completed':
        return this.onItem(emit, p.item, method === 'item/completed')
    }
  }

  private onItem(emit: (e: AgentEvent) => void, item: any, done: boolean): void {
    switch (item.type) {
      case 'agentMessage':
        if (done) emit({ type: 'message', role: 'assistant', text: item.text })
        return
      case 'fileChange':
        if (done) (item.changes as any[]).forEach((c) => emit({ type: 'file_change', path: c.path, diff: c.diff }))
        return
      case 'commandExecution':
        return emit({ type: 'tool_call', id: item.id, name: 'shell', input: { command: item.command, cwd: item.cwd }, output: done ? item.aggregatedOutput ?? undefined : undefined })
      case 'mcpToolCall':
        return emit({ type: 'tool_call', id: item.id, name: `${item.server}.${item.tool}`, input: item.arguments, output: done ? JSON.stringify(item.result ?? item.error ?? null) : undefined })
    }
  }
}
