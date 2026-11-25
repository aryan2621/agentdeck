import { spawn, type IPty } from 'node-pty'

const MAX_BACKLOG = 200_000

interface Term { pty: IPty; backlog: string }

/** One shell per session, kept alive while its tab is closed; the backlog replays on reopen. */
export class PtyManager {
  private terms = new Map<string, Term>()
  constructor(private onData: (sessionId: string, data: string) => void) {}

  /** Starts the shell if needed and returns output so far. */
  open(sessionId: string, cwd: string, env: Record<string, string> = {}, initial?: string): string {
    const t = this.terms.get(sessionId)
    if (t) return t.backlog
    const pty = spawn(process.platform === 'win32' ? process.env.ComSpec || 'powershell.exe' : process.env.SHELL || '/bin/zsh', process.platform === 'win32' ? [] : ['-l'], {
      name: 'xterm-256color', cols: 80, rows: 24, cwd, env: { ...(process.env as Record<string, string>), ...env },
    })
    const term: Term = { pty, backlog: '' }
    this.terms.set(sessionId, term)
    pty.onData((d) => {
      term.backlog = (term.backlog + d).slice(-MAX_BACKLOG)
      this.onData(sessionId, d)
    })
    pty.onExit(() => this.terms.delete(sessionId))
    if (initial) pty.write(initial + '\r')
    return ''
  }
  write(sessionId: string, data: string): void { this.terms.get(sessionId)?.pty.write(data) }
  resize(sessionId: string, cols: number, rows: number): void {
    if (cols > 0 && rows > 0) this.terms.get(sessionId)?.pty.resize(cols, rows)
  }
  close(sessionId: string): void {
    this.terms.get(sessionId)?.pty.kill()
    this.terms.delete(sessionId)
  }
  dispose(): void { [...this.terms.keys()].forEach((id) => this.close(id)) }
}
