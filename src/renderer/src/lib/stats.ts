import type { LimitWindow } from '../../../shared/types'

export const fmtTokens = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

/** Remaining % of the 5-hour or 7-day window (Claude: '5-hour'/'7-day', Codex: '5h'/'weekly'); undefined when the provider reports none. */
export function windowLeft(ws: LimitWindow[] | undefined, w: '5h' | '7d'): number | undefined {
  const re = w === '5h' ? /^5/ : /^(7|weekly)/
  const hit = ws?.find((x) => re.test(x.name))
  return hit && Math.round(hit.remainingPercent)
}

/** Next effort in the model's list, wrapping; unset starts at the first. */
export function nextEffort(efforts: string[], cur?: string): string {
  const i = cur ? efforts.indexOf(cur) : -1
  return efforts[(i + 1) % efforts.length]
}

export const cap = (s: string): string => s[0].toUpperCase() + s.slice(1)
