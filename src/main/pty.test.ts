import { describe, expect, it } from 'vitest'
import { PtyManager } from './pty'

describe('PtyManager', () => {
  it('runs a shell in cwd, streams output, replays backlog, closes', async () => {
    let out = ''
    const m = new PtyManager((_, d) => (out += d))
    expect(m.open('s', '/tmp')).toBe('')
    m.write('s', 'echo hi-$((1+2))\n')
    for (let i = 0; i < 50 && !out.includes('hi-3'); i++) await new Promise((r) => setTimeout(r, 100))
    expect(out).toContain('hi-3')
    expect(m.open('s', '/tmp')).toContain('hi-3')
    m.dispose()
  })
})
