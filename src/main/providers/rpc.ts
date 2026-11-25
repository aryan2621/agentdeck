import { createInterface } from 'node:readline'
import type { Readable } from 'node:stream'

/** Minimal child surface we need; tests inject a fake. */
export interface RpcChild {
  stdin: { write(s: string): unknown }
  stdout: Readable
  kill(): unknown
  on?(event: 'error', cb: (e: Error) => void): unknown
}

type Msg = { id?: number | string; method?: string; params?: any; result?: any; error?: { message: string } }

/** Newline-delimited JSON-RPC over a child's stdio. `extra` is merged into every outgoing message (ACP: `{ jsonrpc: '2.0' }`). */
export class RpcClient {
  private nextId = 0
  private pending = new Map<number, { res: (v: any) => void; rej: (e: Error) => void }>()
  /** Callers replace this with their handshake; `request` waits on it. */
  ready: Promise<unknown> = Promise.resolve()

  constructor(
    private child: RpcChild,
    private onNotify: (method: string, params: any) => void,
    private onRequest: (id: number | string, method: string, params: any) => void,
    private extra: object = {},
  ) {
    createInterface({ input: child.stdout }).on('line', (l) => this.handle(l))
  }

  private write(m: object): void { this.child.stdin.write(JSON.stringify({ ...this.extra, ...m }) + '\n') }

  private handle(line: string): void {
    let m: Msg
    try { m = JSON.parse(line) } catch { return }
    if (m.id !== undefined && m.method) return this.onRequest(m.id, m.method, m.params)
    if (m.id !== undefined) {
      const p = this.pending.get(m.id as number)
      this.pending.delete(m.id as number)
      if (m.error) p?.rej(new Error(m.error.message)); else p?.res(m.result)
    } else if (m.method) this.onNotify(m.method, m.params)
  }

  call<T = any>(method: string, params?: object): Promise<T> {
    return new Promise((res, rej) => {
      const id = ++this.nextId
      this.pending.set(id, { res, rej })
      this.write({ id, method, params })
    })
  }

  async request<T = any>(method: string, params?: object): Promise<T> {
    await this.ready
    return this.call<T>(method, params)
  }

  notify(method: string, params?: object): void { this.write(params ? { method, params } : { method }) }
  respond(id: number | string, result: object): void { this.write({ id, result }) }
  respondError(id: number | string, message: string): void { this.write({ id, error: { code: -32601, message } }) }
  kill(): void { this.child.kill() }

  /** Reject every in-flight call (child exited or failed to spawn). */
  failAll(e: Error): void {
    this.pending.forEach((p) => p.rej(e))
    this.pending.clear()
  }
}
