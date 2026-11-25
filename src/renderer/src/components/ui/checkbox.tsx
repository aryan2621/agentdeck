import * as C from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'

export const Checkbox = (p: React.ComponentProps<typeof C.Root>): React.JSX.Element => (
  <C.Root className="flex size-4 items-center justify-center rounded-sm border border-input bg-card data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" {...p}>
    <C.Indicator><Check className="size-3" strokeWidth={3} /></C.Indicator>
  </C.Root>
)
