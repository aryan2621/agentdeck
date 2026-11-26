/** Splits a multi-file unified diff into one chunk per file. */
export const perFile = (diff: string): string[] => diff.split(/^(?=diff --git )/m).filter(Boolean)

export const stats = (diff: string): { add: number; del: number } => ({
  add: (diff.match(/^\+(?!\+\+)/gm) ?? []).length,
  del: (diff.match(/^-(?!--)/gm) ?? []).length
})
