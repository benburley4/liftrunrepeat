'use client'

import { useMemo, useState } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import StatTile from '@/components/ui/StatTile'
import { stepsSummary, stepsTotals, weeklySteps, monthlySteps, footEfficiencyByMonth, DEFAULT_STEP_GOAL } from '@/lib/activity'
import type { ZeppDay } from '@/lib/recovery'
import type { SessionData } from '@/lib/computeStats'
import { chartTooltipStyle, axisProps, fmtDay, fmtMonth, cardStyle, STEPS_COLOR } from './progressStyle'
import { shiftDays } from '@/lib/progressRange'
import GoalCalendar from './GoalCalendar'
import { useChartAnimation } from './kit'
import type { RangeCtx } from './types'

/** The daily chart shows at most a year of bars; longer ranges use the weekly and monthly charts. */
const MAX_DAILY = 365

type Mode = 'avg' | 'total' | 'km'
const MODES: { id: Mode; label: string }[] = [
  { id: 'avg', label: 'Average' },
  { id: 'total', label: 'Total' },
  { id: 'km', label: 'Distance' },
]

function Heading({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-xl font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>{children}</h3>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>{sub}</p>}
    </div>
  )
}

function Pills<T extends string | number>({ options, value, onChange, label }: {
  options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string
}) {
  return (
    <div className="flex gap-2" role="group" aria-label={label}>
      {options.map(o => (
        <button key={String(o.id)} onClick={() => onChange(o.id)} aria-pressed={value === o.id}
          className="rounded-full px-3 py-1 text-xs"
          style={{
            background: value === o.id ? 'rgba(0,191,165,0.12)' : '#242424',
            border: `1px solid ${value === o.id ? 'rgba(0,191,165,0.4)' : '#2E2E2E'}`,
            color: value === o.id ? '#00BFA5' : '#A0A0A0',
          }}>{o.label}</button>
      ))}
    </div>
  )
}

const fmtN = (n: number | null) => (n == null ? '–' : n.toLocaleString())
const fmtBig = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n.toLocaleString())
const fmtKm = (n: number) => (n >= 1000 ? Math.round(n).toLocaleString() : n.toLocaleString())
const kAxis = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))

export default function StepsTab({ rows, sessions, ctx }: { rows: ZeppDay[]; sessions: SessionData[]; ctx: RangeCtx }) {
  const today = ctx.today
  const anim = useChartAnimation()
  const [mode, setMode] = useState<Mode>('avg')
  const summary = useMemo(() => stepsSummary(rows, today), [rows, today])
  const totals = useMemo(() => stepsTotals(rows, today), [rows, today])
  const goal = rows.findLast(r => r.step_goal)?.step_goal || DEFAULT_STEP_GOAL

  const daily = useMemo(() => {
    const cap = shiftDays(today, -(MAX_DAILY - 1))
    const f = ctx.span.start > cap ? ctx.span.start : cap
    return rows.filter(r => r.date >= f && r.date <= today && r.steps)
      .map(r => ({ date: r.date, label: fmtDay(r.date), steps: r.steps, km: r.distance_m != null ? Math.round(r.distance_m / 100) / 10 : null }))
  }, [rows, ctx.span.start, today])
  const weekCount = Math.max(8, Math.min(104, ctx.buckets[0]?.key.length === 7 ? 104 : ctx.buckets.length))
  const weekly = useMemo(() => weeklySteps(rows, today, weekCount).map(w => ({ ...w, label: fmtDay(w.key) })), [rows, today, weekCount])
  const monthly = useMemo(() => monthlySteps(rows, today).map(m => ({ ...m, label: fmtMonth(m.key) })), [rows, today])
  const gait = useMemo(() => footEfficiencyByMonth(sessions).filter(m => m.cadence || m.strideCm).map(m => ({ ...m, label: fmtMonth(m.month) })), [sessions])

  if (!summary.daysTracked) {
    return (
      <div className="rounded-xl p-12 text-center" style={cardStyle}>
        <p className="text-sm font-semibold" style={{ color: '#A0A0A0' }}>No step data yet.</p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>Steps come from your connected watch.</p>
      </div>
    )
  }

  const t = totals.steps, k = totals.km
  const tiles: { value: string; label: string }[] =
    mode === 'avg' ? [
      { value: fmtN(summary.today), label: 'Steps today' },
      { value: fmtN(summary.avg7), label: '7-day average' },
      { value: fmtN(summary.avg30), label: '30-day average' },
      { value: summary.goalHitPct != null ? `${summary.goalHitPct}%` : '–', label: `Days at goal (${goal.toLocaleString()})` },
      { value: fmtN(summary.monthAvg), label: 'This month, avg/day' },
      { value: fmtN(summary.yearAvg), label: 'This year, avg/day' },
      { value: fmtBig(summary.totalSteps), label: `All-time steps · ${summary.daysTracked} days` },
      { value: fmtKm(summary.totalKm), label: 'All-time km walked' },
    ] : mode === 'total' ? [
      { value: fmtN(t.today), label: 'Steps today' },
      { value: fmtN(t.week), label: 'This week (from Monday)' },
      { value: fmtN(t.d7), label: 'Last 7 days' },
      { value: fmtN(t.d30), label: 'Last 30 days' },
      { value: fmtN(t.month), label: 'This month' },
      { value: fmtBig(t.year), label: 'This year' },
      { value: fmtBig(t.all), label: `All time · ${summary.daysTracked} days` },
      { value: summary.goalHitPct != null ? `${summary.goalHitPct}%` : '–', label: `Days at goal (${goal.toLocaleString()})` },
    ] : [
      { value: fmtKm(k.today), label: 'km today' },
      { value: fmtKm(k.week), label: 'km this week (from Monday)' },
      { value: fmtKm(k.d7), label: 'km last 7 days' },
      { value: fmtKm(k.d30), label: 'km last 30 days' },
      { value: fmtKm(k.month), label: 'km this month' },
      { value: fmtKm(k.year), label: 'km this year' },
      { value: fmtKm(k.all), label: 'km all time' },
      { value: String(Math.round((k.d30 / 30) * 10) / 10), label: 'km/day, 30-day average' },
    ]

  const periodKey = mode === 'avg' ? 'avg' : mode === 'total' ? 'total' : 'km'
  const periodFmt = (v: unknown) => mode === 'km' ? `${v} km` : mode === 'total' ? `${Number(v).toLocaleString()} steps` : `${Number(v).toLocaleString()} /day`
  const periodName = mode === 'avg' ? 'Average' : mode === 'total' ? 'Total' : 'Distance'

  return (
    <div className="space-y-6">
      <Pills options={MODES} value={mode} onChange={setMode} label="Steps view" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map(tile => <StatTile key={tile.label} value={tile.value} label={tile.label} animate={false} />)}
      </div>
      {mode === 'avg' && summary.best && (
        <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
          Best day: <span style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>{summary.best.steps.toLocaleString()}</span> steps on {fmtDay(summary.best.date)}
        </p>
      )}

      <div className="rounded-xl p-5" style={cardStyle}>
        <Heading sub="Days at your step goal over the last 6 months">Goal Calendar</Heading>
        <GoalCalendar rows={rows} today={today} />
      </div>

      <div className="rounded-xl p-5" style={cardStyle}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Heading sub={mode === 'km' ? 'Walking distance per day' : `Dashed line = your goal of ${goal.toLocaleString()} steps`}>
            {mode === 'km' ? 'Daily Distance' : 'Daily Steps'}
          </Heading>
          <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{ctx.range === 'all' || ctx.range === '1y' ? 'Last 12 months' : ctx.label}</span>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily} margin={{ top: 5, right: 8, left: 0, bottom: 0 }} barCategoryGap={1}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
              <XAxis dataKey="label" {...axisProps} minTickGap={24} />
              <YAxis {...axisProps} width={44} tickFormatter={mode === 'km' ? undefined : kAxis} />
              <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                formatter={(v: unknown) => mode === 'km' ? [`${v} km`, 'Distance'] : [Number(v).toLocaleString(), 'Steps']} />
              {mode !== 'km' && <ReferenceLine y={goal} stroke="#8A8A8A" strokeDasharray="5 4" />}
              <Bar dataKey={mode === 'km' ? 'km' : 'steps'} fill={STEPS_COLOR} radius={[2, 2, 0, 0]} {...anim} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl p-5" style={cardStyle}>
          <Heading sub={mode === 'avg' ? `Average steps per day, by week (last ${weekCount} weeks)` : mode === 'total' ? `Total steps per week (last ${weekCount} weeks)` : `Walking km per week (last ${weekCount} weeks)`}>
            {mode === 'avg' ? 'Weekly Average' : mode === 'total' ? 'Weekly Total' : 'Weekly Distance'}
          </Heading>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
                <XAxis dataKey="label" {...axisProps} minTickGap={24} />
                <YAxis {...axisProps} width={44} tickFormatter={mode === 'km' ? undefined : kAxis} />
                <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} labelFormatter={l => `Week of ${l}`}
                  formatter={(v: unknown) => [periodFmt(v), periodName]} />
                {mode === 'avg' && <ReferenceLine y={goal} stroke="#8A8A8A" strokeDasharray="5 4" />}
                <Bar dataKey={periodKey} fill={STEPS_COLOR} radius={[3, 3, 0, 0]} {...anim} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl p-5" style={cardStyle}>
          <Heading sub={mode === 'avg' ? 'Average steps per day, by month' : mode === 'total' ? 'Total steps per month' : 'Walking km per month'}>
            Monthly
          </Heading>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} width={44} tickFormatter={mode === 'km' ? undefined : kAxis} />
                <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  formatter={(v: unknown) => [periodFmt(v), periodName]} />
                {mode === 'avg' && <ReferenceLine y={goal} stroke="#8A8A8A" strokeDasharray="5 4" />}
                <Bar dataKey={periodKey} fill={STEPS_COLOR} radius={[3, 3, 0, 0]} {...anim} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {gait.length > 1 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl p-5" style={cardStyle}>
            <Heading sub="Walking cadence on recorded walks & hikes of 3 km+, monthly">Cadence</Heading>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={gait} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} width={60} domain={['dataMin - 5', 'dataMax + 5']} unit=" spm" />
                  <Tooltip {...chartTooltipStyle} formatter={(v: unknown) => [`${v} steps/min`, 'Cadence']} />
                  <Line dataKey="cadence" stroke={STEPS_COLOR} strokeWidth={2} dot={{ r: 3 }} connectNulls {...anim} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-xl p-5" style={cardStyle}>
            <Heading sub="Average stride length on the same walks & hikes">Stride Length</Heading>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={gait} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} width={56} domain={['dataMin - 5', 'dataMax + 5']} unit=" cm" />
                  <Tooltip {...chartTooltipStyle} formatter={(v: unknown) => [`${v} cm`, 'Stride']} />
                  <Line dataKey="strideCm" stroke={STEPS_COLOR} strokeWidth={2} dot={{ r: 3 }} connectNulls {...anim} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
