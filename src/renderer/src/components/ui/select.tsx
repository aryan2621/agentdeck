import { Fragment } from 'react'
import * as S from '@radix-ui/react-select'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface Option { value: string; label: string; group?: string }

/** Radix select over a flat option list. Radix forbids an empty item value, so '' maps to a sentinel. */
const NONE = '__none__'

export function Select({ value, onChange, options, className, label, disabled, onOpen }: {
  value: string; onChange: (v: string) => void; options: Option[]; className?: string; label: string; disabled?: boolean; onOpen?: () => void
}): React.JSX.Element {
  return (
    <S.Root value={value === '' ? NONE : value} onValueChange={(v) => onChange(v === NONE ? '' : v)} disabled={disabled} onOpenChange={(o) => o && onOpen?.()}>
      <S.Trigger aria-label={label} className={cn('inline-flex h-8 min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-overlay px-3 text-prose transition-colors hover:bg-accent disabled:opacity-50', className)}>
        <span className="truncate"><S.Value /></span>
        <S.Icon><ChevronsUpDown className="size-3.5 text-muted-foreground" /></S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content position="popper" sideOffset={4} className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-border bg-overlay p-1 shadow-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <S.Viewport>
            {options.map((o, i) => (
              <Fragment key={o.value}>
              {o.group && o.group !== options[i - 1]?.group && <div role="presentation" className="px-2 pt-2 pb-1 text-small text-faint">{o.group}</div>}
              <S.Item value={o.value === '' ? NONE : o.value} className="relative flex h-8 cursor-pointer select-none items-center rounded-sm pl-6 pr-2 text-body outline-none data-[highlighted]:bg-accent">
                <S.ItemIndicator className="absolute left-1.5"><Check className="size-3.5" /></S.ItemIndicator>
                <S.ItemText>{o.label}</S.ItemText>
              </S.Item>
              </Fragment>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  )
}
