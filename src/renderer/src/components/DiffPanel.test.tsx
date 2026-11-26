// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DiffPanel from './DiffPanel'

const diff = 'diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-old\n+new\n'
const api = {
  sessionDiff: vi.fn().mockResolvedValue({ diff, files: [{ path: 'src/a.ts', status: 'M', additions: 1, deletions: 1 }] }),
  branchStatus: vi.fn().mockResolvedValue({ dirty: true, ahead: 0 }),
  checkTool: vi.fn().mockResolvedValue(true),
  revertFile: vi.fn().mockResolvedValue(undefined),
  revertHunk: vi.fn().mockResolvedValue(undefined),
  openFile: vi.fn().mockResolvedValue(undefined),
}
vi.stubGlobal('window', Object.assign(window, { api }))
afterEach(() => { cleanup(); Object.values(api).forEach((f) => f.mockClear()) })

describe('DiffPanel', () => {
  it('lists changed files and loads the uncommitted diff', async () => {
    render(<DiffPanel sessionId="s1" status="idle" />)
    await waitFor(() => expect(screen.getByText('a.ts')).toBeTruthy())
    expect(api.sessionDiff).toHaveBeenCalledWith('s1', 'uncommitted')
  })
  it('reverts a file only after confirming', async () => {
    render(<DiffPanel sessionId="s1" status="idle" />)
    await userEvent.click(await screen.findByText('a.ts'))
    await userEvent.click(screen.getByRole('button', { name: 'Revert file' }))
    expect(api.revertFile).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Revert' }))
    await waitFor(() => expect(api.revertFile).toHaveBeenCalledWith('s1', 'src/a.ts'))
  })
  it('reverts one hunk by index', async () => {
    render(<DiffPanel sessionId="s1" status="idle" />)
    await userEvent.click(await screen.findByText('a.ts'))
    await userEvent.click(screen.getByRole('button', { name: 'Revert hunk 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Revert' }))
    await waitFor(() => expect(api.revertHunk).toHaveBeenCalledWith('s1', 'src/a.ts', 0))
    expect(api.revertFile).not.toHaveBeenCalled()
  })
  it('disables Commit until there is a message', async () => {
    render(<DiffPanel sessionId="s1" status="idle" />)
    const btn = await screen.findByRole('button', { name: 'Commit' })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })
})
