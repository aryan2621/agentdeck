import { describe, expect, it } from 'vitest'
import { applyOrder, moveInOrder } from './order'

describe('session order', () => {
  it('sorts listed ids first, unlisted keep their order', () => {
    expect(applyOrder([{ id: 'a' }, { id: 'b' }, { id: 'c' }], ['c', 'a']).map((s) => s.id)).toEqual(['c', 'a', 'b'])
  })
  it('moves within bounds only', () => {
    expect(moveInOrder(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(moveInOrder(['a', 'b'], 'a', -1)).toEqual(['a', 'b'])
  })
})
