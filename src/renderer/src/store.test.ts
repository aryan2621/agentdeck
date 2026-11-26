// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import type { SessionInfo } from '../../shared/ipc'

const sendMessage = vi.fn().mockResolvedValue(undefined)
vi.stubGlobal('window', Object.assign(window, { api: { sendMessage, onEvent: vi.fn() } }))
const { actions, useStore } = await import('./store')

const s = (status: SessionInfo['status']): SessionInfo => ({ id: 's1', projectId: 'p1', provider: 'claude', permissionMode: 'supervised', status, title: 't', createdAt: 0 })
describe('queue', () => {
  it('sends one queued message when the turn ends, not before', () => {
    actions.upsertSession(s('working'))
    actions.setQueue('s1', ['a', 'b'])
    actions.upsertSession(s('working'))
    expect(sendMessage).not.toHaveBeenCalled()
    actions.upsertSession(s('idle'))
    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(sendMessage).toHaveBeenCalledWith('s1', 'a')
  })
  it('does not send when nothing is queued', () => {
    sendMessage.mockClear()
    actions.setQueue('s1', [])
    actions.upsertSession(s('working'))
    actions.upsertSession(s('idle'))
    expect(sendMessage).not.toHaveBeenCalled()
  })
})

describe('toasts', () => {
  it('keeps errors until dismissed', async () => {
    const { renderHook } = await import('@testing-library/react')
    const { result } = renderHook(() => useStore())
    const { act } = await import('@testing-library/react')
    act(() => actions.fail(new Error('boom')))
    expect(result.current.toasts.at(-1)).toMatchObject({ kind: 'error', text: 'boom' })
    act(() => actions.dismiss(result.current.toasts.at(-1)!.id))
    expect(result.current.toasts).toHaveLength(0)
  })
})
