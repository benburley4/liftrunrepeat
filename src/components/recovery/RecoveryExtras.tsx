'use client'

import { useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import Card from '@/components/ui/Card'
import { READINESS_THRESHOLDS, lastDays, weeklyLoadRecovery, withRollingMean, type ZeppDay } from '@/lib/recovery'
import { chartTooltipStyle, axisProps, BASELINE_GREY, fmtDay } from './chartStyle'

function ChartCard({ title, sub, children, height = 'h-48' }: { title: string; sub: string; children: React.ReactNode; height?: string }) {
  return (
    <Card hover={false}>
      <p className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>{title}</p>
      <p className="text-xs mb-4" style={{ color: 'var(--color-text-subtle)' }}>{sub}</p>
      <div className={height}>{children}</div>
    </Card>
  )
}

function MiniLine({ data, dataKey, unit, color = '#00BFA5', domain }: {
  data: Record<string, unknown>[]; dataKey: string; unit: string; color?: string; domain?: [number | string, number | string]
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
        <XAxis dataKey="label" {...axisProps} minTickGap={28} />
        <YAxis {...axisProps} width={40} domain={domain ?? ['dataMin - 2', 'dataMax + 2']} tickFormatter={v => String(Math.round(v))} />
        <Tooltip {...chartTooltipStyle} formatter={(v: unknown) => `${v}${unit}`} />
        <Line dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

const WEIGHT_TREND = '#D946EF'   // magenta trend over grey readings

/** Load vs recovery, night vitals and weight — below the main Recovery trends. */
export default function RecoveryExtras({ rows, today }: { rows: ZeppDay[]; today: string }) {
  const weeks = useMemo(() => weeklyLoadRecovery(rows, today, 16).map(w => ({ ...w, label: fmtDay(w.week) })), [rows, today])
  const night = useMemo(() => lastDays(rows, 90, today).map(r => ({ ...r, label: fmtDay(r.date) })), [rows, today])
  const weight = useMemo(() => {
    const w = rows.filter(r => r.weight_kg != null && r.date <= today)
    const avg = withRollingMean(w, 'weight_kg', 7)
    return w.map((r, i) => ({ label: fmtDay(r.date), kg: r.weight_kg, avg: avg[i] }))
  }, [rows, today])

  const hasNight = night.some(r => r.spo2_score != null || r.resp_rate != null || r.stress_avg != null)

  return (
    <div className="space-y-6">
      {weeks.some(w => w.load != null) && (
        <Card hover={false}>
          <p className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>Load vs recovery</p>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-subtle)' }}>
            Weekly average watch training load (top) against readiness (bottom), 16 weeks. Load climbing while readiness falls for 2+ weeks = time to deload.
          </p>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeks} syncId="load-recovery" margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
                <XAxis dataKey="label" {...axisProps} hide />
                <YAxis {...axisProps} width={40} />
                <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} labelFormatter={l => `Week of ${l}`} formatter={(v: unknown) => [v as number, 'Training load']} />
                <Bar dataKey="load" fill="#A78BFA" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="h-36 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeks} syncId="load-recovery" margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} width={40} domain={[30, 100]} />
                <Tooltip {...chartTooltipStyle} labelFormatter={l => `Week of ${l}`} formatter={(v: unknown) => [v as number, 'Avg readiness']} />
                <ReferenceLine y={READINESS_THRESHOLDS.planned} stroke={BASELINE_GREY} strokeDasharray="5 4" />
                <Line dataKey="readiness" stroke="#00BFA5" strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {hasNight && (
        <div className="grid gap-6 lg:grid-cols-3">
          <ChartCard title="Breathing rate" sub="Overnight breaths/min, 90 days — a rise above normal is an early illness sign">
            <MiniLine data={night} dataKey="resp_rate" unit=" /min" />
          </ChartCard>
          <ChartCard title="Night SpO₂ score" sub="Overnight blood-oxygen score, 90 days">
            <MiniLine data={night} dataKey="spo2_score" unit="" domain={[50, 100]} />
          </ChartCard>
          <ChartCard title="Daytime stress" sub="Average stress score 0–100, 90 days">
            <MiniLine data={night} dataKey="stress_avg" unit="" domain={[0, 'dataMax + 5']} />
          </ChartCard>
        </div>
      )}

      {weight.length > 1 && (
        <ChartCard title="Bodyweight" sub="Smart-scale readings in kg (grey dots) with the 7-reading average trend (magenta)" height="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weight} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
              <XAxis dataKey="label" {...axisProps} minTickGap={28} />
              <YAxis {...axisProps} width={40} domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={v => String(Math.round(v))} />
              <Tooltip {...chartTooltipStyle} formatter={(v: unknown, n: unknown) => [`${v} kg`, n === 'avg' ? '7-reading avg' : 'Weight']} />
              <Line dataKey="kg" stroke="#8A8A8A" strokeWidth={0} dot={{ r: 2.5, fill: '#8A8A8A', stroke: 'none' }} activeDot={{ r: 4, fill: '#F5F5F5' }} isAnimationActive={false} />
              <Line dataKey="avg" stroke={WEIGHT_TREND} strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: WEIGHT_TREND }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  )
}
