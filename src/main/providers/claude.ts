import { createRequire } from 'node:module'
import { cliPath, getSettings, userEnv } from '../settings'
import { apiKeyEnv } from '../apiKeys'
import { query } from '@anthropic-ai/claude-agent-sdk'
import type { Options, Query, SDKMessage, SDKUserMessage, PermissionResult } from '@anthropic-ai/claude-agent-sdk'
import type {
  ImageAttachment,
  AgentEvent, ApprovalDecision, LimitWindow, PermissionMode, ProviderAdapter, StartOptions
} from '../../shared/types'

/** Native claude binary from the SDK's platform package. Packaged, it must be the unpacked copy: a path inside app.asar can't be spawned (ENOTDIR). */
function bundledClaude(): string | undefined {
  try {
    return createRequire(__filename).resolve(`@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}/claude`).replace('app.asar', 'app.asar.unpacked')
  } catch { return undefined }
}
const claudeExe = (): string | undefined => cliPath('claude', '') || bundledClaude()

export type QueryFn = (p: { prompt: AsyncIterable<SDKUserMessage>; options?: Options }) => Query

const SDK_MODES: Record<PermissionMode, Options['permissionMode']> = {
  supervised: 'default',
  'auto-edit': 'acceptEdits',
  'full-access': 'bypassPermissions',
  plan: 'plan',
  auto: 'auto'
}
const FILE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

// Minimal push-based async iterable feeding user turns into one long-lived query.
function inputChannel() {
  const buf: SDKUserMessage[] = []
  let wake: (() => void) | undefined
  let closed = false
  const iter: AsyncIterable<SDKUserMessage> = {
    async *[Symbol.asyncIterator]() {
      while (!closed) {
        if (buf.length) yield buf.shift()!
        else await new Promise<void>((r) => (wake = r))
      }
    }
  }
  return {
    iter,
    push(text: string, images: ImageAttachment[] = []) {
      const content = images.length
        ? [...(text ? [{ type: 'text' as const, text }] : []), ...images.map((i) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: i.mimeType as 'image/png', data: i.data } }))]
        : text
      buf.push({ type: 'user', message: { role: 'user', content }, parent_tool_use_id: null })
      wake?.()
    },
    close() {
      closed = true
      wake?.()
    }
  }
}

interface Session {
  q: Query
  input: ReturnType<typeof inputChannel>
  resumeToken?: string
  running?: boolean
  pending: Map<string, { resolve: (r: PermissionResult) => void; key: string }>
  always: Set<string>
}

// "Always allow" granularity: the tool, plus the program name for Bash (so `git status` also allows `git log`).
const approvalKey = (name: string, inp: Record<string, unknown>): string => (name === 'Bash' ? `Bash:${String(inp.command ?? '').trim().split(/\s+/)[0]}` : name)

const envFor = (configDir?: string, env: Record<string, string> = userEnv()): Options['env'] => ({
  ...process.env,
  ...apiKeyEnv('claude'),
  ...env,
  ...(configDir ? { CLAUDE_CONFIG_DIR: configDir } : {})
})

export function createClaudeProvider(queryFn: QueryFn = query as QueryFn): ProviderAdapter {
  const sessions = new Map<string, Session>()
  const get = (id: string): Session => {
    const s = sessions.get(id)
    if (!s) throw new Error(`unknown session ${id}`)
    return s
  }

  // Throwaway query used only for account-level calls (models, usage).
  async function probe<T>(configDir: string | undefined, fn: (q: Query) => Promise<T>): Promise<T> {
    const input = inputChannel()
    const q = queryFn({ prompt: input.iter, options: { env: envFor(configDir), pathToClaudeCodeExecutable: claudeExe() } })
    try {
      return await fn(q)
    } finally {
      input.close()
      q.close()
    }
  }

  function normalize(m: SDKMessage, s: Session, emit: (e: AgentEvent) => void): void {
    if ('session_id' in m && m.session_id) s.resumeToken = m.session_id
    switch (m.type) {
      case 'stream_event': {
        const ev = m.event as { type: string; delta?: { type: string; text?: string } }
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text)
          emit({ type: 'message', role: 'assistant', text: ev.delta.text, partial: true })
        break
      }
      case 'assistant':
        for (const b of m.message.content as Array<{ type: string; [k: string]: any }>) {
          if (b.type === 'text' && b.text) emit({ type: 'message', role: 'assistant', text: b.text })
          else if (b.type === 'tool_use') {
            emit({ type: 'tool_call', id: b.id, name: b.name, input: b.input })
            if (FILE_TOOLS.has(b.name) && typeof (b.input?.file_path ?? b.input?.notebook_path) === 'string')
              emit({ type: 'file_change', path: b.input.file_path ?? b.input.notebook_path })
          }
        }
        break
      case 'result': {
        emit({
          type: 'usage',
          costUsd: m.total_cost_usd,
          inputTokens: m.usage?.input_tokens,
          outputTokens: m.usage?.output_tokens
        })
        s.running = false
        emit(m.is_error || m.subtype !== 'success'
          ? { type: 'status', status: 'error', error: 'errors' in m ? m.errors?.join('; ') : m.subtype }
          : { type: 'status', status: 'done' })
        break
      }
      case 'rate_limit_event': {
        const i = m.rate_limit_info
        if (i.utilization != null)
          emit({
            type: 'usage',
            limits: [{ name: i.rateLimitType ?? 'limit', remainingPercent: 100 - i.utilization * (i.utilization <= 1 ? 100 : 1), resetsAt: i.resetsAt }]
          })
        break
      }
    }
  }

  return {
    id: 'claude',
    permissionModes: ['supervised', 'auto-edit', 'full-access', 'plan', 'auto'],

    async listModels(configDir) {
      const ms = await probe(configDir, (q) => q.supportedModels())
      return ms.map((m) => ({ id: m.value, label: m.displayName, ...(m.supportsEffort ? { efforts: m.supportedEffortLevels ?? ['low', 'medium', 'high'] } : {}) }))
    },

    async start(opts: StartOptions, onEvent) {
      const input = inputChannel()
      const pending: Session['pending'] = new Map()
      const always = new Set<string>()
      let n = 0
      const options: Options = {
        cwd: opts.cwd,
        model: opts.model,
        ...(opts.effort ? { effort: opts.effort as Options['effort'] } : {}),
        pathToClaudeCodeExecutable: claudeExe(),
        resume: opts.resumeToken,
        env: envFor(opts.configDir, opts.env),
        permissionMode: SDK_MODES[opts.permissionMode],
        allowDangerouslySkipPermissions: opts.permissionMode === 'full-access',
        includePartialMessages: true,
        ...(getSettings().claudeChrome ? { extraArgs: { chrome: null } } : {}),
        // Without these the SDK ignores CLAUDE.md, skills, hooks and the Claude Code system prompt.
        settingSources: ['user', 'project', 'local'],
        systemPrompt: { type: 'preset', preset: 'claude_code', ...(getSettings().ghStack ? { append: 'You can use `gh stack` for stacked PRs.' } : {}) },
        canUseTool:
          (opts.permissionMode === 'supervised' || opts.permissionMode === 'plan') // plan: ExitPlanMode arrives as an approval card
            ? (name, inp) =>
                new Promise<PermissionResult>((resolve) => {
                  const key = approvalKey(name, inp)
                  if (always.has(key)) return resolve({ behavior: 'allow' })
                  const id = `appr-${opts.sessionId}-${++n}`
                  pending.set(id, { resolve, key })
                  onEvent({
                    type: 'approval_request',
                    id,
                    kind: name === 'Bash' ? 'command' : FILE_TOOLS.has(name) ? 'edit' : 'other',
                    summary: name === 'Bash' ? String(inp.command ?? name) : `${name} ${inp.file_path ?? ''}`.trim(),
                    detail: inp
                  })
                  onEvent({ type: 'status', status: 'needs-you' })
                })
            : undefined
      }
      const q = queryFn({ prompt: input.iter, options })
      const s: Session = { q, input, pending, always, resumeToken: opts.resumeToken }
      sessions.set(opts.sessionId, s)
      void (async () => {
        try {
          for await (const m of q) normalize(m, s, onEvent)
        } catch (e) {
          onEvent({ type: 'status', status: 'error', error: e instanceof Error ? e.message : String(e) })
        }
      })()
    },

    async send(id, text, images) {
      const s = get(id)
      // The SDK only queues a message sent mid-turn; interrupt first so it steers (partial work of that turn is dropped).
      if (s.running) await s.q.interrupt()
      s.running = true
      s.input.push(text, images)
    },

    async interrupt(id) {
      await get(id).q.interrupt()
    },

    async respondToApproval(id, approvalId, d: ApprovalDecision) {
      const s = get(id)
      const p = s.pending.get(approvalId)
      if (!p) throw new Error(`unknown approval ${approvalId}`)
      s.pending.delete(approvalId)
      const { resolve } = p
      if (d.allow && d.always) s.always.add(p.key)
      resolve(d.allow ? { behavior: 'allow' } : { behavior: 'deny', message: d.reason ?? 'Denied by user' })
    },

    getResumeToken: (id) => sessions.get(id)?.resumeToken,

    async getLimits(configDir) {
      const u = await probe(configDir, (q) => q.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET({ skipBehaviors: true }))
      const r = u.rate_limits
      if (!u.rate_limits_available || !r) return []
      const win = (name: string, w?: { utilization: number | null; resets_at: string | null } | null): LimitWindow[] =>
        w && w.utilization != null
          ? [{ name, remainingPercent: 100 - w.utilization, resetsAt: w.resets_at ? Date.parse(w.resets_at) / 1000 : undefined }]
          : []
      return [
        ...win('5-hour', r.five_hour),
        ...win('7-day', r.seven_day),
        ...(r.model_scoped ?? []).flatMap((m) => win(m.display_name, m))
      ]
    },

    async close(id) {
      const s = sessions.get(id)
      if (!s) return
      sessions.delete(id)
      for (const { resolve: r } of s.pending.values()) r({ behavior: 'deny', message: 'Session closed' })
      s.input.close()
      s.q.close()
    }
  }
}
