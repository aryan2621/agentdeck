import type { Settings } from '../../../shared/types'

/** Mono font ids (shared MONO_FONTS) -> label and CSS stack. All but Geist are macOS system fonts. */
const FALLBACK = "ui-monospace, 'SF Mono', Menlo, monospace"
export const MONO: Record<string, { label: string; stack: string }> = {
  geist: { label: 'Geist Mono', stack: `'Geist Mono Variable', ${FALLBACK}` },
  sf: { label: 'SF Mono', stack: `'SF Mono', ${FALLBACK}` },
  menlo: { label: 'Menlo', stack: `Menlo, ${FALLBACK}` },
  monaco: { label: 'Monaco', stack: `Monaco, ${FALLBACK}` },
  courier: { label: 'Courier New', stack: `'Courier New', ${FALLBACK}` }
}
const monoStack = (id: string): string => (MONO[id] ?? MONO.geist).stack
/** Terminal stack: the user's installed font name first, else the code font. */
export const terminalStack = (s: Pick<Settings, 'terminalFont' | 'monoFont'>): string =>
  s.terminalFont ? `"${s.terminalFont}", ${monoStack(s.monoFont)}` : monoStack(s.monoFont)

/** Writes typography settings onto <html>; app.css does the rest. */
export function applyTypography(s: Pick<Settings, 'monoFont' | 'codeLigatures' | 'markdownStyle'>): void {
  const el = document.documentElement
  el.style.setProperty('--font-mono', monoStack(s.monoFont))
  el.toggleAttribute('data-no-ligatures', !s.codeLigatures)
  el.dataset.markdown = s.markdownStyle
}
