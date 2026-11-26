import { cn } from '../lib/utils'

/** The app mark (three stacked cards). `spin` pulses the cards in turn: the loading indicator everywhere. */
export default function Logo({ className, spin }: { className?: string; spin?: boolean }): React.JSX.Element {
  const bars = [[300, 292, 424], [244, 452, 536], [188, 612, 648]]
  return (
    <svg viewBox="100 100 824 824" fill="currentColor" aria-hidden className={cn('size-4 shrink-0', className)}>
      {bars.map(([x, y, w], i) => (
        <rect key={i} x={x} y={y} width={w} height={120} rx={36} className={spin ? 'logo-bar' : undefined} style={spin ? { animationDelay: `${i * 0.15}s` } : { opacity: [0.32, 0.62, 1][i] }} />
      ))}
    </svg>
  )
}
