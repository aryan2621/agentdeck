// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ApprovalCard from './ApprovalCard'

const respond = vi.fn().mockResolvedValue(undefined)
vi.stubGlobal('window', Object.assign(window, { api: { respondToApproval: respond } }))
afterEach(() => { cleanup(); respond.mockClear() })

const card = (): ReturnType<typeof render> => render(<ApprovalCard sessionId="s1" id="a1" kind="Bash" summary="echo hi" />)

describe('ApprovalCard keyboard', () => {
  it('y approves; focus starts on the card, not on Approve', async () => {
    card()
    expect(screen.getByRole('group')).toBe(document.activeElement)
    await userEvent.keyboard('y')
    expect(respond).toHaveBeenCalledWith('s1', 'a1', { allow: true, always: false })
    await waitFor(() => expect(screen.getByText('Approved')).toBeTruthy())
  })
  it('n denies', async () => {
    card()
    await userEvent.keyboard('n')
    expect(respond).toHaveBeenCalledWith('s1', 'a1', { allow: false, always: false })
  })
  it('ignores y outside the card', async () => {
    render(<><input aria-label="x" /><ApprovalCard sessionId="s1" id="a1" kind="Bash" summary="echo hi" /></>)
    screen.getByLabelText('x').focus()
    await userEvent.keyboard('y')
    expect(respond).not.toHaveBeenCalled()
  })
  it('Escape does not deny, A (shift) always-allows, bare a does nothing', async () => {
    card()
    await userEvent.keyboard('{Escape}a')
    expect(respond).not.toHaveBeenCalled()
    cleanup(); card()
    await userEvent.keyboard('A')
    expect(respond).toHaveBeenCalledWith('s1', 'a1', { allow: true, always: true })
  })
  it('Always allow button approves with always', async () => {
    card()
    await userEvent.click(screen.getByRole('button', { name: /^Always allow/ }))
    expect(respond).toHaveBeenCalledWith('s1', 'a1', { allow: true, always: true })
  })
})
