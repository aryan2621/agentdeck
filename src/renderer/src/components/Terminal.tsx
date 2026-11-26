import { useEffect, useRef } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal as XTerm, type ITheme } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { actions } from '../store'

/** ANSI palette from the design tokens (DESIGN.md §2.8); bright variants mix toward white. */
function termTheme(): ITheme {
  const css = getComputedStyle(document.documentElement)
  const v = (n: string): string => css.getPropertyValue(n).trim()
  const bright = (c: string): string => `color-mix(in oklch, ${c}, white 18%)`
  const [red, green, yellow, blue, magenta, cyan] = [v('--destructive'), v('--ok'), v('--warn'), v('--project-5'), v('--project-7'), v('--project-4')]
  return {
    background: v('--panel'), foreground: v('--foreground'), cursor: v('--primary'), selectionBackground: v('--accent'),
    black: v('--muted'), white: v('--muted-foreground'), brightBlack: v('--faint'), brightWhite: v('--foreground'),
    red, green, yellow, blue, magenta, cyan,
    brightRed: bright(red), brightGreen: bright(green), brightYellow: bright(yellow), brightBlue: bright(blue), brightMagenta: bright(magenta), brightCyan: bright(cyan)
  }
}

export default function Terminal({ sessionId }: { sessionId: string }): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const term = new XTerm({
      fontFamily: '"Geist Mono Variable", ui-monospace, "SF Mono", Menlo, monospace', fontSize: 12, cursorBlink: true,
      theme: termTheme()
    })
    // The theme reads CSS tokens, so it must be rebuilt when light/dark flips.
    const scheme = matchMedia('(prefers-color-scheme: dark)')
    const retheme = (): void => { term.options.theme = termTheme() }
    scheme.addEventListener('change', retheme)
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
    return () => { off(); input.dispose(); ro.disconnect(); scheme.removeEventListener('change', retheme); term.dispose() }
  }, [sessionId])
  return <div className="min-h-0 flex-1 bg-panel p-2" ref={host} aria-label="Terminal" />
}
