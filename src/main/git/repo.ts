import { mkdir, readdir } from 'node:fs/promises'
import { basename, join, relative } from 'node:path'
import { git, requireCommits, run, safeRef } from './exec'

/** Tracked and untracked (non-ignored) files, relative to cwd, for @mentions. */
export async function listFiles(cwd: string): Promise<string[]> {
  return (await git(cwd, 'ls-files', '-z', '--cached', '--others', '--exclude-standard')).split('\0').filter(Boolean)
}

/** Files under the worktree's `.context` folder (agent notes and artifacts), relative to it. */
export async function listArtifacts(cwd: string): Promise<string[]> {
  const entries = await readdir(join(cwd, '.context'), { recursive: true, withFileTypes: true }).catch(() => [])
  return entries.filter((e) => e.isFile()).map((e) => relative(join(cwd, '.context'), join(e.parentPath, e.name))).sort()
}

export async function isGitRepo(path: string): Promise<boolean> {
  try {
    return (await git(path, 'rev-parse', '--is-inside-work-tree')).trim() === 'true'
  } catch {
    return false
  }
}

/** Turns a plain folder into a repo with one commit; optionally creates the GitHub repo (via the logged-in gh) and pushes. */
export async function initRepo(path: string, github?: 'private' | 'public'): Promise<void> {
  await git(path, 'init')
  await git(path, 'add', '-A')
  await git(path, 'commit', '--allow-empty', '-m', 'Initial commit')
  if (github) await publishRepo(path, github)
}

const SLUG = /^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9._-]+$/

/** `slug` is owner/name; default is the folder name under the logged-in account. */
export const publishRepo = (path: string, visibility: 'private' | 'public', slug?: string): Promise<unknown> => {
  if (slug && !SLUG.test(slug)) throw new Error(`Invalid repository name: "${slug}"`)
  return run(path, 'gh', ['repo', 'create', slug ?? basename(path), `--${visibility}`, '--source', '.', '--push'])
}

/** The logged-in GitHub user plus their organisations, for the Owner picker. */
export async function githubOwners(): Promise<string[]> {
  const me = (await run('.', 'gh', ['api', 'user', '--jq', '.login'])).trim()
  const orgs = (await run('.', 'gh', ['api', 'user/orgs', '--jq', '.[].login']).catch(() => '')).split('\n').map((o) => o.trim()).filter(Boolean)
  return [me, ...orgs]
}

/** True when owner/name does not exist yet (gh repo view fails). */
export const repoAvailable = (slug: string): Promise<boolean> => SLUG.test(slug) ? run('.', 'gh', ['repo', 'view', slug]).then(() => false, () => true) : Promise.resolve(false)

/** A PR number becomes its head (fetched from origin); anything else is taken as a branch/ref name. */
export async function resolveBase(repo: string, ref: string): Promise<string> {
  const t = ref.trim().replace(/^#/, '')
  if (!/^\d+$/.test(t)) return safeRef(ref.trim(), 'branch name')
  await git(repo, 'fetch', 'origin', `pull/${t}/head`)
  return 'FETCH_HEAD'
}

/** Clones `repo` (URL or owner/name, via the logged-in gh) into `parent/<name>` and returns that path. */
export async function cloneRepo(repo: string, parent: string): Promise<string> {
  const name = basename(repo.trim().replace(/\.git$/, '').replace(/\/+$/, ''))
  if (!name || name.startsWith('-') || repo.trim().startsWith('-')) throw new Error(`Not a repository: "${repo}"`)
  await run(parent, 'gh', ['repo', 'clone', repo.trim(), name])
  return join(parent, name)
}

export async function currentBranch(path: string): Promise<string> {
  // symbolic-ref also resolves the branch name before its first commit.
  return (await git(path, 'symbolic-ref', '--quiet', '--short', 'HEAD').catch(() => git(path, 'rev-parse', '--abbrev-ref', 'HEAD'))).trim()
}

export async function addWorktree(
  repo: string,
  branch: string,
  baseDir: string,
  base?: string
): Promise<{ path: string; branch: string }> {
  safeRef(branch, 'branch name')
  await requireCommits(repo)
  const path = join(baseDir, branch.replace(/[/\\]/g, '-'))
  await mkdir(baseDir, { recursive: true })
  await git(repo, 'worktree', 'add', '-b', branch, path, ...(base ? [safeRef(base, 'base branch')] : []))
  return { path, branch }
}

export async function removeWorktree(
  repo: string,
  path: string,
  deleteBranch?: string
): Promise<void> {
  await git(repo, 'worktree', 'remove', '--force', path)
  if (deleteBranch) await git(repo, 'branch', '-D', safeRef(deleteBranch, 'branch name'))
}
