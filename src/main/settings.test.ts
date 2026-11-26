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
  it('keeps the autoMode flag only when boolean', () => {
    expect(sanitizeSettings({ autoMode: true })).toEqual({ autoMode: true })
    expect(sanitizeSettings({ autoMode: 'yes' })).toEqual({})
  })
  it('accepts a sane maxParallel only', () => {
    expect(sanitizeSettings({ maxParallel: 3 })).toEqual({ maxParallel: 3 })
    expect(sanitizeSettings({ maxParallel: -1 })).toEqual({})
    expect(sanitizeSettings({ maxParallel: '3' })).toEqual({})
  })
  it('sanitizes repoPrefs and hiddenProjects', () => {
    const out = sanitizeSettings({ repoPrefs: { a: { previews: [{ name: 'x', url: 'http://localhost:$AGENTDECK_PORT' }, { name: 'bad', url: 'javascript:1' }], setUpstream: 'yes' } }, hiddenProjects: ['a', 3] })
    expect(out.repoPrefs?.a).toEqual({ previews: [{ name: 'x', url: 'http://localhost:$AGENTDECK_PORT' }], plainLocalhost: false, archiveOnMerge: false, setUpstream: true })
    expect(out.hiddenProjects).toEqual(['a'])
  })
  it('tolerates non-objects', () => {
    expect(sanitizeSettings(null)).toEqual({})
  })
  it('validates the Git, Account, Agents and typography settings', () => {
    expect(sanitizeSettings({ branchPrefixMode: 'none', ghStack: false, codexApprovals: 'never', monoFont: 'menlo', terminalFont: 'Fira Code', terminalFontSize: 14, markdownStyle: 'serif' }))
      .toEqual({ branchPrefixMode: 'none', ghStack: false, codexApprovals: 'never', monoFont: 'menlo', terminalFont: 'Fira Code', terminalFontSize: 14, markdownStyle: 'serif' })
    expect(sanitizeSettings({ branchPrefixMode: 'x', codexApprovals: 'y', monoFont: 'comic', terminalFont: 'a;b', terminalFontSize: 99, ghStack: 'yes' })).toEqual({})
  })
})
