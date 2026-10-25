'use client'

import { useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import StatTile from '@/components/ui/StatTile'
import { weeklyOnFoot, footEfficiencyByMonth, footKind, FOOT_KIND_LABEL } from '@/lib/activity'
import type { SessionData } from '@/lib/computeStats'
import FootRecords from './FootRecords'
import { chartTooltipStyle, axisProps, fmtDay, fmtMonth, cardStyle, FOOT_COLORS } from './progressStyle'

function Heading({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-xl font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>{children}</h3>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>{sub}</p>}
    </div>
  )
}

/** Runs, hikes and walks together — the Running tab for an athlete who mostly hikes. */
export default function OnFootTab({ sessions, today }: { sessions: SessionData[]; today: string }) {
  const weeks = useMemo(() => weeklyOnFoot(sessions, today, 12).map(w => ({ ...w, label: fmtDay(w.week), total: Math.round((w.run + w.hike + w.walk) * 10) / 10 })), [sessions, today])
  const efficiency = useMemo(() => footEfficiencyByMonth(sessions).map(m => ({ ...m, label: fmtMonth(m.month) })), [sessions])

  if (!sessions.some(s => footKind(s))) {
    return (
      <div className="rounded-xl p-12 text-center" style={cardStyle}>
        <p className="text-sm font-semibold" style={{ color: '#A0A0A0' }}>No runs, hikes or walks yet.</p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>Log one, or connect your watch, to see your trends here.</p>
      </div>
    )
  }

  const thisWeek = weeks.at(-1)!
  const prev4 = weeks.slice(-5, -1)
  const avg4 = prev4.reduce((n, w) => n + w.total, 0) / Math.max(prev4.length, 1)
  const avgHours = prev4.reduce((n, w) => n + w.hours, 0) / Math.max(prev4.length, 1)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile value={thisWeek.total} label="km on foot this week" animate={false} />
        <StatTile value={Math.round(avg4 * 10) / 10} label="km / week, previous 4 avg" animate={false} />
        <StatTile value={thisWeek.hours} label={`hours this week · avg ${Math.round(avgHours * 10) / 10}`} animate={false} />
        <StatTile value={thisWeek.climb.toLocaleString()} label="m climbed this week" animate={false} />
      </div>

      <div className="rounded-xl p-5" style={cardStyle}>
        <Heading sub="Hikes = 5 km+ or 150 m+ climb (or logged by hand) · walks = shorter watch walks">Weekly Distance — 12 Weeks</Heading>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeks} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} width={40} unit=" km" />
              <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} labelFormatter={l => `Week of ${l}`}
                formatter={(v: unknown, n: unknown) => [`${v} km`, String(n)]} />
              <Legend itemSorter={null} wrapperStyle={{ fontSize: 11, color: '#A0A0A0' }} />
              {(['hike', 'walk', 'run'] as const).map((k, i, all) => (
                <Bar key={k} dataKey={k} name={FOOT_KIND_LABEL[k]} stackId="foot" fill={FOOT_COLORS[k]}
                  stroke="#1A1A1A" strokeWidth={1} isAnimationActive={false}
                  radius={i === all.length - 1 ? [3, 3, 0, 0] : undefined} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <FootRecords sessions={sessions} />
        {efficiency.length > 1 && (
          <div className="rounded-xl p-5" style={cardStyle}>
            <Heading sub="Avg heart rate on recorded walks & hikes of 3 km+. Lower HR at a similar pace = fitter.">Aerobic Efficiency</Heading>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={efficiency} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} width={44} domain={['dataMin - 5', 'dataMax + 5']} unit=" bpm" />
                  <Tooltip {...chartTooltipStyle}
                    formatter={(v: unknown, _n: unknown, p: { payload?: { paceMinKm?: number | null; sessions?: number } }) =>
                      [`${v} bpm · pace ${p.payload?.paceMinKm ?? '–'} min/km · ${p.payload?.sessions} sessions`, 'Avg HR']} />
                  <Line dataKey="avgHr" stroke={FOOT_COLORS.hike} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
