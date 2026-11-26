import { Check, ChevronDown } from 'lucide-react'
import { Button } from './button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from './menu'
import { cn } from '../../lib/utils'

export interface Choice { id: string; label: string }

/** Ghost button + dropdown of single-choice items (the open item is checked). `children` is the button's content, before the chevron. */
export function Pick({ label, value, options, onPick, children, className, align = 'end' }: {
  label: string; value: string; options: Choice[]; onPick: (id: string) => void; children: React.ReactNode; className?: string; align?: 'start' | 'end'
}): React.JSX.Element {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button type="button" variant="ghost" aria-label={label} className={cn('gap-1.5 text-muted-foreground', className)}>{children}<ChevronDown /></Button>
      </MenuTrigger>
      <MenuContent align={align}>
        {options.map((o) => <MenuItem key={o.id} onSelect={() => onPick(o.id)}><Check className={cn(o.id !== value && 'invisible')} />{o.label}</MenuItem>)}
      </MenuContent>
    </Menu>
  )
}
