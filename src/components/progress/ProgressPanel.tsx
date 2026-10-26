'use client'

import { TrendingUp } from 'lucide-react'
import type { ProgressStats } from '@/lib/progressData'
import { ACTIVITY_COLORS, UP, DOWN } from './progressStyle'
import { useReducedMotion } from './kit'

function Delta({ pct }: { pct: number | null }) {
  if (pct === null || pct === 0) return <span className="text-xs" style={{ color: 'var(--color-text-subtle)', fontFamily: 'var(--font-mono)' }}>±0%</span>
  const up = pct > 0
  return (
    <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{
      background: up ? 'rgba(0,191,165,0.12)' : 'rgba(200,16,46,0.12)', color: up ? UP : DOWN, fontFamily: 'var(--font-mono)',
    }}>{up ? '▲' : '▼'} {Math.abs(pct)}%</span>
  )
}

/** Previous period as a faint bar, current period as a solid bar, on one scale. */
function PairedBars({ label, from, to, fromText, toText, pct, color }: {
  label: string; from: number; to: number; fromText: string; toText: string; pct: number | null; color: string
}) {
  const reduced = useReducedMotion()
  const max = Math.max(from, to) || 1
  const bar = (v: number, solid: boolean) => (
    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: '#242424' }}>
      <div className="h-full rounded-full lrr-grow" style={{
        width: `${Math.max(2, (v / max) * 100)}%`, background: solid ? color : `${color}55`,
        transition: reduced ? undefined : 'width 0.7s ease-out',
      }} />
    </div>
  )
  return (
    <div className="rounded-lg px-4 py-3" style={{ background: '#141414', border: '1px solid #2E2E2E' }}>
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-subtle)' }}>{label}</p>
        <Delta pct={pct} />
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
        {bar(from, false)}
        <span className="text-xs text-right" style={{ color: 'var(--color-text-subtle)', fontFamily: 'var(--font-mono)', minWidth: 56 }}>{fromText}</span>
        {bar(to, true)}
        <span className="text-sm font-bold text-right" style={{ color, fontFamily: 'var(--font-mono)', minWidth: 56 }}>{toText}</span>
      </div>
    </div>
  )
}

/** A two-point slope line: previous best → current best. */
function Slope({ from, to, color }: { from: number; to: number; color: string }) {
  const w = 64, h = 34
  const lo = Math.min(from, to), hi = Math.max(from, to), span = hi - lo || 1
  const y = (v: number) => (hi === lo ? h / 2 : 5 + (1 - (v - lo) / span) * (h - 10))
  return (
    <svg width={w} height={h} aria-hidden="true" style={{ flexShrink: 0 }}>
      <line x1={6} y1={y(from)} x2={w - 6} y2={y(to)} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <circle cx={6} cy={y(from)} r={3} fill="#1A1A1A" stroke={`${color}99`} strokeWidth={1.5} />
      <circle cx={w - 6} cy={y(to)} r={3.5} fill={color} />
    </svg>
  )
}

export default function ProgressPanel({ stats }: { stats: ProgressStats }) {
  return (
    <div className="rounded-xl p-5 mb-6 lrr-reveal" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} style={{ color: UP }} aria-hidden="true" />
          <span className="text-sm font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>Your Progress</span>
        </div>
        <span className="text-xs flex items-center gap-3" style={{ color: 'var(--color-text-subtle)' }}>
          <span className="inline-flex items-center gap-1"><span aria-hidden="true" style={{ width: 12, height: 6, borderRadius: 3, background: '#5A5A5A' }} />Previous 4 weeks</span>
          <span className="inline-flex items-center gap-1"><span aria-hidden="true" style={{ width: 12, height: 6, borderRadius: 3, background: '#F5F5F5' }} />Last 4 weeks</span>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <PairedBars label="Lift Volume" color={ACTIVITY_COLORS.lift} pct={stats.volume.pct}
          from={stats.volume.from} to={stats.volume.to}
          fromText={`${(stats.volume.from / 1000).toFixed(1)}t`} toText={`${(stats.volume.to / 1000).toFixed(1)}t`} />
        <PairedBars label="Running + Hiking" color={ACTIVITY_COLORS.run} pct={stats.km.pct}
          from={stats.km.from} to={stats.km.to} fromText={`${stats.km.from} km`} toText={`${stats.km.to} km`} />
        <PairedBars label="Sessions" color={ACTIVITY_COLORS.hybrid} pct={stats.sessions.pct}
          from={stats.sessions.from} to={stats.sessions.to} fromText={String(stats.sessions.from)} toText={String(stats.sessions.to)} />
      </div>

      {stats.lifts.length > 0 && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-subtle)' }}>Estimated 1RM — most-trained lifts</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {stats.lifts.map(l => {
              const c = l.pct !== null && l.pct < 0 ? DOWN : UP
              return (
                <div key={l.name} className="rounded-lg px-4 py-3 flex items-center justify-between gap-3" style={{ background: '#141414', border: '1px solid #2E2E2E' }}>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: '#F5F5F5' }}>{l.name}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-subtle)', fontFamily: 'var(--font-mono)' }}>{l.from} to {l.to} kg</p>
                    <div className="mt-1"><Delta pct={l.pct} /></div>
                  </div>
                  <Slope from={l.from} to={l.to} color={c} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
