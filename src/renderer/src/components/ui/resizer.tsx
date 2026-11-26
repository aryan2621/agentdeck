import { cn } from '../../lib/utils'

/** Vertical drag handle (1px line, wider hit area). `onDrag` gets clientX; `onNudge` gets -1/+1 from ←/→; double-click resets. */
export function Resizer({ label, value, min, max, onDrag, onNudge, onReset, className }: {
  label: string; value: number; min: number; max: number; onDrag: (clientX: number) => void; onNudge: (dir: -1 | 1) => void; onReset: () => void; className?: string
}): React.JSX.Element {
  return (
    <div
      role="separator" aria-orientation="vertical" aria-label={label} tabIndex={0}
      aria-valuenow={value} aria-valuemin={min} aria-valuemax={max}
      className={cn('relative w-px shrink-0 cursor-col-resize transition-colors before:absolute before:inset-y-0 before:-inset-x-1 hover:bg-ring/60 focus-visible:bg-ring', className)}
      onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
      onPointerMove={(e) => e.buttons === 1 && onDrag(e.clientX)}
      onDoubleClick={onReset}
      onKeyDown={(e) => { if (e.key === 'ArrowLeft') onNudge(-1); else if (e.key === 'ArrowRight') onNudge(1) }}
    />
  )
}
