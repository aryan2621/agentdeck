import { describe, it, expect } from 'vitest'
import type { Options, PermissionResult } from '@anthropic-ai/claude-agent-sdk'
import { createClaudeProvider, type QueryFn } from './claude'
import type { AgentEvent } from '../../shared/types'

// Fake query: yields scripted messages, then waits for close().
function fake(script: (o: Options) => any[], extra: Record<string, any> = {}) {
  const calls: { options?: Options } = {}
  const state = { interrupted: false, closed: false }
  const fn = ((p: any) => {
    calls.options = p.options
    const msgs = script(p.options)
    return {
      async *[Symbol.asyncIterator]() {
        for (const m of msgs) yield typeof m === 'function' ? await m() : m
      },
      interrupt: async () => void (state.interrupted = true),
      close: () => void (state.closed = true),
      ...extra
    }
  }) as unknown as QueryFn
  return { fn, calls, state }
}
const tick = () => new Promise((r) => setTimeout(r, 10))
const start = async (p: ReturnType<typeof createClaudeProvider>, mode: any = 'full-access') => {
  const events: AgentEvent[] = []
  await p.start({ sessionId: 's1', cwd: '/w', permissionMode: mode, configDir: '/cfg', model: 'm', resumeToken: 'r0' }, (e) => events.push(e))
  await tick()
  return events
}

describe('claude provider', () => {
  it('normalizes messages and passes options', async () => {
    const f = fake(() => [
      { type: 'system', session_id: 'sdk-1' },
      { type: 'stream_event', session_id: 'sdk-1', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hi' } } },
      { type: 'assistant', session_id: 'sdk-1', message: { content: [
        { type: 'text', text: 'hello' },
        { type: 'tool_use', id: 't1', name: 'Edit', input: { file_path: '/w/a.ts' } }
      ] } },
      { type: 'rate_limit_event', session_id: 'sdk-1', rate_limit_info: { status: 'allowed', rateLimitType: 'five_hour', utilization: 30, resetsAt: 5 } },
      { type: 'result', subtype: 'success', is_error: false, session_id: 'sdk-1', total_cost_usd: 0.5, usage: { input_tokens: 3, output_tokens: 4 } }
    ])
    const p = createClaudeProvider(f.fn)
    const ev = await start(p)
    expect(ev).toEqual([
      { type: 'message', role: 'assistant', text: 'hi', partial: true },
      { type: 'message', role: 'assistant', text: 'hello' },
      { type: 'tool_call', id: 't1', name: 'Edit', input: { file_path: '/w/a.ts' } },
      { type: 'file_change', path: '/w/a.ts' },
      { type: 'usage', limits: [{ name: 'five_hour', remainingPercent: 70, resetsAt: 5 }] },
      { type: 'usage', costUsd: 0.5, inputTokens: 3, outputTokens: 4 },
      { type: 'status', status: 'done' }
    ])
    expect(p.getResumeToken('s1')).toBe('sdk-1')
    expect(f.calls.options).toMatchObject({ cwd: '/w', model: 'm', resume: 'r0', permissionMode: 'bypassPermissions' })
    expect(f.calls.options?.env?.CLAUDE_CONFIG_DIR).toBe('/cfg')
  })

  it('passes project env vars to the agent process', async () => {
    const f = fake(() => [])
    await createClaudeProvider(f.fn).start({ sessionId: 's2', cwd: '/w', permissionMode: 'supervised', env: { FOO_PROJ: 'bar' } }, () => {})
    expect(f.calls.options?.env?.FOO_PROJ).toBe('bar')
  })

  it('emits error status on error result', async () => {
    const f = fake(() => [{ type: 'result', subtype: 'error_during_execution', is_error: true, session_id: 'x', total_cost_usd: 0, usage: {}, errors: ['boom'] }])
    const ev = await start(createClaudeProvider(f.fn))
    expect(ev.at(-1)).toEqual({ type: 'status', status: 'error', error: 'boom' })
  })

  for (const allow of [true, false]) {
    it(`approval round trip (${allow ? 'allow' : 'deny'})`, async () => {
      let result: PermissionResult | null | undefined
      const f = fake((o) => [
        async () => {
          result = await o.canUseTool!('Bash', { command: 'ls' }, { signal: new AbortController().signal } as any)
          return { type: 'system', session_id: 'z' }
        }
      ])
      const p = createClaudeProvider(f.fn)
      const ev = await start(p, 'supervised')
      expect(f.calls.options?.permissionMode).toBe('default')
      const req = ev.find((e) => e.type === 'approval_request') as any
      expect(req).toMatchObject({ kind: 'command', summary: 'ls' })
      await p.respondToApproval('s1', req.id, { allow, reason: 'no' })
      await tick()
      expect(result).toMatchObject(allow ? { behavior: 'allow' } : { behavior: 'deny', message: 'no' })
    })
  }

  it('maps auto-edit and interrupts', async () => {
    const f = fake(() => [])
    const p = createClaudeProvider(f.fn)
    await start(p, 'auto-edit')
    expect(f.calls.options?.permissionMode).toBe('acceptEdits')
    expect(f.calls.options?.canUseTool).toBeUndefined()
    await p.interrupt('s1')
    expect(f.state.interrupted).toBe(true)
    await p.close('s1')
    expect(f.state.closed).toBe(true)
  })

  it('getLimits maps windows; [] for API-key logins', async () => {
    const mk = (u: any) => createClaudeProvider(fake(() => [], { usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET: async () => u }).fn)
    expect(await mk({ rate_limits_available: false, rate_limits: null }).getLimits()).toEqual([])
    const out = await mk({ rate_limits_available: true, rate_limits: {
      five_hour: { utilization: 20, resets_at: '1970-01-01T00:01:00Z' }, seven_day: { utilization: 50, resets_at: null }
    } }).getLimits()
    expect(out).toEqual([
      { name: '5-hour', remainingPercent: 80, resetsAt: 60 },
      { name: '7-day', remainingPercent: 50, resetsAt: undefined }
    ])
  })
})
