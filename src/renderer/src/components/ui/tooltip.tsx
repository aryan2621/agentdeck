import * as T from '@radix-ui/react-tooltip'

export function Tip({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <T.Provider delayDuration={300}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal>
          <T.Content sideOffset={6} className="z-50 rounded-md border border-border bg-panel px-2 py-1 text-xs shadow-md shadow-black/25">{label}</T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  )
}
