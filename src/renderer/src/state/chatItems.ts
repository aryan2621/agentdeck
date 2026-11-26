import type { AgentEvent } from '../../../shared/types'

export type ChatEvent = Exclude<AgentEvent, { type: 'usage' | 'approval_decision' }> | (Extract<AgentEvent, { type: 'approval_request' }> & { allowed?: boolean })

/** Folds the raw log into display items: partial messages and repeated tool_call ids collapse into one. */
export function appendEvent(items: ChatEvent[], e: AgentEvent): ChatEvent[] {
  if (e.type === 'usage') return items
  if (e.type === 'approval_decision')
    return items.map((i) => (i.type === 'approval_request' && i.id === e.id ? { ...i, allowed: e.allow } : i))
  const last = items[items.length - 1]
  // Partials are deltas: they append to the previous partial; the final non-partial message replaces the whole run.
  if (e.type === 'message' && e.role === 'assistant' && last?.type === 'message' && last.role === 'assistant' && last.partial)
    return [...items.slice(0, -1), e.partial ? { ...e, text: last.text + e.text } : e]
  if (e.type === 'tool_call' && items.some((i) => i.type === 'tool_call' && i.id === e.id))
    return items.map((i) => (i.type === 'tool_call' && i.id === e.id ? e : i))
  return [...items, e]
}

export const buildItems = (events: AgentEvent[]): ChatEvent[] => events.reduce(appendEvent, [] as ChatEvent[])

export type Step = Extract<ChatEvent, { type: 'tool_call' | 'file_change' }>
export type Row = ChatEvent | { type: 'steps'; steps: Step[] }

/** Display-only: runs of 2+ consecutive tool_call/file_change items become one group; a single one stays as is. */
export function groupSteps(items: ChatEvent[]): Row[] {
  const out: Row[] = []
  let run: Step[] = []
  const flush = (): void => { if (run.length > 1) out.push({ type: 'steps', steps: run }); else out.push(...run); run = [] }
  for (const i of items) {
    if (i.type === 'tool_call' || i.type === 'file_change') run.push(i)
    else { flush(); out.push(i) }
  }
  flush()
  return out
}
