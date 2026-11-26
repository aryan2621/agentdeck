import type { AgentEvent } from '../../../shared/types'

const MAX = 20000

/** Chat text of a session as a first prompt for another agent; keeps the newest part if it is too long. */
export function forkPrompt(events: AgentEvent[], title: string): string {
  const lines = events
    .filter((e): e is Extract<AgentEvent, { type: 'message' }> => e.type === 'message' && !e.partial)
    .map((e) => `${e.role === 'user' ? 'User' : 'Assistant'}: ${e.text}`)
  let body = lines.join('\n\n')
  if (body.length > MAX) body = '[earlier messages omitted]\n\n' + body.slice(-MAX)
  return `Continue the work from a previous session ("${title}") that ran with another agent. Its conversation so far:\n\n${body}\n\nPick up from here.`
}

/** One-line preview of the newest final message, for the sidebar. */
export function lastText(events: AgentEvent[]): string {
  const m = events.findLast((e): e is Extract<AgentEvent, { type: 'message' }> => e.type === 'message' && !e.partial)
  return m ? m.text.replace(/\s+/g, ' ').trim().slice(0, 80) : ''
}
