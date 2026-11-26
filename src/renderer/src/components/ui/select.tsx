import * as S from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface Option { value: string; label: string }

/** Radix select over a flat option list. Radix forbids an empty item value, so '' maps to a sentinel. */
const NONE = '__none__'

export function Select({ value, onChange, options, className, label, disabled, onOpen }: {
  value: string; onChange: (v: string) => void; options: Option[]; className?: string; label: string; disabled?: boolean; onOpen?: () => void
}): React.JSX.Element {
  return (
    <S.Root value={value === '' ? NONE : value} onValueChange={(v) => onChange(v === NONE ? '' : v)} disabled={disabled} onOpenChange={(o) => o && onOpen?.()}>
      <S.Trigger aria-label={label} className={cn('inline-flex h-7 min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-overlay px-2.5 text-body transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50', className)}>
        <span className="truncate"><S.Value /></span>
        <S.Icon><ChevronDown className="size-3.5 text-muted-foreground" /></S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content position="popper" sideOffset={4} className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-border bg-overlay p-1 shadow-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <S.Viewport>
            {options.map((o) => (
              <S.Item key={o.value} value={o.value === '' ? NONE : o.value} className="relative flex h-8 cursor-default select-none items-center rounded-lg pl-6 pr-2 text-body outline-none data-[highlighted]:bg-accent">
                <S.ItemIndicator className="absolute left-1.5"><Check className="size-3.5" /></S.ItemIndicator>
                <S.ItemText>{o.label}</S.ItemText>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  )
}
