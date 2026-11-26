import { cn } from '../lib/utils'

const LETTERS: Record<string, string[]> = {
  A: ['01110', '11011', '11011', '11111', '11011'],
  G: ['01111', '11000', '11011', '11011', '01110'],
  E: ['11111', '11000', '11110', '11000', '11111'],
  N: ['11001', '11101', '11111', '11011', '11001'],
  T: ['11111', '00100', '00100', '00100', '00100'],
  D: ['11110', '11011', '11011', '11011', '11110'],
  C: ['01111', '11000', '11000', '11000', '01111'],
  K: ['11011', '11010', '11100', '11010', '11011'],
}

/** AgentDeck's name in the reference's modular, cut-out lettering. */
export function Wordmark(): React.JSX.Element {
  return (
    <svg viewBox="0 0 461 70" role="img" aria-label="AgentDeck" className="h-auto w-full fill-current">
      {'AGENTDECK'.split('').flatMap((letter, i) => LETTERS[letter].flatMap((row, y) => [...row.matchAll(/1+/g)].map((m) => <rect key={`${i}-${y}-${m.index}`} x={i * 52 + m.index * 9} y={y * 14} width={m[0].length * 9 - 1} height={10} rx={1} />)))}
    </svg>
  )
}

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
