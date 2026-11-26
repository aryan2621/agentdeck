import { describe, expect, it } from 'vitest'
import { fmtTokens, nextEffort, windowLeft } from './stats'

describe('stats', () => {
  it('formats tokens', () => { expect(fmtTokens(950)).toBe('950'); expect(fmtTokens(125600)).toBe('125.6k') })
  it('finds windows by provider naming', () => {
    const ws = [{ name: '5h', remainingPercent: 40.4 }, { name: 'weekly', remainingPercent: 90 }]
    expect(windowLeft(ws, '5h')).toBe(40); expect(windowLeft(ws, '7d')).toBe(90); expect(windowLeft([], '7d')).toBeUndefined()
  })
  it('cycles effort', () => {
    expect(nextEffort(['low', 'high'])).toBe('low'); expect(nextEffort(['low', 'high'], 'low')).toBe('high'); expect(nextEffort(['low', 'high'], 'high')).toBe('low')
  })
})
