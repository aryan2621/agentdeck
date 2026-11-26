import { useEffect, useRef } from 'react'
import type { SessionStatus } from '../../../shared/types'
import { cn } from '../lib/utils'
import { StatusDot } from './StatusBadge'
import type { AvatarChoice } from '../../../shared/ipc'

type Eyes = 'tall' | 'dots' | 'wide' | 'happy'
/** Static avatar presets (bot faces). A session gets one by hashing its id: random-looking but stable. */
const AVATARS: { bg: string; radius: string; eyes: Eyes }[] = [
  { bg: 'var(--project-0)', radius: '50%', eyes: 'tall' }, { bg: 'var(--project-1)', radius: '38%', eyes: 'dots' },
  { bg: 'var(--project-2)', radius: '44% 56% 52% 48%', eyes: 'happy' }, { bg: 'var(--project-3)', radius: '30%', eyes: 'tall' },
  { bg: 'var(--project-4)', radius: '50%', eyes: 'wide' }, { bg: 'var(--project-5)', radius: '38%', eyes: 'happy' },
  { bg: 'var(--project-6)', radius: '50% 50% 42% 42%', eyes: 'dots' }, { bg: 'var(--project-7)', radius: '44% 56% 52% 48%', eyes: 'tall' },
  { bg: 'var(--faint)', radius: '30%', eyes: 'wide' }, { bg: 'var(--project-0)', radius: '50%', eyes: 'happy' },
  { bg: 'var(--project-4)', radius: '50% 50% 42% 42%', eyes: 'wide' }, { bg: 'var(--project-1)', radius: '38%', eyes: 'dots' }
]
/** Picker options (new-session screen). */
export const COLORS = ['var(--project-0)', 'var(--project-1)', 'var(--project-2)', 'var(--project-3)', 'var(--project-4)', 'var(--project-5)', 'var(--project-6)', 'var(--project-7)', 'var(--faint)']
export const SHAPES = ['50%', '38%', '44% 56% 52% 48%', '30%', '50% 50% 42% 42%', '22%', '50% 50% 50% 18%', '62% 38% 46% 54%']
const pick = (a: AvatarChoice, eyes: Eyes): (typeof AVATARS)[number] => ({ bg: COLORS[a.color] ?? COLORS[0], radius: SHAPES[a.shape] ?? SHAPES[0], eyes })
const avatarFor = (seed: string): (typeof AVATARS)[number] => AVATARS[[...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATARS.length]

/** Idle routine (as in Grok Bot): eyes look left, right, down, blink, then the body spins 2-3 times; repeats after a random pause. */
function useIdle(size: number, on: boolean): React.RefObject<HTMLSpanElement | null> {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!on || matchMedia('(prefers-reduced-motion: reduce)').matches) return
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
  }, [size, on])
  return ref
}

function Face({ eyes, size }: { eyes: Eyes; size: number }): React.JSX.Element {
  const s = (n: number): number => size * n
  const gap = s(0.12)
  if (eyes === 'happy') return <span className="flex items-start" style={{ gap: s(0.16) }} aria-hidden>{[0, 1].map((i) => <span key={i} className="border-[var(--avatar-ink)]" style={{ width: s(0.2), height: s(0.12), borderTopWidth: s(0.06), borderRadius: '50% 50% 0 0' }} />)}</span>
  const dim = { tall: [0.13, 0.3], dots: [0.16, 0.16], wide: [0.28, 0.12] }[eyes]
  return <span className="flex items-center" style={{ gap }} aria-hidden>{[0, 1].map((i) => <span key={i} className="rounded-full bg-[var(--avatar-ink)]" style={{ width: s(dim[0]), height: s(dim[1]) }} />)}</span>
}

/** Preset face picked from `seed` (the session id); the session status is a corner badge (shape + colour). */
export default function Avatar({ seed, avatar, status, size = 36, animate, className }: { seed: string; avatar?: AvatarChoice; status?: SessionStatus; size?: number; animate?: boolean; className?: string }): React.JSX.Element {
  const badge = 'absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-[var(--surface,var(--chrome))] ring-2 ring-[var(--surface,var(--chrome))]'
  const a = avatar ? pick(avatar, avatarFor(seed).eyes) : avatarFor(seed)
  const eyes = useIdle(size, !!animate || status === 'working')
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center', className)} style={{ width: size, height: size }}>
      <span className="flex size-full items-center justify-center" style={{ background: a.bg, borderRadius: a.radius }}><span ref={eyes} className="flex"><Face eyes={a.eyes} size={size} /></span></span>
      {status && status !== 'idle' && <span className={badge}><StatusDot status={status} size="size-3" /></span>}
    </span>
  )
}

/** Project badge: a coloured bubble with the name's first initial (colour hashed from the name, stable). */
export function ProjectAvatar({ name, size = 32 }: { name: string; size?: number }): React.JSX.Element {
  const bg = COLORS[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % (COLORS.length - 1)]
  const px = Math.max(size, 20)
  return <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-md font-semibold text-[var(--avatar-ink)]" style={{ width: px, height: px, background: bg, fontSize: px * 0.5 }}>{(name.trim()[0] ?? '?').toUpperCase()}</span>
}
