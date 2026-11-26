import { useEffect, useState } from 'react'
import type { SessionInfo } from '../../../shared/ipc'

/** Uncommitted +x −y for a session; refetched when its status changes. */
export const useChanges = (s: SessionInfo): { add: number; del: number; files: number } => {
  const [c, setC] = useState({ add: 0, del: 0, files: 0 })
  useEffect(() => {
    window.api.sessionDiff(s.id, 'uncommitted').then((r) => setC({ add: r.files.reduce((n, f) => n + f.additions, 0), del: r.files.reduce((n, f) => n + f.deletions, 0), files: r.files.length }), () => {})
  }, [s.id, s.status])
  return c
}
