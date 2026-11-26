// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FileTab from './FileTab'
import type { DiffResult } from '../../../main/git'

vi.mock('./Markdown', () => ({ useTokens: () => null }))
const file = (path: string): DiffResult['files'][number] => ({
  path,
  status: 'M',
  additions: 1,
  deletions: 1
})
const patch = (path: string): string =>
  `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-before\n+after\n`
const api = { sessionDiff: vi.fn(), openFile: vi.fn() }
vi.stubGlobal('window', Object.assign(window, { api }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  localStorage.clear()
})

it('reviews committed branch changes using the selected scope', async () => {
  api.sessionDiff.mockImplementation((_id: string, scope: string) =>
    Promise.resolve(
      scope === 'branch' ? { diff: patch('a.ts'), files: [file('a.ts')] } : { diff: '', files: [] }
    )
  )
  const view = render(<FileTab sessionId="s1" path="a.ts" status="done" scope="branch" />)
  await screen.findByText('after')
  expect(api.sessionDiff).toHaveBeenLastCalledWith('s1', 'branch')
  view.rerender(<FileTab sessionId="s1" path="a.ts" status="done" scope="uncommitted" />)
  await screen.findByText('No uncommitted changes in this file.')
  expect(api.sessionDiff).toHaveBeenLastCalledWith('s1', 'uncommitted')
})

it('reviews all changed files, switches layout, and remembers Viewed independently', async () => {
  api.sessionDiff.mockResolvedValue({
    diff: patch('a.ts') + patch('b.ts'),
    files: [file('a.ts'), file('b.ts')]
  })
  render(<FileTab sessionId="s1" status="done" />)
  const first = await screen.findByRole('checkbox', { name: 'Viewed a.ts' })
  await userEvent.click(first)
  expect(localStorage.getItem('viewed:s1:a.ts')).toBe('1')
  expect(screen.getByRole('checkbox', { name: 'Viewed b.ts' }).getAttribute('aria-checked')).toBe(
    'false'
  )
  await userEvent.click(screen.getByRole('button', { name: 'Split diff' }))
  await waitFor(() =>
    expect(
      screen.getAllByLabelText('Split diff').filter((el) => el.tagName === 'PRE')
    ).toHaveLength(2)
  )
  expect(screen.getAllByText('before')).toHaveLength(2)
  expect(screen.getAllByText('after')).toHaveLength(2)
})
