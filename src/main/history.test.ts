import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { listHistory, listMcp, readHistory } from './history'

const jl = (...o: object[]): string => o.map((x) => JSON.stringify(x)).join('\n')

it('lists and reads Claude and Codex history for a project, and lists MCP servers', async () => {
  const home = mkdtempSync(join(tmpdir(), 'ad-home-'))
  const proj = '/w/my.proj'
  const cdir = join(home, '.claude', 'projects', '-w-my-proj')
  mkdirSync(cdir, { recursive: true })
  writeFileSync(join(cdir, 'c1.jsonl'), jl(
    { type: 'user', message: { role: 'user', content: 'fix bug' } },
    { type: 'user', message: { role: 'user', content: [{ type: 'tool_result' }] } },
    { type: 'user', isMeta: true, message: { role: 'user', content: 'meta' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use' }, { type: 'text', text: 'done' }] } },
  ))
  const xdir = join(home, '.codex', 'sessions', '2026', '01')
  mkdirSync(xdir, { recursive: true })
  const roll = (cwd: string) => jl(
    { type: 'session_meta', payload: { id: 'x1', cwd } },
    { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '<environment_context>' }] } },
    { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'hello codex' }] } },
  )
  writeFileSync(join(xdir, 'rollout-a.jsonl'), roll(proj))
  writeFileSync(join(xdir, 'rollout-b.jsonl'), roll('/other'))
  writeFileSync(join(home, '.claude.json'), JSON.stringify({ mcpServers: { g: { command: 'npx', args: ['gm'], env: { K: 'secret' } } }, projects: { [proj]: { mcpServers: { p: { url: 'http://x' } } } } }))
  writeFileSync(join(home, '.codex', 'config.toml'), 'model = "x"\n[mcp_servers.fs]\ncommand = "fsrv"\n[other]\ncommand = "no"\n')

  const h = await listHistory(proj, home)
  expect(h.map((i) => [i.provider, i.id, i.title]).sort()).toEqual([['claude', 'c1', 'fix bug'], ['codex', 'x1', 'hello codex']])
  expect(await readHistory(proj, 'claude', 'c1', home)).toEqual([
    { type: 'message', role: 'user', text: 'fix bug' }, { type: 'message', role: 'assistant', text: 'done' }])
  expect(await listMcp(proj, home)).toEqual([
    { provider: 'claude', scope: 'user', name: 'g', command: 'npx gm' },
    { provider: 'claude', scope: 'project', name: 'p', command: 'http://x' },
    { provider: 'codex', scope: 'user', name: 'fs', command: 'fsrv' }])
})
