'use client'

import { useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts'
import type { SessionData } from '@/lib/computeStats'
import { activityByBucket, strengthShare } from '@/lib/progressData'
import BalanceRing from './BalanceRing'
import { ChartCard, ClickHint, EmptyState, LegendDot, useChartAnimation } from './kit'
import { ACTIVITY_COLORS, GHOST, HYBRID_COLORS, axisProps, chartTooltipStyle } from './progressStyle'
import { onBucketClick, type RangeCtx } from './types'

const TARGET = { low: 30, high: 70 }

/**
 * Strength vs endurance. With watch heart-rate data both sides share one unit
 * (HR load); without it the top half is tonnes lifted and the bottom half km.
 */
export default function HybridTab({ history, ctx }: { history: SessionData[]; ctx: RangeCtx }) {
  const anim = useChartAnimation()
  const cur = useMemo(() => activityByBucket(history, ctx.buckets, ctx.mults), [history, ctx.buckets, ctx.mults])
  const prev = useMemo(() => (ctx.compare ? activityByBucket(history, ctx.prev, ctx.mults) : null), [history, ctx.prev, ctx.compare, ctx.mults])

  if (history.length === 0) return <EmptyState title="No sessions logged yet." hint="Log both lifting and running sessions to see your balance." />

  const useLoad = cur.some(b => b.strengthLoad + b.cardioLoad > 0)
  const top = (b: (typeof cur)[number]) => (useLoad ? b.strengthLoad : Math.round(b.lift / 100) / 10)
  const bottom = (b: (typeof cur)[number]) => (useLoad ? b.cardioLoad : b.run + b.hike)
  const units = useLoad ? { top: '', bottom: '', name: 'HR load' } : { top: 't', bottom: ' km', name: '' }
  const unit = ctx.buckets[0]?.key.length === 7 ? 'month' : 'week'

  const mirror = ctx.buckets.map((b, i) => ({
    label: b.label,
    strength: top(cur[i]),
    endurance: -bottom(cur[i]),
    prevStrength: prev ? top(prev[i]) : null,
    prevEndurance: prev ? -bottom(prev[i]) : null,
  }))
  const share = ctx.buckets.map((b, i) => ({ label: b.label, share: strengthShare(cur[i]), prev: prev ? strengthShare(prev[i]) : null }))
  const totals = cur.reduce((a, b) => ({ s: a.s + b.strengthSessions, e: a.e + b.enduranceSessions }), { s: 0, e: 0 })
  const fmtAxis = (v: number) => (v >= 0 ? `${v}${units.top}` : `${-v}${units.bottom}`)

  return (
    <div className="space-y-6">
      <ChartCard title="Strength vs Endurance"
        sub={useLoad
          ? `Heart-rate load from your watch per ${unit} (minutes in each HR zone × zone 1–6). Lifting above the line, cardio below, on one scale.`
          : `Per ${unit}: tonnes lifted above the line, km run and hiked below. Each half has its own unit.`}
        actions={<div className="flex flex-wrap gap-3">
          <LegendDot color={HYBRID_COLORS.strength} label={useLoad ? 'Strength / hybrid' : 'Tonnes lifted'} />
          <LegendDot color={HYBRID_COLORS.cardio} label={useLoad ? 'Cardio' : 'Km on foot'} />
          {ctx.compare && <LegendDot color={GHOST} label="Previous period" />}
        </div>}>
        <div className="h-72" data-noswipe>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mirror} stackOffset="sign" margin={{ top: 5, right: 8, left: 0, bottom: 0 }} barGap={1}
              onClick={onBucketClick(ctx.buckets, ctx.openBucket)} style={{ cursor: 'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
              <XAxis dataKey="label" {...axisProps} minTickGap={16} />
              <YAxis {...axisProps} width={52} tickFormatter={fmtAxis} />
              <ReferenceLine y={0} stroke="#5A5A5A" />
              <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                formatter={(v: unknown, n: unknown) => {
                  const x = Math.abs(Number(v))
                  const isTop = n === 'strength' || n === 'prevStrength'
                  const label = { strength: useLoad ? 'Strength load' : 'Lifted', endurance: useLoad ? 'Cardio load' : 'On foot', prevStrength: 'Previous: strength', prevEndurance: 'Previous: endurance' }[String(n)] ?? String(n)
                  return [useLoad ? `${x}` : isTop ? `${x} t` : `${x} km`, label]
                }} />
              {ctx.compare && <Bar dataKey="prevStrength" stackId="prev" fill={GHOST} radius={[3, 3, 0, 0]} {...anim} />}
              {ctx.compare && <Bar dataKey="prevEndurance" stackId="prev" fill={GHOST} radius={[0, 0, 3, 3]} {...anim} />}
              <Bar dataKey="strength" stackId="cur" fill={HYBRID_COLORS.strength} radius={[3, 3, 0, 0]} {...anim} />
              <Bar dataKey="endurance" stackId="cur" fill={HYBRID_COLORS.cardio} radius={[0, 0, 3, 3]} {...anim} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ClickHint />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <ChartCard title="Strength Share" sub={`Strength sessions as a share of all training per ${unit}. The shaded band (${TARGET.low}–${TARGET.high}%) is a balanced hybrid week.`}>
          <div className="h-60" data-noswipe>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={share} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
                <ReferenceArea y1={TARGET.low} y2={TARGET.high} fill={ACTIVITY_COLORS.hybrid} fillOpacity={0.08} stroke="none" />
                <XAxis dataKey="label" {...axisProps} minTickGap={16} />
                <YAxis {...axisProps} width={40} unit="%" domain={[0, 100]} ticks={[0, 30, 50, 70, 100]} />
                <Tooltip {...chartTooltipStyle} formatter={(v: unknown, n: unknown) => [`${v}%`, n === 'prev' ? 'Previous period' : 'Strength share']} />
                {ctx.compare && <Line dataKey="prev" stroke={GHOST} strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls {...anim} />}
                <Line dataKey="share" stroke={ACTIVITY_COLORS.hybrid} strokeWidth={2.5} dot={{ r: 3, fill: ACTIVITY_COLORS.hybrid }} connectNulls {...anim} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Balance" sub={`All sessions, ${ctx.label}. Hybrid sessions count on both sides.`}>
          <BalanceRing strength={totals.s} endurance={totals.e} />
        </ChartCard>
      </div>
    </div>
  )
}
