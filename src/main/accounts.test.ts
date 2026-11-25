import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { copyTranscript } from './accounts'

describe('copyTranscript', () => {
  it('copies the matching transcript keeping its relative path', async () => {
    const a = mkdtempSync(join(tmpdir(), 'acc-')), b = mkdtempSync(join(tmpdir(), 'acc-'))
    mkdirSync(join(a, 'projects/-x'), { recursive: true })
    writeFileSync(join(a, 'projects/-x/abc-123.jsonl'), 'hi')
    expect(await copyTranscript('abc-123', a, b)).toBe(true)
    expect(readFileSync(join(b, 'projects/-x/abc-123.jsonl'), 'utf8')).toBe('hi')
    expect(await copyTranscript('nope', a, b)).toBe(false)
    await expect(copyTranscript('../x', a, b)).rejects.toThrow()
  })
})
