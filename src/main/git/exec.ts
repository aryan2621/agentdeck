import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

export const execFileP = promisify(execFile)

export async function run(cwd: string, cmd: string, args: string[], env?: NodeJS.ProcessEnv): Promise<string> {
  try {
    const { stdout } = await execFileP(cmd, args, { cwd, maxBuffer: 64 * 1024 * 1024, env: env ? { ...process.env, ...env } : undefined })
    return stdout
  } catch (e) {
    const err = e as { stderr?: string; message: string; code?: string }
    if (err.code === 'ENOENT') throw new Error(cmd === 'gh' ? 'GitHub CLI (gh) not found. Install it from cli.github.com, then try again.' : `${cmd} not found. Install it and make sure it is on your PATH.`)
    throw new Error(`${cmd} ${args.join(' ')} failed: ${(err.stderr || err.message).trim()}`)
  }
}

export const git = (cwd: string, ...args: string[]): Promise<string> => run(cwd, 'git', args)

export const gitEnv = (cwd: string, env: NodeJS.ProcessEnv, ...args: string[]): Promise<string> => run(cwd, 'git', args, env)

export function safeRef(ref: string, what: string): string {
  if (!ref || ref.startsWith('-')) throw new Error(`Invalid ${what}: "${ref}"`)
  return ref
}

export async function requireCommits(path: string): Promise<void> {
  try {
    await git(path, 'rev-parse', '--verify', 'HEAD')
  } catch {
    throw new Error('Repository has no commits yet; make an initial commit first')
  }
}
