'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { weeklyHybridLoad } from '@/lib/activity'
import type { SessionData } from '@/lib/computeStats'
import { chartTooltipStyle, axisProps, fmtDay, cardStyle, HYBRID_COLORS } from './progressStyle'

/**
 * Weekly heart-rate load from watch-recorded sessions, strength vs cardio on
 * one scale (zone minutes × zone weight). Replaces the old dual-axis km vs kg chart.
 */
export default function HybridLoadChart({ sessions, today }: { sessions: SessionData[]; today: string }) {
  const weeks = useMemo(() => weeklyHybridLoad(sessions, today, 12).map(w => ({ ...w, label: fmtDay(w.week) })), [sessions, today])
  const total = weeks.reduce((n, w) => n + w.strength + w.cardio, 0)
  if (!total) return null
  const strengthPct = Math.round((weeks.reduce((n, w) => n + w.strength, 0) / total) * 100)

  return (
    <div className="rounded-xl p-5" style={cardStyle}>
      <h3 className="text-xl font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>Training Load — 12 Weeks</h3>
      <p className="text-xs mt-1 mb-4" style={{ color: 'var(--color-text-subtle)' }}>
        Heart-rate load from your watch (minutes in each HR zone × zone 1–6), so lifting and cardio share one scale.
        Last 12 weeks: {strengthPct}% strength / {100 - strengthPct}% cardio.
      </p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeks} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} width={44} />
            <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} labelFormatter={l => `Week of ${l}`}
              formatter={(v: unknown, n: unknown) => [`${v} load`, String(n)]} />
            <Legend itemSorter={null} wrapperStyle={{ fontSize: 11, color: '#A0A0A0' }} />
            <Bar dataKey="strength" name="Strength / hybrid" stackId="load" fill={HYBRID_COLORS.strength} stroke="#1A1A1A" strokeWidth={1} isAnimationActive={false} />
            <Bar dataKey="cardio" name="Cardio (hikes, walks, runs)" stackId="load" fill={HYBRID_COLORS.cardio} stroke="#1A1A1A" strokeWidth={1} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
