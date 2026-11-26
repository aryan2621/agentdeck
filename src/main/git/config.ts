import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { execFileP } from './exec'

interface AgentdeckAction { name: string; command: string }

export interface AgentdeckConfig {
  copy?: string[]
  setup?: string
  archive?: string
  actions?: AgentdeckAction[]
}

export interface SetupResult {
  output: string
  exitCode: number
  /** Files/folders copied from agentdeck.json `copy`. */
  copied?: number
}

export async function readAgentdeckConfig(repo: string): Promise<AgentdeckConfig> {
  let raw: string
  try {
    raw = await readFile(join(repo, 'agentdeck.json'), 'utf8')
  } catch {
    return {}
  }
  let cfg: unknown
  try {
    cfg = JSON.parse(raw)
  } catch (e) {
    throw new Error(`agentdeck.json is not valid JSON: ${(e as Error).message}`)
  }
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg))
    throw new Error('agentdeck.json must be an object')
  const { copy, setup, archive, actions } = cfg as Record<string, unknown>
  if (copy !== undefined && !(Array.isArray(copy) && copy.every((c) => typeof c === 'string')))
    throw new Error('agentdeck.json: "copy" must be an array of strings')
  if (setup !== undefined && typeof setup !== 'string')
    throw new Error('agentdeck.json: "setup" must be a string')
  if (archive !== undefined && typeof archive !== 'string')
    throw new Error('agentdeck.json: "archive" must be a string')
  if (actions !== undefined && !(Array.isArray(actions) && actions.every((a) => a && typeof a.name === 'string' && typeof a.command === 'string')))
    throw new Error('agentdeck.json: "actions" must be an array of { name, command }')
  return { copy: copy as string[] | undefined, setup: setup as string | undefined, archive: archive as string | undefined, actions: actions as AgentdeckAction[] | undefined }
}

/** Mirror of readAgentdeckConfig: empty config removes the file. */
export async function writeAgentdeckConfig(repo: string, cfg: AgentdeckConfig): Promise<void> {
  const copy = (cfg.copy ?? []).map((c) => c.trim()).filter(Boolean)
  copy.forEach((c) => inside(repo, c))
  const setup = cfg.setup?.trim()
  const archive = cfg.archive?.trim()
  const file = join(repo, 'agentdeck.json')
  const actions = (cfg.actions ?? []).map((a) => ({ name: a.name.trim(), command: a.command.trim() })).filter((a) => a.name && a.command)
  if (!copy.length && !setup && !archive && !actions.length) return rm(file, { force: true })
  await writeFile(file, JSON.stringify({ ...(copy.length && { copy }), ...(setup && { setup }), ...(archive && { archive }), ...(actions.length && { actions }) }, null, 2) + '\n')
}

/** Resolve `rel` under `root`, rejecting absolute paths and `..` escapes. */
function inside(root: string, rel: string): string {
  const full = resolve(root, rel)
  const r = relative(resolve(root), full)
  if (isAbsolute(rel) || r === '' || r === '..' || r.startsWith('..' + sep) || isAbsolute(r))
    throw new Error(`Path escapes the repo root: "${rel}"`)
  return full
}

export async function setupWorktree(
  repo: string,
  worktreePath: string,
  cfg: AgentdeckConfig,
  env: Record<string, string> = {}
): Promise<SetupResult> {
  // Validate every path before touching anything.
  const pairs = (cfg.copy ?? []).map((rel) => [inside(repo, rel), inside(worktreePath, rel)])
  let copied = 0
  for (const [src, dst] of pairs) {
    // Missing sources (e.g. optional .env) are skipped.
    if (!(await stat(src).catch(() => null))) continue
    await mkdir(dirname(dst), { recursive: true })
    await cp(src, dst, { recursive: true })
    copied++
  }
  return { ...(cfg.setup ? await runScript(cfg.setup, worktreePath, env) : { output: '', exitCode: 0 }), copied }
}

/** Runs a shell command in `cwd`; never throws, reports the exit code. */
export async function runScript(command: string, cwd: string, env: Record<string, string> = {}): Promise<SetupResult> {
  const win = process.platform === 'win32'
  try {
    const { stdout, stderr } = await execFileP(win ? (process.env.ComSpec || 'cmd.exe') : process.env.SHELL || '/bin/sh', [win ? '/c' : '-c', command], {
      cwd,
      env: { ...process.env, ...env },
      maxBuffer: 64 * 1024 * 1024
    })
    return { output: stdout + stderr, exitCode: 0 }
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; code?: number | string; message: string }
    return {
      output: (err.stdout ?? '') + (err.stderr ?? '') || err.message,
      exitCode: typeof err.code === 'number' ? err.code : 1
    }
  }
}
