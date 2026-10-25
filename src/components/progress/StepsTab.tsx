'use client'

import { useMemo, useState } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import StatTile from '@/components/ui/StatTile'
import { stepsSummary, weeklySteps, monthlySteps, footEfficiencyByMonth, DEFAULT_STEP_GOAL } from '@/lib/activity'
import type { ZeppDay } from '@/lib/recovery'
import type { SessionData } from '@/lib/computeStats'
import { chartTooltipStyle, axisProps, fmtDay, fmtMonth, cardStyle, STEPS_COLOR } from './progressStyle'

const RANGES = [{ label: '30 days', days: 30 }, { label: '90 days', days: 90 }, { label: '1 year', days: 365 }] as const

function Heading({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-xl font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>{children}</h3>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>{sub}</p>}
    </div>
  )
}

const fmtK = (n: number | null) => (n == null ? '–' : n.toLocaleString())

export default function StepsTab({ rows, sessions, today }: { rows: ZeppDay[]; sessions: SessionData[]; today: string }) {
  const [range, setRange] = useState<number>(90)
  const summary = useMemo(() => stepsSummary(rows, today), [rows, today])
  const goal = rows.findLast(r => r.step_goal)?.step_goal || DEFAULT_STEP_GOAL

  const daily = useMemo(() => {
    const from = new Date(`${today}T00:00:00Z`)
    from.setUTCDate(from.getUTCDate() - (range - 1))
    const f = from.toISOString().slice(0, 10)
    return rows.filter(r => r.date >= f && r.date <= today && r.steps).map(r => ({ date: r.date, label: fmtDay(r.date), steps: r.steps }))
  }, [rows, range, today])
  const weekly = useMemo(() => weeklySteps(rows, today, 26).map(w => ({ ...w, label: fmtDay(w.key) })), [rows, today])
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile value={fmtK(summary.today)} label="Steps today" animate={false} />
        <StatTile value={fmtK(summary.avg7)} label="7-day average" animate={false} />
        <StatTile value={fmtK(summary.avg30)} label="30-day average" animate={false} />
        <StatTile value={summary.goalHitPct != null ? `${summary.goalHitPct}%` : '–'} label={`Days at goal (${goal.toLocaleString()})`} animate={false} />
        <StatTile value={fmtK(summary.monthAvg)} label="This month, avg/day" animate={false} />
        <StatTile value={fmtK(summary.yearAvg)} label="This year, avg/day" animate={false} />
        <StatTile value={`${(summary.totalSteps / 1e6).toFixed(2)}M`} label={`All-time steps · ${summary.daysTracked} days`} animate={false} />
        <StatTile value={`${summary.totalKm.toLocaleString()}`} label="All-time km walked" animate={false} />
      </div>
      {summary.best && (
        <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
          Best day: <span style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>{summary.best.steps.toLocaleString()}</span> steps on {fmtDay(summary.best.date)}
        </p>
      )}

      <div className="rounded-xl p-5" style={cardStyle}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Heading sub={`Dashed line = your goal of ${goal.toLocaleString()} steps`}>Daily Steps</Heading>
          <div className="flex gap-2" role="group" aria-label="Time range">
            {RANGES.map(r => (
              <button key={r.days} onClick={() => setRange(r.days)} aria-pressed={range === r.days}
                className="rounded-full px-3 py-1 text-xs"
                style={{
                  background: range === r.days ? 'rgba(0,191,165,0.12)' : '#242424',
                  border: `1px solid ${range === r.days ? 'rgba(0,191,165,0.4)' : '#2E2E2E'}`,
                  color: range === r.days ? '#00BFA5' : '#A0A0A0',
                }}>{r.label}</button>
            ))}
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily} margin={{ top: 5, right: 8, left: 0, bottom: 0 }} barCategoryGap={1}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
              <XAxis dataKey="label" {...axisProps} minTickGap={24} />
              <YAxis {...axisProps} width={44} tickFormatter={v => `${Math.round(v / 1000)}k`} />
              <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v: unknown) => [Number(v).toLocaleString(), 'Steps']} />
              <ReferenceLine y={goal} stroke="#8A8A8A" strokeDasharray="5 4" />
              <Bar dataKey="steps" fill={STEPS_COLOR} radius={[2, 2, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl p-5" style={cardStyle}>
          <Heading sub="Average steps per day, by week (last 26 weeks)">Weekly Average</Heading>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
                <XAxis dataKey="label" {...axisProps} minTickGap={24} />
                <YAxis {...axisProps} width={44} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} labelFormatter={l => `Week of ${l}`}
                  formatter={(v: unknown) => [`${Number(v).toLocaleString()} /day`, 'Average']} />
                <ReferenceLine y={goal} stroke="#8A8A8A" strokeDasharray="5 4" />
                <Bar dataKey="avg" fill={STEPS_COLOR} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl p-5" style={cardStyle}>
          <Heading sub="Average steps per day and km walked, by month">Monthly</Heading>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} width={44} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  formatter={(v: unknown, _n: unknown, p: { payload?: { km?: number; total?: number } }) =>
                    [`${Number(v).toLocaleString()} /day · ${p.payload?.km ?? 0} km · ${(p.payload?.total ?? 0).toLocaleString()} total`, 'Average']} />
                <ReferenceLine y={goal} stroke="#8A8A8A" strokeDasharray="5 4" />
                <Bar dataKey="avg" fill={STEPS_COLOR} radius={[3, 3, 0, 0]} isAnimationActive={false} />
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
                  <YAxis {...axisProps} width={44} domain={['dataMin - 5', 'dataMax + 5']} unit=" spm" />
                  <Tooltip {...chartTooltipStyle} formatter={(v: unknown) => [`${v} steps/min`, 'Cadence']} />
                  <Line dataKey="cadence" stroke={STEPS_COLOR} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
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
                  <YAxis {...axisProps} width={44} domain={['dataMin - 5', 'dataMax + 5']} unit=" cm" />
                  <Tooltip {...chartTooltipStyle} formatter={(v: unknown) => [`${v} cm`, 'Stride']} />
                  <Line dataKey="strideCm" stroke={STEPS_COLOR} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
