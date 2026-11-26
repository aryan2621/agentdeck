/** Grok-style stamp: time today, "Yesterday", else M/D. */
export const stamp = (t: number | string): string => {
  const d = new Date(t), days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 864e5)
  return days <= 0 ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : days === 1 ? 'Yesterday' : `${d.getMonth() + 1}/${d.getDate()}`
}

/** Compact relative age for lists: "now", "5m", "3h", "2d", then M/D. */
export const rel = (t: number): string => {
  const m = Math.floor((Date.now() - t) / 6e4)
  return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : m < 10080 ? `${Math.floor(m / 1440)}d` : `${new Date(t).getMonth() + 1}/${new Date(t).getDate()}`
}
