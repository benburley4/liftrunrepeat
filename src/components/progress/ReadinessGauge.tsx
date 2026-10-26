'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import Sparkline from './Sparkline'
import { useReducedMotion } from './kit'
import { cardStyle } from './progressStyle'

/** Ring gauge (0–100) for today's readiness with a 14-day trend and its drivers. */
export default function ReadinessGauge({ score, color, call, source, trend, children, detailsHref }: {
  score: number
  color: string
  call: string
  source: string
  trend: { date: string; value: number | null }[]
  children?: ReactNode
  detailsHref?: string
}) {
  const reduced = useReducedMotion()
  const size = 132, stroke = 11, r = (size - stroke) / 2, c = 2 * Math.PI * r
  // 270° arc, open at the bottom.
  const arc = c * 0.75
  const filled = arc * Math.max(0, Math.min(100, score)) / 100
  const vals = trend.map(t => t.value)
  const nums = vals.filter((v): v is number => v != null)
  const avg = nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null

  return (
    <section id="readiness" className="rounded-xl p-5 lrr-reveal scroll-mt-32" style={cardStyle} aria-labelledby="readiness-h">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 id="readiness-h" className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-subtle)', fontFamily: 'var(--font-heading)' }}>
          Readiness — {source}
        </h3>
        {detailsHref && <Link href={detailsHref} className="text-xs" style={{ color: '#00BFA5' }}>Recovery details</Link>}
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Readiness ${score} out of 100: ${call}`}>
            <g transform={`rotate(135 ${size / 2} ${size / 2})`}>
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2A2A2A" strokeWidth={stroke}
                strokeDasharray={`${arc} ${c}`} strokeLinecap="round" />
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={`${filled} ${c}`} strokeLinecap="round"
                className={reduced ? undefined : 'lrr-ring'} style={{ ['--lrr-ring-from' as string]: `0 ${c}` }} />
            </g>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black" style={{ color, fontFamily: 'var(--font-mono)' }}>{score}</span>
            <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>of 100</span>
          </div>
        </div>
        <div className="flex-1 min-w-[200px]">
          <p className="text-lg font-black uppercase" style={{ color, fontFamily: 'var(--font-heading)' }}>{call}</p>
          <div className="mt-2 flex items-end gap-3">
            <Sparkline values={vals} color={color} width={180} height={44} label="Readiness over the last 14 days" />
            <div className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
              <p>14 days</p>
              {avg != null && <p style={{ fontFamily: 'var(--font-mono)', color: '#A0A0A0' }}>avg {avg}</p>}
            </div>
          </div>
          {children && <div className="flex flex-wrap gap-2 mt-3">{children}</div>}
        </div>
      </div>
    </section>
  )
}
