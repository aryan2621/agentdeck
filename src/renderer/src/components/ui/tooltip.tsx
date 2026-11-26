import { useEffect, useRef, useState } from 'react'
import * as T from '@radix-ui/react-tooltip'
import { Kbd } from './kbd'

/** Tooltip that closes on click and stays shut when focus returns after a native dialog or window switch (until the next input). */
export function Tip({ label, kbd, children }: { label: string; kbd?: string; children: React.ReactNode }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const blocked = useRef(false)
  useEffect(() => {
    const block = (): void => { blocked.current = true; setOpen(false) }
    const unblock = (): void => { blocked.current = false }
    window.addEventListener('blur', block)
    window.addEventListener('pointermove', unblock)
    window.addEventListener('keydown', unblock)
    return () => { window.removeEventListener('blur', block); window.removeEventListener('pointermove', unblock); window.removeEventListener('keydown', unblock) }
  }, [])
  return (
    <T.Provider delayDuration={300}>
      <T.Root open={open} onOpenChange={(o) => setOpen(o && !blocked.current)}>
        <T.Trigger asChild onClick={() => setOpen(false)}>{children}</T.Trigger>
        <T.Portal>
          <T.Content sideOffset={6} className="z-50 flex items-center gap-2 rounded-md border border-border bg-overlay px-2 py-1 text-small shadow-overlay">{label}{kbd && <Kbd>{kbd}</Kbd>}</T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  )
}
