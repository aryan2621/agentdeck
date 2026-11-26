import { describe, expect, it } from 'vitest'
import { parseEnv } from './types'

describe('parseEnv', () => {
  it('reads KEY=value lines, strips quotes, skips comments and bad names', () => {
    expect(parseEnv('A=1\n# c\nexport B="two words"\n9X=no\n\nC = x=y')).toEqual({ A: '1', B: 'two words', C: 'x=y' })
  })
})
