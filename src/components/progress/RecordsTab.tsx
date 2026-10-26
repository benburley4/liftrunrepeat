'use client'

import { useMemo, useState } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, LabelList,
} from 'recharts'
import { Trophy, Target, Timer } from 'lucide-react'
import type { SessionData } from '@/lib/computeStats'
import {
  liftRecords, runRecords, predictRaceTimes, prEvents, nextMilestone, fmtClock, fmtPaceSecs,
  type ExerciseStat,
} from '@/lib/progressData'
import HikeRecords from './HikeRecords'
import Sparkline from './Sparkline'
import { ChartCard, LegendDot, useChartAnimation } from './kit'
import { ACTIVITY_COLORS, axisProps, cardStyle, chartTooltipStyle, fmtLongDay } from './progressStyle'
import type { RangeCtx } from './types'

const LIFT = ACTIVITY_COLORS.lift, RUN = ACTIVITY_COLORS.run
const SHOW = 9

export default function RecordsTab({ history, ctx, analysis }: { history: SessionData[]; ctx: RangeCtx; analysis: ExerciseStat[] }) {
  const anim = useChartAnimation()
  const [showAll, setShowAll] = useState(false)
  const lifts = useMemo(() => liftRecords(history), [history])
  const { records: runs, longest } = useMemo(() => runRecords(history), [history])
  const predictions = useMemo(() => predictRaceTimes(runs), [runs])
  const events = useMemo(() => prEvents(history).filter(e => e.date >= ctx.span.start && e.date < ctx.span.end), [history, ctx.span])
  const trendOf = useMemo(() => new Map(analysis.map(a => [a.name, a.trend.slice(-24).map(t => t.e1rm)])), [analysis])
  const open = (savedAt: string) => { const s = history.find(h => h.savedAt === savedAt); if (s) ctx.openSession(s) }

  const toPoint = (e: (typeof events)[number]) => ({ ...e, t: Date.parse(`${e.date}T00:00:00Z`), y: e.pct })
  const liftPts = events.filter(e => e.kind === 'lift').map(toPoint)
  const runPts = events.filter(e => e.kind === 'run').map(toPoint)
  const longSpan = Date.parse(`${ctx.span.end}T00:00:00Z`) - Date.parse(`${ctx.span.start}T00:00:00Z`) > 200 * 86400000
  const fmtTick = (t: number) => new Date(t).toLocaleDateString('en-GB', longSpan ? { month: 'short', year: '2-digit', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const ladder = runs.map(r => ({ label: r.label, secs: r.paceSecs, pace: fmtPaceSecs(r.paceSecs), savedAt: r.savedAt }))
  const minPace = ladder.length ? Math.min(...ladder.map(l => l.secs)) : 0

  return (
    <div className="space-y-6">
      <ChartCard title="Record Timeline" sub={`Every time a record improved, ${ctx.label}. Height = how big the jump was. Click a dot to open that session.`}
        actions={<div className="flex gap-4"><LegendDot color={LIFT} label={`Lift (${liftPts.length})`} /><LegendDot color={RUN} label={`Run (${runPts.length})`} /></div>}>
        {events.length === 0 ? (
          <p className="text-sm py-10 text-center" style={{ color: 'var(--color-text-subtle)' }}>No new records in this range. Try a longer range.</p>
        ) : (
          <div className="h-60" data-noswipe>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" />
                <XAxis type="number" dataKey="t" domain={[Date.parse(`${ctx.span.start}T00:00:00Z`), Date.parse(`${ctx.span.end}T00:00:00Z`)]}
                  tickFormatter={fmtTick} {...axisProps} scale="time" />
                <YAxis type="number" dataKey="y" {...axisProps} width={44} unit="%" />
                <ZAxis range={[60, 60]} />
                <Tooltip {...chartTooltipStyle} cursor={{ strokeDasharray: '3 3', stroke: '#3A3A3A' }}
                  content={({ active, payload }) => {
                    const p = active && payload?.[0]?.payload as (ReturnType<typeof toPoint>) | undefined
                    if (!p) return null
                    return (
                      <div className="rounded-lg px-3 py-2" style={{ background: '#242424', border: '1px solid #2E2E2E' }}>
                        <p className="text-xs font-semibold" style={{ color: '#F5F5F5' }}>{p.name}</p>
                        <p className="text-xs" style={{ color: p.kind === 'lift' ? LIFT : RUN, fontFamily: 'var(--font-mono)' }}>{p.value} · +{p.pct}%</p>
                        <p className="text-xs" style={{ color: '#8A8A8A' }}>{fmtLongDay(p.date)}</p>
                      </div>
                    )
                  }} />
                <Scatter name="Lift" data={liftPts} fill={LIFT} {...anim} onClick={(d: { payload?: { savedAt?: string } }) => d.payload?.savedAt && open(d.payload.savedAt)} style={{ cursor: 'pointer' }} />
                <Scatter name="Run" data={runPts} fill={RUN} shape="diamond" {...anim} onClick={(d: { payload?: { savedAt?: string } }) => d.payload?.savedAt && open(d.payload.savedAt)} style={{ cursor: 'pointer' }} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <section aria-labelledby="lift-records-h">
        <div className="flex items-center justify-between mb-3 gap-2">
          <h3 id="lift-records-h" className="text-xl font-black uppercase flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: LIFT }} aria-hidden="true" /> Lift Records
          </h3>
          {lifts.length > SHOW && (
            <button type="button" onClick={() => setShowAll(v => !v)} className="text-xs" style={{ color: LIFT, cursor: 'pointer' }}>
              {showAll ? 'Show fewer' : `Show all ${lifts.length}`}
            </button>
          )}
        </div>
        {lifts.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={cardStyle}><p className="text-sm" style={{ color: 'var(--color-text-subtle)' }}>No lift data yet.</p></div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(showAll ? lifts : lifts.slice(0, SHOW)).map(r => {
              const m = nextMilestone(r.rm)
              const trend = trendOf.get(r.exercise) ?? []
              return (
                <button key={r.exercise} type="button" onClick={() => open(r.savedAt)}
                  className="rounded-xl p-4 text-left lrr-tile lrr-reveal" style={{ ...cardStyle, cursor: 'pointer' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-black uppercase truncate" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>{r.exercise}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{fmtLongDay(r.date)} · {r.totalSets} sets logged</p>
                    </div>
                    <Trophy size={16} style={{ color: '#F59E0B', flexShrink: 0 }} aria-hidden="true" />
                  </div>
                  <div className="flex items-end justify-between gap-2 mt-3">
                    <div>
                      <p className="text-2xl font-bold" style={{ color: '#A78BFA', fontFamily: 'var(--font-mono)' }}>{r.rm}<span className="text-sm" style={{ color: 'var(--color-text-subtle)' }}> kg</span></p>
                      <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>est. 1RM · best set <span style={{ color: LIFT, fontFamily: 'var(--font-mono)' }}>{r.weight} × {r.reps}</span></p>
                    </div>
                    <Sparkline values={trend} color={LIFT} width={88} height={34} label={`${r.exercise} estimated 1RM over time`} />
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--color-text-subtle)' }}>
                      <span className="inline-flex items-center gap-1"><Target size={11} aria-hidden="true" /> Next: {m.target} kg</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{m.pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#242424' }}>
                      <div className="h-full rounded-full lrr-grow" style={{ width: `${m.pct}%`, background: 'linear-gradient(90deg, #00BFA5, #A78BFA)' }} />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <section className="rounded-xl overflow-hidden lrr-reveal" style={cardStyle} aria-labelledby="run-records-h">
          <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #2E2E2E', background: '#242424' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: RUN }} aria-hidden="true" />
            <h3 id="run-records-h" className="text-base font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>Run</h3>
          </div>
          {runs.length === 0 && !longest ? (
            <p className="px-5 py-8 text-sm text-center" style={{ color: 'var(--color-text-subtle)' }}>No run data yet.</p>
          ) : (
            <>
              {ladder.length > 0 && (
                <div className="px-5 pt-4">
                  <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-subtle)' }}>Pace ladder — best pace per distance</p>
                  <div style={{ height: 40 + ladder.length * 30 }} data-noswipe>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ladder} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }}
                        onClick={(st: { activeTooltipIndex?: unknown } | null) => { const i = Number(st?.activeTooltipIndex); if (ladder[i]) open(ladder[i].savedAt) }}>
                        <XAxis type="number" hide domain={[0, 'dataMax']} />
                        <YAxis type="category" dataKey="label" {...axisProps} width={96} />
                        <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(_v: unknown, _n: unknown, p: { payload?: { pace?: string } }) => [`${p.payload?.pace}/km`, 'Best pace']} />
                        <Bar dataKey="secs" radius={[0, 4, 4, 0]} {...anim} style={{ cursor: 'pointer' }}>
                          {ladder.map(l => <Cell key={l.label} fill={l.secs === minPace ? RUN : `${RUN}99`} />)}
                          <LabelList dataKey="pace" position="right" style={{ fill: '#A0A0A0', fontSize: 11, fontFamily: 'var(--font-mono)' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs mb-3" style={{ color: 'var(--color-text-subtle)' }}>Shorter bar = faster. Click a bar to open the session.</p>
                </div>
              )}
              {[...runs, ...(longest ? [longest] : [])].map(row => (
                <button key={row.label} type="button" onClick={() => open(row.savedAt)} className="w-full text-left px-5 py-3 pr-row"
                  style={{ borderTop: '1px solid #2E2E2E', cursor: 'pointer' }}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold uppercase" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>{row.label}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{fmtLongDay(row.date)}</p>
                  </div>
                  <div className="flex gap-4 mt-1 text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: RUN }}>{row.pace}/km</span>
                    <span style={{ color: '#F5F5F5' }}>{fmtClock(row.timeSecs)}</span>
                  </div>
                </button>
              ))}
              {predictions.length > 0 && (
                <div className="px-5 py-4" style={{ borderTop: '1px solid #2E2E2E', background: '#161616' }}>
                  <p className="text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-subtle)' }}>
                    <Timer size={12} aria-hidden="true" /> Predicted race times
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {predictions.map(p => (
                      <div key={p.label} className="rounded-lg px-3 py-2" style={{ background: '#1E1E1E' }}>
                        <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{p.label}</p>
                        <p className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>{fmtClock(p.predictedSecs)}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs mt-2" style={{ color: 'var(--color-text-subtle)' }}>
                    Riegel formula from your nearest-distance record. A guide, not a promise: longer races also need the mileage.
                  </p>
                </div>
              )}
            </>
          )}
        </section>
        <HikeRecords sessions={history} onOpen={open} />
      </div>
    </div>
  )
}
