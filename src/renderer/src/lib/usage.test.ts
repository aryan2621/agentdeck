import { describe, expect, it } from 'vitest'
import { groupUsage, summarize } from './usage'

const DAY = 86_400_000
const row = (p: string, ago: number, cost: number, now: number) => ({ sessionId: p + ago, title: null, projectId: p, provider: 'claude', model: null, createdAt: now - ago * DAY, inputTokens: 10, outputTokens: 5, costUsd: cost })

describe('usage', () => {
  const now = 100 * DAY
  const rows = [row('a', 0, 1, now), row('a', 3, 2, now), row('b', 20, 4, now), row('b', 60, 8, now)]
  it('windows and buckets', () => {
    const s = summarize(rows, now)
    expect(s.week).toEqual({ tokens: 30, cost: 3, sessions: 2 })
    expect(s.month.cost).toBe(7); expect(s.all.cost).toBe(15)
    expect(s.daily).toHaveLength(30); expect(s.daily[29]).toBe(1); expect(s.daily[26]).toBe(2); expect(s.daily[9]).toBe(4)
  })
  it('groups by spend', () => {
    expect(groupUsage(rows, (r) => r.projectId).map((g) => [g.key, g.cost, g.sessions])).toEqual([['b', 12, 2], ['a', 3, 2]])
  })
})
