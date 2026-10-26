'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts'
import StatTile from '@/components/ui/StatTile'
import { weeklyOnFoot, footEfficiencyByMonth, footKind, FOOT_KIND_LABEL } from '@/lib/activity'
import type { SessionData } from '@/lib/computeStats'
import type { LatLon } from '@/lib/zeppSeries'
import { activityByBucket, paceHrPoints, runTypeByBucket, RUN_TYPE_COLORS } from '@/lib/progressData'
import FootRecords from './FootRecords'
import { ChartCard, ClickHint, EmptyState, LegendDot, useChartAnimation } from './kit'
import { ACTIVITY_COLORS, FOOT_COLORS, GHOST, axisProps, chartTooltipStyle, fmtLongDay, fmtMonth } from './progressStyle'
import { onBucketClick, type RangeCtx } from './types'

const RouteHeatMap = dynamic(() => import('./RouteHeatMap'), { ssr: false, loading: () => <div className="h-80 rounded-lg" style={{ background: '#141414' }} /> })

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const fmtPace = (min: number) => `${Math.floor(min)}:${String(Math.round((min % 1) * 60)).padStart(2, '0')}`

/** Runs, hikes and walks together, following the page's date range. */
export default function OnFootTab({ sessions, ctx, routes }: { sessions: SessionData[]; ctx: RangeCtx; routes: Record<string, LatLon[]> }) {
  const anim = useChartAnimation()
  const recent = useMemo(() => weeklyOnFoot(sessions, ctx.today, 5), [sessions, ctx.today])
  const buckets = useMemo(() => activityByBucket(sessions, ctx.buckets), [sessions, ctx.buckets])
  const prev = useMemo(() => (ctx.compare ? activityByBucket(sessions, ctx.prev) : null), [sessions, ctx.prev, ctx.compare])
  const efficiency = useMemo(() => footEfficiencyByMonth(sessions).filter(m => m.month >= ctx.span.start.slice(0, 7)).map(m => ({ ...m, label: fmtMonth(m.month) })), [sessions, ctx.span])
  const mix = useMemo(() => runTypeByBucket(sessions, ctx.buckets), [sessions, ctx.buckets])
  const points = useMemo(() => paceHrPoints(sessions, ctx.span), [sessions, ctx.span])
  const hasRoutes = Object.keys(routes).length > 0

  if (!sessions.some(s => footKind(s)))
    return <EmptyState title="No runs, hikes or walks yet." hint="Log one, or connect your watch, to see your trends here." />

  const thisWeek = recent.at(-1)!
  const prev4 = recent.slice(0, -1)
  const total = (w: { run: number; hike: number; walk: number }) => Math.round((w.run + w.hike + w.walk) * 10) / 10
  const avg4 = prev4.reduce((n, w) => n + total(w), 0) / Math.max(prev4.length, 1)
  const avgHours = prev4.reduce((n, w) => n + w.hours, 0) / Math.max(prev4.length, 1)
  const unit = ctx.buckets[0]?.key.length === 7 ? 'month' : 'week'

  const distData = ctx.buckets.map((b, i) => ({ label: b.label, run: buckets[i].run, hike: buckets[i].hike, walk: buckets[i].walk, prev: prev ? prev[i].km : null }))
  const sumKm = buckets.reduce((n, b) => n + b.km, 0)
  const mixData = ctx.buckets.map((b, i) => ({ label: b.label, ...mix.rows[i] }))
  const hasMix = mix.types.length > 0 && mix.rows.some(r => Object.values(r).some(v => v > 0))
  const t0 = Date.parse(`${ctx.span.start}T00:00:00Z`), t1 = Date.parse(`${ctx.today}T00:00:00Z`)
  const ageOpacity = (date: string) => 0.25 + 0.75 * Math.max(0, Math.min(1, (Date.parse(`${date}T00:00:00Z`) - t0) / Math.max(1, t1 - t0)))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile value={total(thisWeek)} label="km on foot this week" accent={ACTIVITY_COLORS.run} />
        <StatTile value={Math.round(avg4 * 10) / 10} label="km / week, previous 4 avg" />
        <StatTile value={thisWeek.hours} label={`hours this week · avg ${Math.round(avgHours * 10) / 10}`} />
        <StatTile value={thisWeek.climb.toLocaleString()} label="m climbed this week" accent={ACTIVITY_COLORS.hike} />
      </div>

      <ChartCard title="Distance on Foot"
        sub={<>Km per {unit}, {ctx.label} · total <span style={{ fontFamily: 'var(--font-mono)', color: '#F5F5F5' }}>{Math.round(sumKm)} km</span>. Hikes = 5 km+ or 150 m+ climb; walks = shorter watch walks.</>}>
        <div className="h-64" data-noswipe>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }} barGap={1} onClick={onBucketClick(ctx.buckets, ctx.openBucket)} style={{ cursor: 'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
              <XAxis dataKey="label" {...axisProps} minTickGap={16} />
              <YAxis {...axisProps} width={56} unit=" km" />
              <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                formatter={(v: unknown, n: unknown) => [`${v} km`, String(n)]} />
              <Legend itemSorter={null} wrapperStyle={{ fontSize: 11, color: '#A0A0A0' }} />
              {ctx.compare && <Bar dataKey="prev" name="Previous period" fill={GHOST} radius={[3, 3, 0, 0]} {...anim} />}
              {(['hike', 'walk', 'run'] as const).map((k, i, all) => (
                <Bar key={k} dataKey={k} name={FOOT_KIND_LABEL[k]} stackId="foot" fill={FOOT_COLORS[k]} stroke="#1A1A1A" strokeWidth={1}
                  radius={i === all.length - 1 ? [3, 3, 0, 0] : undefined} {...anim} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ClickHint />
      </ChartCard>

      {hasMix && (
        <ChartCard title="Run Type Mix" sub={`Share of running km by session type, per ${unit}. A healthy base is mostly easy running.`}>
          <div className="h-56" data-noswipe>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mixData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }} onClick={onBucketClick(ctx.buckets, ctx.openBucket)} style={{ cursor: 'pointer' }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
                <XAxis dataKey="label" {...axisProps} minTickGap={16} />
                <YAxis {...axisProps} width={40} unit="%" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} />
                <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v: unknown, n: unknown) => [`${v}%`, cap(String(n))]} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#A0A0A0' }} formatter={v => cap(String(v))} />
                {mix.types.map(t => <Bar key={t} dataKey={t} stackId="mix" fill={RUN_TYPE_COLORS[t] ?? '#606060'} stroke="#1A1A1A" strokeWidth={1} {...anim} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {points.length > 2 && (
          <ChartCard title="Pace vs Heart Rate" sub="Each dot is a watch-recorded outing. Brighter = more recent. Moving down-left over time means fitter.">
            <div className="h-64" data-noswipe>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" />
                  <XAxis type="number" dataKey="pace" {...axisProps} domain={['dataMin - 0.5', 'dataMax + 0.5']} tickFormatter={fmtPace} unit="/km" name="Pace" allowDecimals />
                  <YAxis type="number" dataKey="hr" {...axisProps} width={60} domain={['dataMin - 5', 'dataMax + 5']} unit=" bpm" name="Avg HR" />
                  <ZAxis type="number" dataKey="km" range={[25, 140]} />
                  <Tooltip {...chartTooltipStyle} cursor={{ strokeDasharray: '3 3', stroke: '#3A3A3A' }}
                    content={({ active, payload }) => {
                      const p = active && payload?.[0]?.payload as (typeof points)[number] | undefined
                      if (!p) return null
                      return (
                        <div className="rounded-lg px-3 py-2" style={{ background: '#242424', border: '1px solid #2E2E2E' }}>
                          <p className="text-xs font-semibold" style={{ color: '#F5F5F5' }}>{p.name}</p>
                          <p className="text-xs" style={{ color: '#A0A0A0', fontFamily: 'var(--font-mono)' }}>{fmtPace(p.pace)}/km · {p.hr} bpm · {p.km} km</p>
                          <p className="text-xs" style={{ color: '#8A8A8A' }}>{fmtLongDay(p.date)}</p>
                        </div>
                      )
                    }} />
                  {(['run', 'hike', 'walk'] as const).map(k => {
                    const data = points.filter(p => p.kind === k)
                    return data.length ? (
                      <Scatter key={k} name={FOOT_KIND_LABEL[k]} data={data} fill={ACTIVITY_COLORS[k]} {...anim}
                        onClick={(d: { payload?: { savedAt?: string } }) => { const s = sessions.find(x => x.savedAt === d.payload?.savedAt); if (s) ctx.openSession(s) }}
                        style={{ cursor: 'pointer' }}>
                        {data.map(p => <Cell key={p.savedAt} fillOpacity={ageOpacity(p.date)} />)}
                      </Scatter>
                    ) : null
                  })}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-2">
              {(['run', 'hike', 'walk'] as const).filter(k => points.some(p => p.kind === k)).map(k => <LegendDot key={k} color={ACTIVITY_COLORS[k]} label={FOOT_KIND_LABEL[k]} />)}
            </div>
          </ChartCard>
        )}
        {efficiency.length > 1 && (
          <ChartCard title="Aerobic Efficiency" sub="Avg heart rate on recorded walks & hikes of 3 km+. Lower HR at a similar pace = fitter.">
            <div className="h-64" data-noswipe>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={efficiency} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} width={60} domain={['dataMin - 5', 'dataMax + 5']} unit=" bpm" />
                  <Tooltip {...chartTooltipStyle}
                    formatter={(v: unknown, _n: unknown, p: { payload?: { paceMinKm?: number | null; sessions?: number } }) =>
                      [`${v} bpm · pace ${p.payload?.paceMinKm ?? '–'} min/km · ${p.payload?.sessions} sessions`, 'Avg HR']} />
                  <Line dataKey="avgHr" stroke={FOOT_COLORS.hike} strokeWidth={2} dot={{ r: 3 }} connectNulls {...anim} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        )}
      </div>

      {hasRoutes && (
        <ChartCard title="Route Heat Map" sub={`Your recorded routes, ${ctx.label}.`}>
          <RouteHeatMap sessions={sessions} routes={routes} span={ctx.span} />
        </ChartCard>
      )}

      <FootRecords sessions={sessions} />
    </div>
  )
}
