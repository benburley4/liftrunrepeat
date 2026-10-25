'use client'

import { useMemo, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import Card from '@/components/ui/Card'
import StatTile from '@/components/ui/StatTile'
import { READINESS_THRESHOLDS, lastDays, withRollingMean, periodChange, ZeppDay } from '@/lib/recovery'
import { chartTooltipStyle, axisProps, BASELINE_GREY, SLEEP_STAGE_COLORS, fmtDay } from './chartStyle'

const RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '180 days', days: 180 },
  { label: '1 year', days: 365 },
  { label: 'All', days: null },
] as const

function ChartCard({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <Card hover={false}>
      <p className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>{title}</p>
      <p className="text-xs mb-4" style={{ color: 'var(--color-text-subtle)' }}>{sub}</p>
      <div className="h-56">{children}</div>
    </Card>
  )
}

/** " · +3 bpm" / " · ±0" change suffix for a stat label ('' when unknown). */
function signed(n: number | null, unit = '', dp = 0): string {
  if (n == null) return ''
  const r = dp ? Number(n.toFixed(dp)) : Math.round(n)
  if (r === 0) return ' · ±0'
  return ` · ${r > 0 ? '+' : ''}${dp ? r.toFixed(dp) : r}${unit}`
}

export default function RecoveryTrends({ rows, today }: { rows: ZeppDay[]; today: string }) {
  const [range, setRange] = useState<number | null>(90)
  const [period, setPeriod] = useState<7 | 30>(7)

  const data = useMemo(() => {
    const sel = lastDays(rows, range, today)
    const avg7 = withRollingMean(sel, 'readiness', 7)
    return sel.map((r, i) => ({
      ...r,
      label: fmtDay(r.date),
      readiness7: avg7[i],
      rhr: r.sleep_rhr ?? r.resting_hr,
      deepH: r.deep_min != null ? r.deep_min / 60 : null,
      remH: r.rem_min != null ? r.rem_min / 60 : null,
      lightH: r.light_min != null ? r.light_min / 60 : null,
      awakeH: r.awake_min != null ? r.awake_min / 60 : null,
    }))
  }, [rows, range, today])

  // Few points (e.g. 7 days) read better with each day marked.
  const showDots = data.length <= 31

  const cmp = {
    readiness: periodChange(rows, 'readiness', period, today),
    hrv: periodChange(rows, 'sleep_hrv_ms', period, today),
    rhr: periodChange(rows, 'sleep_rhr', period, today),
    sleep: periodChange(rows, 'sleep_min', period, today),
  }

  const tooltipLabel = (_: unknown, p: readonly { payload?: { date?: string } }[] | undefined) =>
    p?.[0]?.payload?.date ? fmtDay(p[0].payload.date) : ''
  const hours = (v: unknown) => `${Number(v).toFixed(1)} h`

  return (
    <div className="space-y-6">
      {/* Last 7 / 30 days vs the period before */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--color-text-subtle)' }}>
            Last {period} days vs previous {period}
          </p>
          <div className="flex gap-2" role="group" aria-label="Comparison period">
            {([7, 30] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} aria-pressed={period === p}
                className="rounded-full px-3 py-1 text-xs"
                style={{
                  background: period === p ? 'rgba(0,191,165,0.12)' : '#1E1E1E',
                  border: `1px solid ${period === p ? 'rgba(0,191,165,0.4)' : '#2E2E2E'}`,
                  color: period === p ? '#00BFA5' : '#A0A0A0',
                }}>{p} days</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile value={cmp.readiness.current != null ? Math.round(cmp.readiness.current) : '–'} label={`Avg readiness${signed(cmp.readiness.change)}`} />
          <StatTile value={cmp.hrv.current != null ? Math.round(cmp.hrv.current) : '–'} label={`HRV, ms${signed(cmp.hrv.change)}`} />
          <StatTile value={cmp.rhr.current != null ? Math.round(cmp.rhr.current) : '–'} label={`Sleeping HR, bpm${signed(cmp.rhr.change)}`} />
          <StatTile value={cmp.sleep.current != null ? (cmp.sleep.current / 60).toFixed(1) : '–'} label={`Sleep, hours${signed(cmp.sleep.change != null ? cmp.sleep.change / 60 : null, '', 1)}`} />
        </div>
      </div>

      {/* Range filter — one row above the charts */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Time range">
        {RANGES.map(r => {
          const active = range === r.days
          return (
            <button
              key={r.label}
              onClick={() => setRange(r.days)}
              aria-pressed={active}
              className="rounded-full px-4 py-1.5 text-sm transition-colors"
              style={{
                background: active ? 'rgba(0,191,165,0.12)' : '#1E1E1E',
                border: `1px solid ${active ? 'rgba(0,191,165,0.4)' : '#2E2E2E'}`,
                color: active ? '#00BFA5' : '#A0A0A0',
              }}
            >
              {r.label}
            </button>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Readiness" sub={`Daily score with 7-day average · bands at ${READINESS_THRESHOLDS.easy} / ${READINESS_THRESHOLDS.planned} / ${READINESS_THRESHOLDS.go}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
              <XAxis dataKey="label" {...axisProps} minTickGap={24} />
              <YAxis {...axisProps} domain={[0, 100]} ticks={[0, READINESS_THRESHOLDS.easy, READINESS_THRESHOLDS.planned, READINESS_THRESHOLDS.go, 100]} />
              <Tooltip {...chartTooltipStyle} labelFormatter={tooltipLabel} />
              <Legend itemSorter={null} wrapperStyle={{ fontSize: 11, color: '#A0A0A0' }} />
              {[READINESS_THRESHOLDS.easy, READINESS_THRESHOLDS.planned, READINESS_THRESHOLDS.go].map(y => (
                <ReferenceLine key={y} y={y} stroke="#3E3E3E" strokeDasharray="2 4" />
              ))}
              <Line isAnimationActive={false} name="Readiness" type="monotone" dataKey="readiness" stroke="#00BFA5" strokeWidth={2} dot={showDots ? { r: 3 } : false} connectNulls activeDot={{ r: 5 }} />
              <Line isAnimationActive={false} name="7-day avg" type="monotone" dataKey="readiness7" stroke={BASELINE_GREY} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Overnight HRV" sub="Higher than your baseline = recovered; a sustained drop = accumulated fatigue">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
              <XAxis dataKey="label" {...axisProps} minTickGap={24} />
              <YAxis {...axisProps} domain={['dataMin - 5', 'dataMax + 5']} unit=" ms" width={60} />
              <Tooltip {...chartTooltipStyle} labelFormatter={tooltipLabel} formatter={(v: unknown) => `${Math.round(Number(v))} ms`} />
              <Legend itemSorter={null} wrapperStyle={{ fontSize: 11, color: '#A0A0A0' }} />
              <Line isAnimationActive={false} name="HRV" type="monotone" dataKey="sleep_hrv_ms" stroke="#00BFA5" strokeWidth={2} dot={showDots ? { r: 3 } : false} connectNulls activeDot={{ r: 5 }} />
              <Line isAnimationActive={false} name="Baseline" type="monotone" dataKey="hrv_baseline_ms" stroke={BASELINE_GREY} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Sleeping heart rate" sub="Lower than baseline = fitter / recovered; a rising trend = strain, illness or poor sleep">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
              <XAxis dataKey="label" {...axisProps} minTickGap={24} />
              <YAxis {...axisProps} domain={['dataMin - 3', 'dataMax + 3']} unit=" bpm" width={64} />
              <Tooltip {...chartTooltipStyle} labelFormatter={tooltipLabel} formatter={(v: unknown) => `${Math.round(Number(v))} bpm`} />
              <Legend itemSorter={null} wrapperStyle={{ fontSize: 11, color: '#A0A0A0' }} />
              <Line isAnimationActive={false} name="Sleeping HR" type="monotone" dataKey="rhr" stroke="#00BFA5" strokeWidth={2} dot={showDots ? { r: 3 } : false} connectNulls activeDot={{ r: 5 }} />
              <Line isAnimationActive={false} name="Baseline" type="monotone" dataKey="rhr_baseline" stroke={BASELINE_GREY} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Sleep" sub="Main sleep each night by stage · dashed line at 7 hours">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }} barCategoryGap={1}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
              <XAxis dataKey="label" {...axisProps} minTickGap={24} />
              <YAxis {...axisProps} unit=" h" width={48} />
              <Tooltip {...chartTooltipStyle} labelFormatter={tooltipLabel} formatter={hours} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Legend itemSorter={null} wrapperStyle={{ fontSize: 11, color: '#A0A0A0' }} />
              <ReferenceLine y={7} stroke={BASELINE_GREY} strokeDasharray="5 4" />
              <Bar isAnimationActive={false} name="Deep" dataKey="deepH" stackId="s" fill={SLEEP_STAGE_COLORS.deep} />
              <Bar isAnimationActive={false} name="REM" dataKey="remH" stackId="s" fill={SLEEP_STAGE_COLORS.rem} />
              <Bar isAnimationActive={false} name="Light" dataKey="lightH" stackId="s" fill={SLEEP_STAGE_COLORS.light} />
              <Bar isAnimationActive={false} name="Awake" dataKey="awakeH" stackId="s" fill={SLEEP_STAGE_COLORS.awake} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
