/** Sorts `items` by their position in `order`; ids not in `order` keep their relative place after the listed ones. */
export function applyOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  const pos = (id: string): number => { const i = order.indexOf(id); return i < 0 ? order.length : i }
  return [...items].sort((a, b) => pos(a.id) - pos(b.id)) // stable sort keeps unlisted ones in createdAt order
}

/** New saved order after moving `id` one step (-1 up, +1 down) within the displayed `ids`. */
export function moveInOrder(ids: string[], id: string, dir: -1 | 1): string[] {
  const i = ids.indexOf(id), j = i + dir
  if (i < 0 || j < 0 || j >= ids.length) return ids
  const out = [...ids]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}
