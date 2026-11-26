import { useEffect, useRef } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import type { SessionStatus } from '../../../shared/types'
import { cn } from '../lib/utils'
import type { AvatarChoice } from '../../../shared/ipc'

const LABEL: Record<SessionStatus, string> = { idle: 'Idle', working: 'Working', 'needs-you': 'Needs you', done: 'Done', error: 'Error' }

type Eyes = 'tall' | 'dots' | 'wide' | 'happy'
/** Static avatar presets (bot faces). A session gets one by hashing its id: random-looking but stable. */
const AVATARS: { bg: string; radius: string; eyes: Eyes }[] = [
  { bg: '#e8715a', radius: '50%', eyes: 'tall' }, { bg: '#e0a030', radius: '38%', eyes: 'dots' },
  { bg: '#7aa84a', radius: '44% 56% 52% 48%', eyes: 'happy' }, { bg: '#3fa58a', radius: '30%', eyes: 'tall' },
  { bg: '#3f9ac4', radius: '50%', eyes: 'wide' }, { bg: '#5a6fd6', radius: '38%', eyes: 'happy' },
  { bg: '#8a62c8', radius: '50% 50% 42% 42%', eyes: 'dots' }, { bg: '#c75a9c', radius: '44% 56% 52% 48%', eyes: 'tall' },
  { bg: '#6b7280', radius: '30%', eyes: 'wide' }, { bg: '#d9674a', radius: '50%', eyes: 'happy' },
  { bg: '#2f9e8f', radius: '50% 50% 42% 42%', eyes: 'wide' }, { bg: '#b8873a', radius: '38%', eyes: 'dots' }
]
/** Picker options (new-session screen). */
export const COLORS = ['#e8715a', '#e0a030', '#7aa84a', '#3fa58a', '#3f9ac4', '#5a6fd6', '#8a62c8', '#c75a9c', '#6b7280', '#2b2b2b']
export const SHAPES = ['50%', '38%', '44% 56% 52% 48%', '30%', '50% 50% 42% 42%', '22%', '50% 50% 50% 18%', '62% 38% 46% 54%']
const pick = (a: AvatarChoice, eyes: Eyes): (typeof AVATARS)[number] => ({ bg: COLORS[a.color] ?? COLORS[0], radius: SHAPES[a.shape] ?? SHAPES[0], eyes })
const avatarFor = (seed: string): (typeof AVATARS)[number] => AVATARS[[...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATARS.length]

/** Idle routine (as in Grok Bot): eyes look left, right, down, blink, then the body spins 2-3 times; repeats after a random pause. */
function useIdle(size: number): React.RefObject<HTMLSpanElement | null> {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const d = size * 0.14
    const at = (x: number, y: number, s = 1): Keyframe => ({ transform: `translate(${x}px, ${y}px) scaleY(${s})` })
    let timer: ReturnType<typeof setTimeout>
    // Light breeze: the whole avatar leans and drifts a little, forever, on its own phase.
    const root = ref.current?.parentElement?.parentElement
    root && (root.style.transformOrigin = '50% 100%')
    const wind = root?.animate([{ transform: 'rotate(-2.5deg) translateX(-1px)' }, { transform: 'rotate(2.5deg) translateX(1px)' }], { duration: 2200 + Math.random() * 1800, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out', delay: -Math.random() * 2000 })
    let anims: Animation[] = []
    const run = (): void => {
      const eyes = ref.current, body = eyes?.parentElement
      if (!eyes || !body) return
      const look = eyes.animate([at(0, 0), at(-d, 0), at(-d, 0), at(d, 0), at(d, 0), at(0, d), at(0, d), at(0, 0), at(0, 0, 0.1), at(0, 0)], { duration: 2600, easing: 'ease-in-out' })
      const turns = 2 + Math.floor(Math.random() * 2)
      // Wind-up (slight pull back), fast turn while squeezed, then an elastic settle back to the original shape.
      const w = 160, t = turns * 220, T = w + t + 360
      const pose = (deg: number, x: number, y: number, easing: string, offset: number): Keyframe => ({ transform: `perspective(400px) rotateY(${deg}deg) scale(${x}, ${y})`, easing, offset })
      const spin = body.animate([
        pose(0, 1, 1, 'ease-out', 0), pose(-28, 0.94, 1.04, 'cubic-bezier(0.45, 0, 0.25, 1)', w / T),
        pose(turns * 360, 0.78, 1.06, 'ease-out', (w + t) / T), pose(turns * 360, 1.07, 0.95, 'ease-in-out', (w + t + 140) / T), pose(turns * 360, 1, 1, 'ease-out', 1)
      ], { duration: T, delay: 2700 })
      anims = [look, spin]
      spin.onfinish = () => { timer = setTimeout(run, 3000 + Math.random() * 5000) }
    }
    timer = setTimeout(run, Math.random() * 6000)
    return () => { clearTimeout(timer); wind?.cancel(); anims.forEach((a) => a.cancel()) }
  }, [size])
  return ref
}

function Face({ eyes, size }: { eyes: Eyes; size: number }): React.JSX.Element {
  const s = (n: number): number => size * n
  const gap = s(0.12)
  if (eyes === 'happy') return <span className="flex items-start" style={{ gap: s(0.16) }} aria-hidden>{[0, 1].map((i) => <span key={i} className="border-white" style={{ width: s(0.2), height: s(0.12), borderTopWidth: s(0.06), borderRadius: '50% 50% 0 0' }} />)}</span>
  const dim = { tall: [0.13, 0.3], dots: [0.16, 0.16], wide: [0.28, 0.12] }[eyes]
  return <span className="flex items-center" style={{ gap }} aria-hidden>{[0, 1].map((i) => <span key={i} className="rounded-full bg-white" style={{ width: s(dim[0]), height: s(dim[1]) }} />)}</span>
}

/** Preset face picked from `seed` (the session id); the session status is a corner badge (shape + colour). */
export default function Avatar({ seed, avatar, status, size = 36, className }: { seed: string; avatar?: AvatarChoice; status?: SessionStatus; size?: number; className?: string }): React.JSX.Element {
  const badge = 'absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full ring-2 ring-chrome'
  const a = avatar ? pick(avatar, avatarFor(seed).eyes) : avatarFor(seed)
  const eyes = useIdle(size)
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center', className)} style={{ width: size, height: size }}>
      <span className="flex size-full items-center justify-center" style={{ background: a.bg, borderRadius: a.radius }}><span ref={eyes} className="flex"><Face eyes={a.eyes} size={size} /></span></span>
      {status === 'needs-you' && <span className={cn(badge, 'bg-needs')} role="img" aria-label={LABEL[status]} />}
      {status === 'working' && <span className={cn(badge, 'bg-chrome')} role="img" aria-label={LABEL[status]}><Loader2 className="size-3 animate-spin text-foreground" /></span>}
      {status === 'error' && <span className={cn(badge, 'bg-destructive')} role="img" aria-label={LABEL[status]}><X className="size-2.5 text-white" /></span>}
      {status === 'done' && <span className={cn(badge, 'bg-chrome')} role="img" aria-label={LABEL[status]}><Check className="size-2.5 text-faint" /></span>}
    </span>
  )
}

const initials = (name: string): string => {
  const w = name.split(/[\s\-_.]+/).filter(Boolean)
  return (w.length > 1 ? w[0][0] + w[1][0] : name.slice(0, 2)).toUpperCase()
}

/** Project badge: a coloured bubble with the name's initials (colour hashed from the name, stable). */
export function ProjectAvatar({ name, size = 32 }: { name: string; size?: number }): React.JSX.Element {
  const bg = COLORS[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length]
  return <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white" style={{ width: size, height: size, background: bg, fontSize: size * 0.42 }}>{initials(name)}</span>
}
