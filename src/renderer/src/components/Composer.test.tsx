// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Composer from './Composer'
import { actions } from '../store'
import type { SessionInfo } from '../../../shared/ipc'

const api = {
  sendMessage: vi.fn().mockResolvedValue(undefined),
  interrupt: vi.fn().mockResolvedValue(undefined),
  listModels: vi.fn().mockResolvedValue([]),
  providerModes: vi.fn().mockResolvedValue(['default']),
  listCheckpoints: vi.fn().mockResolvedValue([]),
  listFiles: vi.fn().mockResolvedValue([]),
  onEvent: vi.fn(),
}
vi.stubGlobal('window', Object.assign(window, { api }))
afterEach(() => { cleanup(); Object.values(api).forEach((f) => f.mockClear()); actions.setQueue('s1', []) })

const session = (status: SessionInfo['status']): SessionInfo => ({ id: 's1', projectId: 'p1', provider: 'claude', permissionMode: 'supervised', status, title: 'T', createdAt: 0 })
const box = (): HTMLElement => screen.getByPlaceholderText('Message T')

describe('Composer', () => {
  it('sends on Enter when idle', async () => {
    render(<Composer session={session('idle')} />)
    await userEvent.type(box(), 'hello{Enter}')
    expect(api.sendMessage).toHaveBeenCalledWith('s1', 'hello', undefined)
  })
  it('queues instead of sending while a turn is running', async () => {
    render(<Composer session={session('working')} />)
    await userEvent.type(box(), 'later{Enter}')
    expect(api.sendMessage).not.toHaveBeenCalled()
  })
  it('/stop interrupts and is not sent as a message', async () => {
    render(<Composer session={session('working')} />)
    await userEvent.type(box(), '/stop{Enter}')
    expect(api.interrupt).toHaveBeenCalledWith('s1')
    expect(api.sendMessage).not.toHaveBeenCalled()
  })
  it('ignores empty input', async () => {
    render(<Composer session={session('idle')} />)
    await userEvent.type(box(), '   {Enter}')
    expect(api.sendMessage).not.toHaveBeenCalled()
  })
})
