import { readdir, readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AgentEvent } from '../shared/types'

export interface HistoryItem { provider: 'claude' | 'codex'; id: string; title: string; mtime: number }
export interface McpServer { provider: 'claude' | 'codex'; scope: 'user' | 'project'; name: string; command: string }

const lines = (s: string): any[] => s.split('\n').flatMap((l) => { try { return [JSON.parse(l)] } catch { return [] } })
const msg = (role: 'user' | 'assistant', text: string): AgentEvent => ({ type: 'message', role, text })
// Injected context (<environment_context>, <command-name>, ...) is not something the user typed.
const real = (t: string): boolean => !!t.trim() && !t.trimStart().startsWith('<')

/** Claude Code stores a project's transcripts in a folder named after its path with non-alphanumerics as '-'. */
const claudeDir = (home: string, projectPath: string): string => join(home, '.claude', 'projects', projectPath.replace(/[^a-zA-Z0-9]/g, '-'))

export function parseClaude(text: string): AgentEvent[] {
  return lines(text).flatMap((m): AgentEvent[] => {
    if (m.isSidechain || m.isMeta || !m.message) return []
    const c = m.message.content
    if (m.type === 'user' && typeof c === 'string') return real(c) ? [msg('user', c)] : []
    if (m.type === 'assistant' && Array.isArray(c))
      return c.filter((b: any) => b.type === 'text' && real(b.text)).map((b: any) => msg('assistant', b.text))
    return []
  })
}

// shortcut: Codex rollout format is from memory of ~/.codex/sessions/**/rollout-*.jsonl and unverified live; newer Codex
// builds keep threads in state_*.sqlite instead, which this does not read. Verify at the live test.
export function parseCodex(text: string): { cwd?: string; id?: string; events: AgentEvent[] } {
  let cwd: string | undefined, id: string | undefined
  const events = lines(text).flatMap((m): AgentEvent[] => {
    if (m.type === 'session_meta') { cwd = m.payload?.cwd; id = m.payload?.id; return [] }
    const p = m.payload
    if (m.type !== 'response_item' || p?.type !== 'message' || (p.role !== 'user' && p.role !== 'assistant')) return []
    const t = (p.content ?? []).map((b: any) => b.text ?? '').join('')
    return real(t) ? [msg(p.role, t)] : []
  })
  return { cwd, id, events }
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walk(p)))
    else if (e.name.endsWith('.jsonl')) out.push(p)
  }
  return out
}

const title = (events: AgentEvent[]): string => {
  const f = events.find((e) => e.type === 'message' && e.role === 'user')
  return f && f.type === 'message' ? f.text.slice(0, 80) : 'Untitled'
}

async function files(home: string, projectPath: string): Promise<(HistoryItem & { file: string; events: AgentEvent[] })[]> {
  const out: (HistoryItem & { file: string; events: AgentEvent[] })[] = []
  for (const file of await walk(claudeDir(home, projectPath))) {
    const events = parseClaude(await readFile(file, 'utf8'))
    if (events.length) out.push({ provider: 'claude', id: file.replace(/^.*\/|\.jsonl$/g, ''), title: title(events), mtime: (await stat(file)).mtimeMs, file, events })
  }
  for (const file of (await walk(join(home, '.codex', 'sessions'))).filter((f) => f.includes('rollout-'))) {
    const { cwd, id, events } = parseCodex(await readFile(file, 'utf8'))
    if (id && cwd === projectPath && events.length) out.push({ provider: 'codex', id, title: title(events), mtime: (await stat(file)).mtimeMs, file, events })
  }
  return out.sort((a, b) => b.mtime - a.mtime)
}

export async function listHistory(projectPath: string, home = homedir()): Promise<HistoryItem[]> {
  return (await files(home, projectPath)).map(({ file: _f, events: _e, ...item }) => item)
}

export async function readHistory(projectPath: string, provider: string, id: string, home = homedir()): Promise<AgentEvent[]> {
  const f = (await files(home, projectPath)).find((x) => x.provider === provider && x.id === id)
  if (!f) throw new Error('history entry not found')
  return f.events
}

/** MCP servers configured for the provider CLIs: names and launch command only (env/headers may hold secrets). */
export async function listMcp(projectPath: string, home = homedir()): Promise<McpServer[]> {
  const out: McpServer[] = []
  const desc = (s: any): string => [s?.command, ...(s?.args ?? [])].filter(Boolean).join(' ') || s?.url || ''
  try {
    const cfg = JSON.parse(await readFile(join(home, '.claude.json'), 'utf8'))
    for (const [name, s] of Object.entries(cfg.mcpServers ?? {})) out.push({ provider: 'claude', scope: 'user', name, command: desc(s) })
    for (const [name, s] of Object.entries(cfg.projects?.[projectPath]?.mcpServers ?? {})) out.push({ provider: 'claude', scope: 'project', name, command: desc(s) })
  } catch { /* no config */ }
  try {
    // shortcut: line scan instead of a TOML parser; handles [mcp_servers.name] with command/url only.
    let cur: McpServer | undefined
    for (const l of (await readFile(join(home, '.codex', 'config.toml'), 'utf8')).split('\n')) {
      const h = /^\[mcp_servers\.([^.\]]+)\]\s*$/.exec(l.trim())
      if (h) out.push((cur = { provider: 'codex', scope: 'user', name: h[1].replace(/"/g, ''), command: '' }))
      else if (l.trim().startsWith('[')) cur = undefined
      else if (cur) { const kv = /^(command|url)\s*=\s*"(.*)"\s*$/.exec(l.trim()); if (kv && !cur.command) cur.command = kv[2] }
    }
  } catch { /* no config */ }
  return out
}
