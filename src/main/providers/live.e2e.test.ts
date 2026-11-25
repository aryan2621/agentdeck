// Live smoke test against the real CLIs. Opt-in: LIVE=1 npx vitest run src/main/providers/live.e2e.test.ts
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AgentEvent, ProviderAdapter } from '../../shared/types'
import { CodexAdapter } from './codex'
import { createClaudeProvider } from './claude'

const live = process.env.LIVE ? describe : describe.skip

function scratchRepo(): string {
  const d = mkdtempSync(join(tmpdir(), 'agentdeck-live-'))
  execFileSync('git', ['init', '-q'], { cwd: d })
  writeFileSync(join(d, 'hello.txt'), 'hello\n')
  return d
}

async function run(a: ProviderAdapter, mode: 'supervised' | 'full-access', prompt: string) {
  const cwd = scratchRepo()
  const events: AgentEvent[] = []
  let done: () => void
  const idle = new Promise<void>((r) => (done = r))
  await a.start({ sessionId: 'live', cwd, permissionMode: mode }, (e) => {
    events.push(e)
    if (e.type === 'approval_request') void a.respondToApproval('live', e.id, { allow: true })
    if (e.type === 'status' && (e.status === 'idle' || e.status === 'done' || e.status === 'error')) done()
  })
  await a.send('live', prompt)
  await Promise.race([idle, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout: ' + JSON.stringify(events).slice(0, 1500))), 90_000))])
  const resume = a.getResumeToken('live')
  await a.close('live')
  return { events, resume }
}

live('live CLIs', () => {
  for (const [name, make] of [['claude', () => createClaudeProvider()], ['codex', () => new CodexAdapter()]] as const) {
    it(`${name}: streams, edits a file, reports usage/resume token`, async () => {
      const { events, resume } = await run(make(), 'full-access', 'Append the line "world" to hello.txt, then say done.')
      console.log(name, events.map((e) => e.type + (e.type === 'status' ? ':' + (e as any).status : '')).join(' '))
      expect(events.some((e) => e.type === 'message')).toBe(true)
      expect(events.some((e) => e.type === 'file_change' || e.type === 'tool_call')).toBe(true)
      expect(resume).toBeTruthy()
    }, 120_000)
  }
})
