// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AllFiles } from './ReviewTabs'

const api = {
  listFiles: vi.fn().mockResolvedValue(['README.md', 'src/app.ts', 'src/lib/util.ts']),
  openFile: vi.fn().mockResolvedValue(undefined)
}
vi.stubGlobal('window', Object.assign(window, { api }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('expands folders and preserves opening a file in the default app', async () => {
  render(<AllFiles sessionId="s1" />)
  const folder = await screen.findByRole('button', { name: 'src' })
  expect(screen.queryByRole('button', { name: 'app.ts' })).toBeNull()
  await userEvent.click(folder)
  await userEvent.click(screen.getByRole('button', { name: 'app.ts' }))
  expect(api.openFile).toHaveBeenCalledWith('s1', 'src/app.ts')
  await userEvent.click(folder)
  expect(screen.queryByRole('button', { name: 'app.ts' })).toBeNull()
})

it('searches nested files and refreshes the list', async () => {
  render(<AllFiles sessionId="s1" />)
  await screen.findByText('README.md')
  await userEvent.click(screen.getByRole('button', { name: 'Filter files' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'File search' }), 'util')
  expect(screen.getByRole('button', { name: 'util.ts' })).toBeTruthy()
  expect(screen.queryByText('README.md')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Refresh files' }))
  expect(api.listFiles).toHaveBeenCalledTimes(2)
})
