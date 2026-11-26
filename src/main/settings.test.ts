import { describe, expect, it } from 'vitest'
import { sanitizeSettings } from './settings'

describe('sanitizeSettings', () => {
  it('keeps valid editable keys', () => {
    expect(sanitizeSettings({ theme: 'dark', cliPaths: { claude: '/usr/bin/claude', codex: '' } })).toEqual({ theme: 'dark', cliPaths: { claude: '/usr/bin/claude', codex: '' } })
  })
  it('drops trustedSetups, unknown keys, bad theme and relative cli paths', () => {
    const out = sanitizeSettings({ trustedSetups: { '/r': 'h' }, evil: 1, theme: 'neon', cliPaths: { claude: 'rel/claude' }, defaultProvider: 'nope' })
    expect(out).toEqual({ cliPaths: {} })
  })
  it('accepts a sane maxParallel only', () => {
    expect(sanitizeSettings({ maxParallel: 3 })).toEqual({ maxParallel: 3 })
    expect(sanitizeSettings({ maxParallel: -1 })).toEqual({})
    expect(sanitizeSettings({ maxParallel: '3' })).toEqual({})
  })
  it('tolerates non-objects', () => {
    expect(sanitizeSettings(null)).toEqual({})
  })
})
