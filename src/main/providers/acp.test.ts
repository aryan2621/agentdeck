import { PassThrough } from 'node:stream'
import { describe, expect, it } from 'vitest'
import type { AgentEvent, PermissionMode } from '../../shared/types'
import { AcpAdapter } from './acp'

const AGENT = { label: 'Fake', command: 'fake', args: ['acp'] }

/** Fake ACP agent: records client lines, answers requests via `replies`. */
function fakePeer(replies: Record<string, unknown> = {}) {
  const stdout = new PassThrough()
  const received: any[] = []
  const push = (m: object) => stdout.write(JSON.stringify({ jsonrpc: '2.0', ...m }) + '\n')
  const spawnFn = () => ({
    stdout,
    kill: () => {},
    stdin: {
      write: (s: string) => {
        const m = JSON.parse(s)
        received.push(m)
        if (m.id !== undefined && m.method in replies) setImmediate(() => push({ id: m.id, result: replies[m.method] }))
      },
    },
  })
  /** Answer the latest request for `method` by hand (replies not in `replies` are held). */
  const answer = (method: string, result: unknown) => push({ id: received.filter((m) => m.method === method).at(-1).id, result })
  return { spawnFn, received, push, answer }
}

const tick = () => new Promise((r) => setTimeout(r, 5))
const base = { initialize: { agentCapabilities: { loadSession: true } }, 'session/new': { sessionId: 'a1' } }
const upd = (update: object) => ({ method: 'session/update', params: { sessionId: 'a1', update } })

async function started(peer: ReturnType<typeof fakePeer>, mode: PermissionMode = 'supervised', resumeToken?: string) {
  const a = new AcpAdapter('opencode', AGENT, peer.spawnFn)
  const events: AgentEvent[] = []
  await a.start({ sessionId: 's1', cwd: '/w', permissionMode: mode, resumeToken }, (e) => events.push(e))
  return { a, events }
}

describe('acp adapter', () => {
  it('handshakes with jsonrpc 2.0, creates a session, streams delta partials then a final message and done', async () => {
    const peer = fakePeer(base)
    const { a, events } = await started(peer)
    expect(peer.received.map((m) => m.method)).toEqual(['initialize', 'session/new'])
    expect(peer.received[0].jsonrpc).toBe('2.0')
    expect(a.getResumeToken('s1')).toBe('a1')
    const turn = a.send('s1', 'hi')
    await tick()
    peer.push(upd({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hel' } }))
    peer.push(upd({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'lo' } }))
    peer.answer('session/prompt', { stopReason: 'end_turn' })
    await turn
    expect(events).toEqual([
      { type: 'status', status: 'working' },
      { type: 'message', role: 'assistant', text: 'Hel', partial: true },
      { type: 'message', role: 'assistant', text: 'lo', partial: true },
      { type: 'message', role: 'assistant', text: 'Hello' },
      { type: 'status', status: 'done' },
    ])
  })

  it('maps tool calls and diffs', async () => {
    const peer = fakePeer(base)
    const { events } = await started(peer)
    peer.push(upd({ sessionUpdate: 'tool_call', toolCallId: 't1', title: 'Edit a.ts', kind: 'edit', rawInput: { p: 1 } }))
    peer.push(upd({ sessionUpdate: 'tool_call_update', toolCallId: 't1', content: [{ type: 'diff', path: 'a.ts', newText: 'x' }] }))
    await tick()
    expect(events).toContainEqual({ type: 'tool_call', id: 't1', name: 'Edit a.ts', input: { p: 1 }, output: undefined })
    expect(events).toContainEqual({ type: 'file_change', path: 'a.ts', diff: 'x' })
  })

  const perm = { method: 'session/request_permission', id: 7, params: { toolCall: { title: 'rm -rf', kind: 'execute' }, options: [{ optionId: 'y', kind: 'allow_once' }, { optionId: 'n', kind: 'reject_once' }] } }

  it('supervised: permission becomes an approval card; decision picks the right option', async () => {
    const peer = fakePeer(base)
    const { a, events } = await started(peer)
    peer.push(perm)
    await tick()
    expect(events).toContainEqual(expect.objectContaining({ type: 'approval_request', id: '7', kind: 'command', summary: 'rm -rf' }))
    await a.respondToApproval('s1', '7', { allow: false })
    expect(peer.received.at(-1)).toMatchObject({ id: 7, result: { outcome: { outcome: 'selected', optionId: 'n' } } })
  })

  it('full-access: permission is answered without a card', async () => {
    const peer = fakePeer(base)
    const { events } = await started(peer, 'full-access')
    peer.push(perm)
    await tick()
    expect(events.some((e) => e.type === 'approval_request')).toBe(false)
    expect(peer.received.at(-1)).toMatchObject({ id: 7, result: { outcome: { outcome: 'selected', optionId: 'y' } } })
  })

  it('session/load drops replayed history and keeps the resume token', async () => {
    const peer = fakePeer(base)
    const a = new AcpAdapter('opencode', AGENT, peer.spawnFn)
    const events: AgentEvent[] = []
    const p = a.start({ sessionId: 's1', cwd: '/w', permissionMode: 'supervised', resumeToken: 'old' }, (e) => events.push(e))
    await tick()
    peer.push(upd({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'replay' } }))
    peer.answer('session/load', null)
    await p
    expect(events).toEqual([])
    expect(peer.received.map((m) => m.method)).toContain('session/load')
    expect(a.getResumeToken('s1')).toBe('old')
  })

  it('answers unknown server requests with an error so the turn does not hang', async () => {
    const peer = fakePeer(base)
    await started(peer)
    peer.push({ method: 'fs/read_text_file', id: 9, params: {} })
    await tick()
    expect(peer.received.at(-1)).toMatchObject({ id: 9, error: { message: expect.stringContaining('fs/read_text_file') } })
  })

  it('cancelled stop reason goes idle; interrupt sends session/cancel', async () => {
    const peer = fakePeer(base)
    const { a, events } = await started(peer)
    const turn = a.send('s1', 'x')
    await tick()
    peer.answer('session/prompt', { stopReason: 'cancelled' })
    await turn
    expect(events.at(-1)).toEqual({ type: 'status', status: 'idle' })
    await a.interrupt('s1')
    expect(peer.received.at(-1)).toMatchObject({ method: 'session/cancel', params: { sessionId: 'a1' } })
  })
})
