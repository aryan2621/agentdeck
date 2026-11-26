import type { UsageRow } from '../../../main/db'

const DAY = 86_400_000
export interface Tally { tokens: number; cost: number; sessions: number }

const tally = (rows: UsageRow[]): Tally => ({ tokens: rows.reduce((n, r) => n + r.inputTokens + r.outputTokens, 0), cost: rows.reduce((n, r) => n + r.costUsd, 0), sessions: rows.length })

/** Group rows by `key`, biggest spender first. */
export const groupUsage = (rows: UsageRow[], key: (r: UsageRow) => string): (Tally & { key: string })[] => {
  const m = new Map<string, UsageRow[]>()
  rows.forEach((r) => m.set(key(r), [...(m.get(key(r)) ?? []), r]))
  return [...m].map(([k, list]) => ({ key: k, ...tally(list) })).sort((a, b) => b.cost - a.cost)
}

/**
 * Totals overall and for the last 7/30 days, plus one cost bucket per day (oldest first).
 * shortcut: usage is stored as one running total per session, so it is dated by the session's creation day, not by when tokens were spent.
 */
export function summarize(rows: UsageRow[], now = Date.now(), days = 30): { all: Tally; week: Tally; month: Tally; daily: number[] } {
  const since = (d: number): UsageRow[] => rows.filter((r) => r.createdAt >= now - d * DAY)
  const daily = Array<number>(days).fill(0)
  rows.forEach((r) => { const i = days - 1 - Math.floor((now - r.createdAt) / DAY); if (i >= 0 && i < days) daily[i] += r.costUsd })
  return { all: tally(rows), week: tally(since(7)), month: tally(since(30)), daily }
}
