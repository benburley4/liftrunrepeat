'use client'

import { Fragment, useMemo, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, Legend,
} from 'recharts'
import { ChevronDown } from 'lucide-react'
import type { SessionData } from '@/lib/computeStats'
import { activityByBucket, bodyPartSets, e1rmByBucket, exerciseRanking, liftRecords, sessionVolume, type ExerciseStat } from '@/lib/progressData'
import LiftingEffort from './LiftingEffort'
import BodyHeatMap from './BodyHeatMap'
import Sparkline from './Sparkline'
import { ChartCard, ClickHint, EmptyState, LegendDot, useChartAnimation } from './kit'
import { ACTIVITY_COLORS, GHOST, axisProps, cardStyle, chartTooltipStyle, fmtLongDay, fmtTonnes } from './progressStyle'
import { onBucketClick, type RangeCtx } from './types'

const LINE_COLORS = ['#00BFA5', '#C8102E', '#A78BFA', '#F59E0B', '#60A5FA', '#F97316']
const MAX_LINES = LINE_COLORS.length

export default function StrengthTab({ history, ctx, analysis }: { history: SessionData[]; ctx: RangeCtx; analysis: ExerciseStat[] }) {
  const anim = useChartAnimation()
  const ranking = useMemo(() => exerciseRanking(history), [history])
  const [picked, setPicked] = useState<string[] | null>(null)
  const selected = useMemo(() => picked ?? ranking.slice(0, 5).map(r => r.name), [picked, ranking])
  const [hovered, setHovered] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const e1rm = useMemo(() => e1rmByBucket(history, ctx.buckets, selected), [history, ctx.buckets, selected])
  const vol = useMemo(() => activityByBucket(history, ctx.buckets, ctx.mults), [history, ctx.buckets, ctx.mults])
  const prevVol = useMemo(() => (ctx.compare ? activityByBucket(history, ctx.prev, ctx.mults) : null), [history, ctx.prev, ctx.compare, ctx.mults])
  const parts = useMemo(() => bodyPartSets(history, ctx.span), [history, ctx.span])
  const records = useMemo(() => liftRecords(history), [history])
  const byName = useMemo(() => new Map(analysis.map(a => [a.name, a])), [analysis])

  if (!history.some(s => (s.exercises ?? []).length > 0))
    return <EmptyState title="No strength sessions logged yet." hint="Log a lifting session to see your trends here." />

  const lineData = ctx.buckets.map((b, i) => ({ label: b.label, ...e1rm[i] }))
  const volData = ctx.buckets.map((b, i) => ({ label: b.label, volume: vol[i].lift, prev: prevVol?.[i].lift ?? null }))
  const totalKg = vol.reduce((n, b) => n + b.lift, 0)
  const prevKg = prevVol?.reduce((n, b) => n + b.lift, 0) ?? null

  // Plateau marker: the last point of each plateaued exercise in view.
  const plateauDots = selected.flatMap(name => {
    const a = byName.get(name)
    if (!a?.plateau) return []
    for (let i = lineData.length - 1; i >= 0; i--) {
      const v = (lineData[i] as Record<string, unknown>)[name]
      if (typeof v === 'number') return [{ name, label: lineData[i].label, value: v }]
    }
    return []
  })

  function toggle(name: string) {
    const cur = selected
    if (cur.includes(name)) setPicked(cur.filter(n => n !== name))
    else if (cur.length < MAX_LINES) setPicked([...cur, name])
  }

  return (
    <div className="space-y-6">
      <LiftingEffort sessions={history} volumeOf={s => sessionVolume(s, ctx.mults)} />

      <ChartCard title="Est. 1RM Trend" sub={`Best estimated one-rep max per ${ctx.buckets[0]?.key.length === 7 ? 'month' : 'week'}, ${ctx.label}. Pick up to ${MAX_LINES} lifts.`}>
        <div className="flex flex-wrap gap-1.5 mb-4" role="group" aria-label="Lifts shown on the chart">
          {ranking.slice(0, 14).map(r => {
            const i = selected.indexOf(r.name)
            const on = i >= 0
            const c = on ? LINE_COLORS[i % LINE_COLORS.length] : '#A0A0A0'
            return (
              <button key={r.name} type="button" aria-pressed={on} onClick={() => toggle(r.name)}
                disabled={!on && selected.length >= MAX_LINES}
                className="rounded-full px-3 py-1 text-xs transition-colors"
                style={{ background: on ? `${c}1F` : '#242424', border: `1px solid ${on ? `${c}66` : '#2E2E2E'}`, color: c, cursor: 'pointer', opacity: !on && selected.length >= MAX_LINES ? 0.4 : 1 }}>
                {r.name}{byName.get(r.name)?.plateau ? ' · plateau' : ''}
              </button>
            )
          })}
        </div>
        {selected.length === 0 ? (
          <p className="text-sm py-10 text-center" style={{ color: 'var(--color-text-subtle)' }}>Pick a lift above to chart it.</p>
        ) : (
          <div className="h-72" data-noswipe>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" />
                <XAxis dataKey="label" {...axisProps} minTickGap={16} />
                <YAxis {...axisProps} width={56} unit=" kg" domain={['auto', 'auto']} />
                <Tooltip {...chartTooltipStyle} formatter={(v: unknown, n: unknown) => [`${v} kg`, String(n)]} />
                <Legend wrapperStyle={{ fontSize: 12, cursor: 'pointer' }}
                  onMouseEnter={(e: { dataKey?: unknown }) => setHovered(typeof e.dataKey === 'string' ? e.dataKey : null)}
                  onMouseLeave={() => setHovered(null)} />
                {selected.map((name, i) => {
                  const col = LINE_COLORS[i % LINE_COLORS.length]
                  const dim = hovered !== null && hovered !== name
                  return <Line key={name} type="monotone" dataKey={name} name={name} stroke={col} strokeWidth={dim ? 1 : 2.5}
                    dot={{ r: dim ? 0 : 3, fill: col }} opacity={dim ? 0.15 : 1} connectNulls {...anim} />
                })}
                {plateauDots.map(p => (
                  <ReferenceDot key={p.name} x={p.label} y={p.value} r={7} fill="none" stroke="#F59E0B" strokeWidth={2}
                    label={{ value: 'plateau', position: 'top', fill: '#F59E0B', fontSize: 10 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {plateauDots.length > 0 && (
          <p className="text-xs mt-2" style={{ color: '#F59E0B' }}>
            Amber ring = no new best in 4+ weeks: {plateauDots.map(p => p.name).join(', ')}.
          </p>
        )}
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Lifting Volume" sub={<>Kg lifted per {ctx.buckets[0]?.key.length === 7 ? 'month' : 'week'} · total <span style={{ color: ACTIVITY_COLORS.lift, fontFamily: 'var(--font-mono)' }}>{fmtTonnes(totalKg)}</span>{prevKg != null && <> vs <span style={{ fontFamily: 'var(--font-mono)' }}>{fmtTonnes(prevKg)}</span> before</>}</>}
          actions={ctx.compare ? <div className="flex gap-3"><LegendDot color={ACTIVITY_COLORS.lift} label="This period" /><LegendDot color={GHOST} label="Previous" /></div> : undefined}>
          <div className="h-56" data-noswipe>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }} barGap={1} onClick={onBucketClick(ctx.buckets, ctx.openBucket)} style={{ cursor: 'pointer' }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
                <XAxis dataKey="label" {...axisProps} minTickGap={16} />
                <YAxis {...axisProps} width={44} tickFormatter={v => (v >= 1000 ? `${Math.round(v / 1000)}t` : String(v))} />
                <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  formatter={(v: unknown, n: unknown) => [fmtTonnes(Number(v)), n === 'prev' ? 'Previous period' : 'Volume']} />
                {ctx.compare && <Bar dataKey="prev" fill={GHOST} radius={[3, 3, 0, 0]} {...anim} />}
                <Bar dataKey="volume" fill={ACTIVITY_COLORS.lift} radius={[3, 3, 0, 0]} {...anim} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ClickHint />
        </ChartCard>

        <ChartCard title="Muscles Worked" sub={`Working sets per body part, ${ctx.label}. Brighter = more sets.`}>
          <BodyHeatMap sets={parts} />
        </ChartCard>
      </div>

      {records.length > 0 && (
        <section className="rounded-xl overflow-hidden lrr-reveal" style={cardStyle}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid #2E2E2E' }}>
            <h3 className="text-xl font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>Personal Records</h3>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>Click a row to see how that lift has progressed.</p>
          </div>
          <div className="overflow-x-auto" data-noswipe>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #2E2E2E' }}>
                  {['Exercise', 'Best Set', 'Est. 1RM', 'Date', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs uppercase tracking-wider font-normal" style={{ color: 'var(--color-text-subtle)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map(row => {
                  const open = expanded === row.exercise
                  const a = byName.get(row.exercise)
                  return (
                    <Fragment key={row.exercise}>
                      <tr className="pr-row" style={{ borderBottom: '1px solid #222', cursor: 'pointer' }} onClick={() => setExpanded(open ? null : row.exercise)}>
                        <td className="px-5 py-3 text-sm font-semibold" style={{ color: '#F5F5F5' }}>
                          <button type="button" aria-expanded={open} className="text-left" style={{ cursor: 'pointer' }}
                            onClick={e => { e.stopPropagation(); setExpanded(open ? null : row.exercise) }}>{row.exercise}</button>
                        </td>
                        <td className="px-5 py-3 text-sm font-bold" style={{ color: ACTIVITY_COLORS.lift, fontFamily: 'var(--font-mono)' }}>{row.weight} kg × {row.reps}</td>
                        <td className="px-5 py-3 text-sm" style={{ color: '#A78BFA', fontFamily: 'var(--font-mono)' }}>{row.rm} kg</td>
                        <td className="px-5 py-3 text-sm whitespace-nowrap" style={{ color: 'var(--color-text-subtle)' }}>{fmtLongDay(row.date)}</td>
                        <td className="px-5 py-3"><ChevronDown size={14} style={{ color: '#606060', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} aria-hidden="true" /></td>
                      </tr>
                      {open && (
                        <tr style={{ borderBottom: '1px solid #222', background: '#161616' }}>
                          <td colSpan={5} className="px-5 py-4">
                            {a && a.trend.length > 1 ? (
                              <div className="flex flex-wrap items-center gap-6">
                                <Sparkline values={a.trend.map(t => t.e1rm)} color="#A78BFA" width={260} height={60} label={`${row.exercise} estimated 1RM, every session`} />
                                <div className="text-xs space-y-1" style={{ color: '#A0A0A0' }}>
                                  <p>{a.trend.length} sessions since {fmtLongDay(a.firstDate)}</p>
                                  {a.pctGain !== null && <p style={{ color: a.pctGain >= 0 ? '#00BFA5' : '#EF4444' }}>{a.pctGain >= 0 ? '▲' : '▼'} {Math.abs(a.pctGain)}% over {a.gainWeeks} weeks</p>}
                                  {a.plateau && <p style={{ color: '#F59E0B' }}>Plateau: no new best since {fmtLongDay(a.prDate)}</p>}
                                </div>
                              </div>
                            ) : <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Log this lift in more sessions to see a trend.</p>}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
