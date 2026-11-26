import { expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../../../shared/types'
import { PROMPTS, withInstructions } from './prompts'

it('prepends general then specific instructions, skipping blanks', () => {
  const s = { ...DEFAULT_SETTINGS, repoActions: { p: { runMode: 'concurrent' as const, instructions: { general: ' G ', review: 'R' } } } }
  expect(withInstructions(s, 'p', 'review', 'base')).toBe('G\n\nR\n\nbase')
  expect(withInstructions(s, 'p', 'fixErrors', 'base')).toBe('G\n\nbase')
  expect(withInstructions(s, 'x', 'review', 'base')).toBe('base')
})

it('prepends Create PR and Branch rename instructions', () => {
  const s = { repoActions: { p: { instructions: { createPr: 'C', branchRename: 'B' } } } } as never
  expect(withInstructions(s, 'p', 'createPr', PROMPTS.createPr)).toBe(`C\n\n${PROMPTS.createPr}`)
  expect(withInstructions(s, 'p', 'branchRename', PROMPTS.branchRename)).toBe(`B\n\n${PROMPTS.branchRename}`)
})
