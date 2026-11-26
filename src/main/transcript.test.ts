import { describe, expect, it } from 'vitest'
import { transcriptMarkdown } from './transcript'

describe('transcriptMarkdown', () => {
  it('keeps final messages, tools and file changes; drops partials', () => {
    const md = transcriptMarkdown('T', [
      { type: 'message', role: 'user', text: 'hi' },
      { type: 'message', role: 'assistant', text: 'he', partial: true },
      { type: 'message', role: 'assistant', text: 'hello' },
      { type: 'tool_call', id: '1', name: 'Bash', input: {} },
      { type: 'file_change', path: 'a.ts' },
    ])
    expect(md).toBe('# T\n\n## You\n\nhi\n\n## Agent\n\nhello\n\n- Tool `Bash`\n\n- Changed `a.ts`\n')
  })
})
