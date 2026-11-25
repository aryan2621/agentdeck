import { expect, it } from 'vitest'
import { forkPrompt } from './transcript'

it('builds a prompt from final messages only and truncates from the front', () => {
  const p = forkPrompt([
    { type: 'message', role: 'user', text: 'hi' },
    { type: 'message', role: 'assistant', text: 'he', partial: true },
    { type: 'message', role: 'assistant', text: 'hello' },
    { type: 'status', status: 'done' },
  ], 'T')
  expect(p).toContain('User: hi\n\nAssistant: hello')
  expect(p).not.toContain('he\n')
  const long = forkPrompt([{ type: 'message', role: 'user', text: 'x'.repeat(30000) }], 'T')
  expect(long).toContain('[earlier messages omitted]')
})
