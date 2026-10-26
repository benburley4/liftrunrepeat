'use client'

import { useState } from 'react'

export interface Slice { label: string; value: number; color: string }

/** Small SVG donut with a legend; hovering a slice or legend row highlights it. */
export default function Donut({ title, slices, size = 120 }: { title: string; slices: Slice[]; size?: number }) {
  const [active, setActive] = useState<string | null>(null)
  const total = slices.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null
  const cx = size / 2, cy = size / 2, r = size / 2 - 2, hole = r * 0.56
  // Start/end angle of each slice, clockwise from 12 o'clock.
  const arcs = slices.reduce<{ a0: number; a1: number }[]>((acc, d) => {
    const a0 = acc.length ? acc[acc.length - 1].a1 : -Math.PI / 2
    return [...acc, { a0, a1: a0 + (d.value / total) * 2 * Math.PI }]
  }, [])
  const focus = slices.find(s => s.label === active)

  return (
    <div>
      <p className="text-xs font-bold uppercase mb-2.5" style={{ color: '#A0A0A0', fontFamily: 'var(--font-heading)', letterSpacing: '0.08em' }}>{title}</p>
      <div className="flex items-center gap-3">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
            aria-label={`${title}: ${slices.map(s => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(', ')}`}>
            {slices.map((d, i) => {
              const { a0, a1 } = arcs[i]
              const sweep = a1 - a0
              const dim = active !== null && active !== d.label
              const common = { fill: d.color, opacity: dim ? 0.25 : 1, onMouseEnter: () => setActive(d.label), onMouseLeave: () => setActive(null), style: { transition: 'opacity 0.15s' } }
              if (sweep >= 2 * Math.PI - 0.001) return <circle key={d.label} cx={cx} cy={cy} r={r} {...common} />
              const x1 = cx + r * Math.cos(a0), y1 = cy + r * Math.sin(a0)
              const x2 = cx + r * Math.cos(a1), y2 = cy + r * Math.sin(a1)
              return <path key={d.label} d={`M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${sweep > Math.PI ? 1 : 0},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`} {...common} />
            })}
            <circle cx={cx} cy={cy} r={hole} fill="#1A1A1A" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-base font-black" style={{ color: focus?.color ?? '#F5F5F5', fontFamily: 'var(--font-mono)' }}>
              {focus ? `${Math.round((focus.value / total) * 100)}%` : total}
            </span>
            <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{focus ? focus.label : 'sets'}</span>
          </div>
        </div>
        <ul className="flex flex-col gap-1">
          {slices.map(d => (
            <li key={d.label} className="flex items-center gap-1.5" onMouseEnter={() => setActive(d.label)} onMouseLeave={() => setActive(null)}
              style={{ opacity: active !== null && active !== d.label ? 0.4 : 1 }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#A0A0A0', flex: 1 }}>{d.label}</span>
              <span style={{ fontSize: 11, color: '#8A8A8A', fontFamily: 'var(--font-mono)', paddingLeft: 6 }}>{Math.round((d.value / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
