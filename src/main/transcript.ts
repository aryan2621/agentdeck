import type { AgentEvent } from '../shared/types'

/** Readable Markdown of a session: final messages, tool calls and file changes. Streaming partials are skipped. */
export function transcriptMarkdown(title: string, events: AgentEvent[]): string {
  const body = events.flatMap((e) => {
    if (e.type === 'message' && !e.partial) return [`## ${e.role === 'user' ? 'You' : 'Agent'}\n\n${e.text}`]
    if (e.type === 'tool_call') return [`- Tool \`${e.name}\``]
    if (e.type === 'file_change') return [`- Changed \`${e.path}\``]
    return []
  })
  return `# ${title}\n\n${body.join('\n\n')}\n`
}
