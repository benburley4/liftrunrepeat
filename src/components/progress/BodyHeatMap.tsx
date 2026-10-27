'use client'

import { useState } from 'react'
import { ACTIVITY_COLORS } from './progressStyle'

type Part = 'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Core' | 'Legs'
const PARTS: Part[] = ['Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Legs']

/** Shape helper so each region can carry its body part. */
type Shape = { part: Part | null } & ({ el: 'ellipse'; cx: number; cy: number; rx: number; ry: number } | { el: 'rect'; x: number; y: number; w: number; h: number; r?: number } | { el: 'path'; d: string })

const HEAD: Shape[] = [
  { part: null, el: 'ellipse', cx: 40, cy: 12, rx: 10, ry: 11 },
  { part: null, el: 'rect', x: 36, y: 22, w: 8, h: 8, r: 2 },
]

const FRONT: Shape[] = [
  ...HEAD,
  { part: 'Shoulders', el: 'ellipse', cx: 17, cy: 37, rx: 8, ry: 8 },
  { part: 'Shoulders', el: 'ellipse', cx: 63, cy: 37, rx: 8, ry: 8 },
  { part: 'Chest', el: 'path', d: 'M24 32 Q40 28 56 32 L56 54 Q40 60 24 54 Z' },
  { part: 'Arms', el: 'rect', x: 8, y: 45, w: 10, h: 24, r: 5 },
  { part: 'Arms', el: 'rect', x: 62, y: 45, w: 10, h: 24, r: 5 },
  { part: 'Arms', el: 'rect', x: 6, y: 71, w: 9, h: 22, r: 4 },
  { part: 'Arms', el: 'rect', x: 65, y: 71, w: 9, h: 22, r: 4 },
  { part: 'Core', el: 'rect', x: 28, y: 58, w: 24, h: 30, r: 4 },
  { part: null, el: 'rect', x: 26, y: 89, w: 28, h: 10, r: 4 },
  { part: 'Legs', el: 'rect', x: 25, y: 100, w: 14, h: 40, r: 6 },
  { part: 'Legs', el: 'rect', x: 41, y: 100, w: 14, h: 40, r: 6 },
  { part: 'Legs', el: 'rect', x: 26, y: 143, w: 12, h: 30, r: 5 },
  { part: 'Legs', el: 'rect', x: 42, y: 143, w: 12, h: 30, r: 5 },
]

const BACK: Shape[] = [
  ...HEAD,
  { part: 'Shoulders', el: 'ellipse', cx: 17, cy: 37, rx: 8, ry: 8 },
  { part: 'Shoulders', el: 'ellipse', cx: 63, cy: 37, rx: 8, ry: 8 },
  { part: 'Back', el: 'path', d: 'M36 24 L24 32 L28 44 L52 44 L56 32 L44 24 Z' },
  { part: 'Back', el: 'path', d: 'M24 44 L56 44 L52 72 L40 76 L28 72 Z' },
  { part: 'Back', el: 'rect', x: 30, y: 74, w: 20, h: 14, r: 3 },
  { part: 'Arms', el: 'rect', x: 8, y: 45, w: 10, h: 24, r: 5 },
  { part: 'Arms', el: 'rect', x: 62, y: 45, w: 10, h: 24, r: 5 },
  { part: 'Arms', el: 'rect', x: 6, y: 71, w: 9, h: 22, r: 4 },
  { part: 'Arms', el: 'rect', x: 65, y: 71, w: 9, h: 22, r: 4 },
  { part: 'Legs', el: 'path', d: 'M26 89 L54 89 L55 104 L40 106 L25 104 Z' },
  { part: 'Legs', el: 'rect', x: 25, y: 106, w: 14, h: 34, r: 6 },
  { part: 'Legs', el: 'rect', x: 41, y: 106, w: 14, h: 34, r: 6 },
  { part: 'Legs', el: 'rect', x: 26, y: 143, w: 12, h: 30, r: 5 },
  { part: 'Legs', el: 'rect', x: 42, y: 143, w: 12, h: 30, r: 5 },
]

function Figure({ shapes, fill, label, onHover }: { shapes: Shape[]; fill: (p: Part | null) => string; label: string; onHover: (p: Part | null) => void }) {
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 80 178" width={104} height={232} role="img" aria-label={label}>
        {shapes.map((s, i) => {
          const common = {
            fill: fill(s.part), stroke: '#141414', strokeWidth: 0.8,
            onMouseEnter: () => onHover(s.part), onMouseLeave: () => onHover(null),
            style: { transition: 'fill 0.3s' },
          }
          if (s.el === 'ellipse') return <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...common} />
          if (s.el === 'rect') return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r ?? 0} {...common} />
          return <path key={i} d={s.d} {...common} />
        })}
      </svg>
      <figcaption className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>{label}</figcaption>
    </figure>
  )
}

/** Front and back figures shaded by working sets per body part. */
export default function BodyHeatMap({ sets }: { sets: Record<string, number> }) {
  const [hover, setHover] = useState<Part | null>(null)
  const max = Math.max(1, ...PARTS.map(p => sets[p] ?? 0))
  const total = PARTS.reduce((n, p) => n + (sets[p] ?? 0), 0)
  const fill = (p: Part | null) => {
    if (!p) return '#2A2A2A'
    const v = sets[p] ?? 0
    if (!v) return '#262626'
    const t = 0.18 + 0.82 * (v / max)
    const dim = hover && hover !== p ? 0.35 : 1
    return `rgba(0,191,165,${(t * dim).toFixed(2)})`
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <div className="flex gap-4">
        <Figure shapes={FRONT} fill={fill} label="Front" onHover={setHover} />
        <Figure shapes={BACK} fill={fill} label="Back" onHover={setHover} />
      </div>
      <ul className="flex-1 min-w-[180px] max-w-xs space-y-2">
        {[...PARTS].sort((a, b) => (sets[b] ?? 0) - (sets[a] ?? 0)).map(p => {
          const v = sets[p] ?? 0
          return (
            <li key={p} onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)} style={{ opacity: hover && hover !== p ? 0.45 : 1 }}>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: '#F5F5F5' }}>{p}</span>
                <span style={{ color: 'var(--color-text-subtle)', fontFamily: 'var(--font-mono)' }}>{Math.round(v)} sets{total ? ` · ${Math.round((v / total) * 100)}%` : ''}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#242424' }}>
                <div className="h-full rounded-full lrr-grow" style={{ width: `${(v / max) * 100}%`, background: ACTIVITY_COLORS.lift }} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
