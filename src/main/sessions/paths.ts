import { realpathSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

/** Absolute path of a file under `root`; refuses anything that escapes it, including through symlinks. */
export function resolveInside(root: string, relPath: string): string {
  const cwd = resolve(root)
  const full = resolve(cwd, relPath)
  const outside = (base: string, p: string): boolean => {
    const rel = relative(base, p)
    return !rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)
  }
  if (outside(cwd, full)) throw new Error('File is outside the session folder')
  // Follow symlinks via the nearest existing ancestor (the file itself may be deleted).
  const real = (p: string): string => { try { return realpathSync(p) } catch { const up = dirname(p); return up === p ? p : join(real(up), basename(p)) } }
  const realCwd = real(cwd)
  if (real(full) !== realCwd && outside(realCwd, real(full))) throw new Error('File is outside the session folder')
  return full
}
