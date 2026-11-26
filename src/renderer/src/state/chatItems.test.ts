import { describe, expect, it } from 'vitest'
import { buildItems, groupSteps } from './chatItems'

const m = (text: string, partial?: boolean) => ({ type: 'message' as const, role: 'assistant' as const, text, partial })

describe('buildItems', () => {
  it('appends partial deltas, then the final message replaces them', () => {
    expect(buildItems([m('Hel', true), m('lo', true)])).toEqual([m('Hello', true)])
    expect(buildItems([m('Hel', true), m('lo', true), m('Hello')])).toEqual([m('Hello')])
  })
})

describe('groupSteps', () => {
  const t = (id: string) => ({ type: 'tool_call' as const, id, name: 'Bash', input: {} })
  it('groups runs of 2+ steps and leaves singles and messages alone', () => {
    const rows = groupSteps([m('a'), t('1'), t('2'), m('b'), t('3')])
    expect(rows.map((r) => r.type)).toEqual(['message', 'steps', 'message', 'tool_call'])
  })
})
