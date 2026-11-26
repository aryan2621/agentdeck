import { randomUUID } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import type { Account, Session } from '../db'
import { configEnv, loginCommand } from '../accounts'
import type { AccountInfo } from '../../shared/ipc'
import type { ProviderId } from '../../shared/types'
import type { SessionManagerDeps } from './deps'

/** Multiple Claude/Codex logins: each account owns a config directory under accountsDir. */
export class AccountService {
  constructor(private d: SessionManagerDeps) {}

  get(id: string, provider?: ProviderId): Account {
    const a = this.d.db.listAccounts().find((a) => a.id === id)
    if (!a || (provider && a.provider !== provider)) throw new Error(`unknown ${provider ?? ''} account ${id}`)
    return a
  }
  configDir(row: Session): string | undefined {
    return row.accountId ? (this.get(row.accountId).configDir ?? undefined) : undefined
  }
  list(): AccountInfo[] {
    return this.d.db.listAccounts().map(({ id, provider, label }) => ({ id, provider, label }))
  }
  async add(provider: ProviderId, label: string): Promise<AccountInfo> {
    if (!label.trim()) throw new Error('Account name is empty')
    if (!this.d.accountsDir) throw new Error('accounts unavailable')
    const id = randomUUID()
    const configDir = join(this.d.accountsDir, id)
    await mkdir(configDir, { recursive: true })
    this.d.db.addAccount({ id, provider, label: label.trim(), configDir })
    return { id, provider, label: label.trim() }
  }
  login(accountId: string): string {
    const a = this.get(accountId)
    if (!this.d.pty || !a.configDir) throw new Error('terminal unavailable')
    const key = `login-${accountId}`
    this.d.pty.open(key, a.configDir, configEnv(a.provider, a.configDir), loginCommand(a.provider))
    return key
  }
  async remove(accountId: string): Promise<void> {
    const a = this.get(accountId)
    const n = this.d.db.countAccountSessions(accountId)
    if (n > 0) throw new Error(`Move ${n} ${n === 1 ? 'session' : 'sessions'} off this account first`)
    this.d.db.removeAccount(accountId)
    // Only ever delete inside our own accounts dir.
    if (a.configDir && this.d.accountsDir) {
      const rel = relative(resolve(this.d.accountsDir), resolve(a.configDir))
      if (rel && !rel.startsWith('..') && !isAbsolute(rel)) await rm(a.configDir, { recursive: true, force: true })
    }
  }
}
