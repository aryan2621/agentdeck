import * as C from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'

export const Checkbox = (p: React.ComponentProps<typeof C.Root>): React.JSX.Element => (
  <C.Root className="flex size-4 items-center justify-center rounded-sm border border-input bg-transparent data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" {...p}>
    <C.Indicator><Check className="size-3" strokeWidth={3} /></C.Indicator>
  </C.Root>
)

/** Pill toggle: dark track and light knob when on, soft grey track when off. Same Radix root, announced as a switch. */
export const Switch = (p: React.ComponentProps<typeof C.Root>): React.JSX.Element => (
  <C.Root role="switch" className="relative h-6 w-11 shrink-0 rounded-full bg-muted-foreground/25 transition-colors data-[state=checked]:bg-primary" {...p}>
    <span aria-hidden className="absolute top-0.5 left-0.5 size-5 rounded-full bg-background transition-transform duration-100 ease-out [[data-state=checked]>&]:translate-x-5 [[data-state=checked]>&]:bg-primary-foreground" />
  </C.Root>
)
