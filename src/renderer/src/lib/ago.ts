/** Grok-style stamp: time today, "Yesterday", else M/D. */
export const stamp = (t: number | string): string => {
  const d = new Date(t), days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 864e5)
  return days <= 0 ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : days === 1 ? 'Yesterday' : `${d.getMonth() + 1}/${d.getDate()}`
}
