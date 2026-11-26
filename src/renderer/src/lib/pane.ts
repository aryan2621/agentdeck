import { createContext, useContext, useEffect, useRef } from 'react'

/** False for the pane that is not focused in split view; keyboard shortcuts only act in the active pane. */
export const PaneActive = createContext(true)

/** Ref that always holds whether this pane is active, for window-level key listeners. */
export const usePaneActive = (): React.RefObject<boolean> => {
  const active = useContext(PaneActive)
  const ref = useRef(active)
  useEffect(() => { ref.current = active }, [active])
  return ref
}
