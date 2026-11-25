import { PassThrough } from 'node:stream'
import { describe, expect, it } from 'vitest'
import type { AgentEvent } from '../../shared/types'
import { CodexAdapter, mapLimits } from './codex'

/** Fake `codex app-server`: records client lines, answers requests via `replies`. */
function fakePeer(replies: Record<string, unknown> = {}) {
  const stdout = new PassThrough()
  const received: any[] = []
  const envs: NodeJS.ProcessEnv[] = []
  const push = (m: object) => stdout.write(JSON.stringify(m) + '\n')
  const spawnFn = (env: NodeJS.ProcessEnv) => {
    envs.push(env)
    return {
      stdout,
      kill: () => {},
      stdin: {
        write: (s: string) => {
          const m = JSON.parse(s)
          received.push(m)
          if (m.id !== undefined && m.method in replies) setImmediate(() => push({ id: m.id, result: replies[m.method] }))
        },
      },
    }
  }
  return { spawnFn, received, envs, push }
}

const tick = () => new Promise((r) => setTimeout(r, 5))
const base = { initialize: {}, 'thread/start': { thread: { id: 'th1' } }, 'turn/start': { turn: { id: 'tu1' } } }

async function started(peer: ReturnType<typeof fakePeer>, mode: 'supervised' | 'full-access' = 'supervised') {
  const a = new CodexAdapter(peer.spawnFn)
  const events: AgentEvent[] = []
  await a.start({ sessionId: 's1', cwd: '/w', permissionMode: mode, configDir: '/acct' }, (e) => events.push(e))
  return { a, events }
}

describe('codex adapter', () => {
  it('handshakes, sets CODEX_HOME, maps permission mode on thread/start', async () => {
    const peer = fakePeer(base)
    const { a } = await started(peer, 'full-access')
    expect(peer.envs[0].CODEX_HOME).toBe('/acct')
    expect(peer.received.map((m) => m.method)).toEqual(['initialize', 'initialized', 'thread/start'])
    expect(peer.received[2].params).toMatchObject({ cwd: '/w', approvalPolicy: 'never', sandbox: 'danger-full-access' })
    expect(a.getResumeToken('s1')).toBe('th1')
  })

  it('normalizes notifications and interrupts the active turn', async () => {
    const peer = fakePeer({ ...base, 'turn/interrupt': {} })
    const { a, events } = await started(peer)
    await a.send('s1', 'hi')
    const n = (method: string, params: object) => peer.push({ method, params: { threadId: 'th1', ...params } })
    n('turn/started', { turn: { id: 'tu1' } })
    n('item/agentMessage/delta', { delta: 'he' })
    n('item/completed', { item: { type: 'commandExecution', id: 'c1', command: 'ls', cwd: '/w', aggregatedOutput: 'a' } })
    n('turn/diff/updated', { diff: 'diff --git a/x.ts b/x.ts\n+1\n' })
    n('thread/tokenUsage/updated', { tokenUsage: { total: { inputTokens: 3, outputTokens: 4 } } })
    n('turn/completed', { turn: { id: 'tu1', status: 'completed' } })
    n('error', { error: { message: 'boom' }, willRetry: false })
    await tick()
    expect(events).toEqual([
      { type: 'status', status: 'working' },
      { type: 'message', role: 'assistant', text: 'he', partial: true },
      { type: 'tool_call', id: 'c1', name: 'shell', input: { command: 'ls', cwd: '/w' }, output: 'a' },
      { type: 'file_change', path: 'x.ts', diff: 'diff --git a/x.ts b/x.ts\n+1\n' },
      { type: 'usage', inputTokens: 3, outputTokens: 4 },
      { type: 'status', status: 'done' },
      { type: 'status', status: 'error', error: 'boom' },
    ])
    n('turn/started', { turn: { id: 'tu2' } })
    await tick()
    await a.interrupt('s1')
    expect(peer.received.at(-1)).toMatchObject({ method: 'turn/interrupt', params: { threadId: 'th1', turnId: 'tu2' } })
  })

  it('round-trips an approval', async () => {
    const peer = fakePeer(base)
    const { a, events } = await started(peer)
    peer.push({ id: 77, method: 'item/commandExecution/requestApproval', params: { threadId: 'th1', command: 'rm -rf x' } })
    await tick()
    expect(events[0]).toMatchObject({ type: 'approval_request', id: '77', kind: 'command', summary: 'rm -rf x' })
    await a.respondToApproval('s1', '77', { allow: false })
    expect(peer.received.at(-1)).toEqual({ id: 77, result: { decision: 'decline' } })
  })

  it('maps rate limits and models', async () => {
    expect(mapLimits({ rateLimits: { primary: { usedPercent: 25, windowDurationMins: 300, resetsAt: 9 }, secondary: null, individualLimit: { remainingPercent: 40, resetsAt: 5 } } }))
      .toEqual([{ name: '5h', remainingPercent: 75, resetsAt: 9 }, { name: 'individual', remainingPercent: 40, resetsAt: 5 }])
    expect(mapLimits({ rateLimits: { primary: null, secondary: null, individualLimit: null } })).toEqual([])
    const peer = fakePeer({ initialize: {}, 'model/list': { data: [{ id: 'm', displayName: 'M', hidden: false }, { id: 'h', displayName: 'H', hidden: true }] } })
    expect(await new CodexAdapter(peer.spawnFn).listModels()).toEqual([{ id: 'm', label: 'M' }])
  })
})
