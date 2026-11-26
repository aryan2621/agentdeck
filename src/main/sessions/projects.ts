import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import * as git from '../git'
import { NOT_GIT, type ProjectInfo } from '../../shared/ipc'
import { ARCHIVED, type SessionManagerDeps } from './deps'

/** Adding, creating, cloning and removing repositories. */
export class ProjectService {
  constructor(private d: SessionManagerDeps) {}

  get(id: string): ProjectInfo {
    const p = this.d.db.listProjects().find((p) => p.id === id)
    if (!p) throw new Error(`unknown project ${id}`)
    return p
  }
  async add(dropped?: string): Promise<ProjectInfo | null> {
    const path = dropped ?? await this.d.pickFolder?.()
    if (!path) return null
    if (!(await git.isGitRepo(path))) throw new Error(`${path} ${NOT_GIT}`)
    const existing = this.d.db.listProjects().find((p) => p.path === path)
    if (existing) return existing
    const p = { id: randomUUID(), path, name: basename(path) }
    this.d.db.addProject(p)
    return p
  }
  async init(path: string, github?: 'private' | 'public'): Promise<ProjectInfo | null> {
    if (!(await git.isGitRepo(path))) await git.initRepo(path, github)
    return this.add(path)
  }
  async create(name: string, parent: string, github?: 'private' | 'public', repo?: string): Promise<ProjectInfo | null> {
    const n = name.trim()
    if (!n || /[/\\]/.test(n) || n.startsWith('.')) throw new Error(`Invalid project name: "${name}"`)
    const path = join(parent, n)
    const step = (s: string): void => this.d.emit.progress?.(s)
    step('folder')
    await mkdir(path, { recursive: true })
    if (!(await git.isGitRepo(path))) {
      step('git')
      await git.initRepo(path)
      if (github) { step('github'); await git.publishRepo(path, github, repo) }
    }
    step('add')
    return this.add(path)
  }
  /** Forget a repository. Files stay on disk; refuses while it still has sessions so no history is orphaned. */
  remove(id: string): void {
    this.get(id)
    if (this.d.db.listSessions(id).some((s) => s.status !== ARCHIVED)) throw new Error('Archive this repository\'s sessions first')
    this.d.db.removeProject(id)
  }
}
