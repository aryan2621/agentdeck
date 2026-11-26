import type { Settings } from '../../../shared/types'

/** A palette is a surface tint (hue per scheme, chroma multiplier) plus an accent; app.css derives every surface from these. */
export interface Theme { id: string; label: string; h: [number, number]; t: number; accent: [string, string]; bg: [string, string] }
export const THEMES: Theme[] = [
  { id: 'default', label: 'Default', h: [85, 60], t: 1, accent: ['oklch(0.5 0.06 50)', 'oklch(0.72 0.06 50)'], bg: ['#fff', '#2a2624'] },
  { id: 'hokusai', label: 'Hokusai', h: [85, 85], t: 3, accent: ['oklch(0.42 0.12 260)', 'oklch(0.7 0.12 250)'], bg: ['#f6f3ee', '#25272d'] },
  { id: 'dracula', label: 'Dracula', h: [300, 285], t: 9, accent: ['oklch(0.55 0.2 305)', 'oklch(0.75 0.16 305)'], bg: ['#f3f0f7', '#282a36'] },
  { id: 'gruvbox', label: 'Gruvbox', h: [90, 80], t: 8, accent: ['oklch(0.65 0.15 85)', 'oklch(0.82 0.15 85)'], bg: ['#f6efd9', '#282828'] },
  { id: 'nord', label: 'Nord', h: [250, 250], t: 9, accent: ['oklch(0.6 0.08 215)', 'oklch(0.78 0.08 215)'], bg: ['#eceff4', '#2e3440'] },
  { id: 'tokyo-night', label: 'Tokyo Night', h: [270, 270], t: 12, accent: ['oklch(0.55 0.17 265)', 'oklch(0.75 0.13 265)'], bg: ['#eef0f8', '#1a1b26'] },
  { id: 'hacker', label: 'Hacker', h: [150, 150], t: 5, accent: ['oklch(0.5 0.17 150)', 'oklch(0.85 0.22 150)'], bg: ['#eef5ef', '#050d08'] },
  { id: 'indigo', label: 'Indigo', h: [275, 275], t: 5, accent: ['oklch(0.52 0.18 275)', 'oklch(0.72 0.15 275)'], bg: ['#f4f4fb', '#202033'] },
]
/** Thanksgiving: warm autumn accent over whichever palette is chosen. */
const AUTUMN: [string, string] = ['oklch(0.58 0.15 50)', 'oklch(0.75 0.14 55)']

/** Writes the appearance settings onto <html>; CSS does the rest. */
export function applyAppearance(s: Pick<Settings, 'colorTheme' | 'lowContrast' | 'seasonal' | 'accessibleColors'>): void {
  const th = THEMES.find((x) => x.id === s.colorTheme) ?? THEMES[0]
  const acc = s.seasonal ? AUTUMN : th.accent
  const dark = matchMedia('(prefers-color-scheme: dark)').matches
  const el = document.documentElement
  el.dataset.colorTheme = th.id
  el.style.setProperty('--h-l', String(th.h[0]))
  el.style.setProperty('--h-d', String(th.h[1]))
  el.style.setProperty('--t', String(th.t))
  el.style.setProperty('--link', acc[+dark])
  el.style.setProperty('--ring', acc[+dark])
  el.toggleAttribute('data-low-contrast', s.lowContrast)
  if (s.accessibleColors === 'colorblind') el.dataset.accessible = 'colorblind'
  else delete el.dataset.accessible
}
