import { useEffect, useRef } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal as XTerm } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { actions } from '../store'

export default function Terminal({ sessionId }: { sessionId: string }): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const css = getComputedStyle(document.documentElement)
    const v = (n: string): string => css.getPropertyValue(n).trim()
    const term = new XTerm({
      fontFamily: '"Geist Mono Variable", ui-monospace, "SF Mono", Menlo, monospace', fontSize: 12, cursorBlink: true,
      theme: { background: v('--background'), foreground: v('--foreground'), cursor: v('--primary'), selectionBackground: v('--accent') }
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(host.current!)
    const sync = (): void => {
      fit.fit()
      void window.api.termResize(sessionId, term.cols, term.rows)
    }
    const ro = new ResizeObserver(sync)
    ro.observe(host.current!)
    const off = window.api.onTermData((sid, d) => sid === sessionId && term.write(d))
    const input = term.onData((d) => void window.api.termWrite(sessionId, d))
    window.api.termOpen(sessionId).then((backlog) => {
      term.write(backlog)
      sync()
    }, actions.fail)
    return () => { off(); input.dispose(); ro.disconnect(); term.dispose() }
  }, [sessionId])
  return <div className="min-h-0 flex-1 p-2" ref={host} aria-label="Terminal" />
}
