import { accessSync, constants } from 'fs'
import { delimiter, join } from 'path'
import type { ProviderId } from '../shared/types'
import { cliPath } from './settings'

const executable = (p: string): boolean => { try { accessSync(p, constants.X_OK); return true } catch { return false } }

/** Whether `cmd` (a path or a bare name looked up on PATH) is runnable. */
const hasCommand = (cmd: string): boolean =>
  cmd.includes('/') ? executable(cmd) : (process.env.PATH ?? '').split(delimiter).some((d) => d && executable(join(d, cmd)))

/** The tool a session of this provider (or 'gh') would spawn. Claude uses the bundled SDK binary unless a path is set. */
export function checkTool(id: ProviderId | 'gh'): boolean {
  if (id === 'gh') return hasCommand('gh')
  if (id === 'claude') return hasCommand(cliPath('claude', '')) || !cliPath('claude', '')
  return hasCommand(cliPath(id, 'codex'))
}
