'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Watch, Info } from 'lucide-react'
import type { ZeppStats } from '@/lib/zeppImport'
import type { SeriesPoint } from '@/lib/zeppSeries'
import { getZeppWorkoutSeries } from '@/lib/db'
import TrainingEffectRings from './TrainingEffectRings'
import { chartTooltipStyle, axisProps } from '@/components/recovery/chartStyle'

const ACCENT = '#C8102E'   // heart rate
const ELEV = '#84CC16'     // matches the History hike card

// HR zones are ordinal → one hue, dim → bright with intensity.
const ZONE_RAMP = ['#5A2A33', '#7A2534', '#9E1F35', '#C8102E', '#E2475C', '#F27D8D']

const fmtClock = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m} min`
}

function fmtMinSec(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60), s = Math.round(totalSeconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** min/km → "15:16 /km" */
const fmtPace = (minPerKm: number) => `${fmtMinSec(minPerKm * 60)} /km`

function Stat({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-subtle)', fontFamily: 'var(--font-sans)' }}>{label}</p>
      <p className="text-lg font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>
        {value}{unit && <span className="text-sm font-normal ml-1" style={{ color: 'var(--color-text-subtle)' }}>{unit}</span>}
      </p>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-subtle)', fontFamily: 'var(--font-sans)' }}>{children}</p>
}

export default function WatchWorkoutPanel({ zepp, manualOriginal }: {
  zepp: ZeppStats
  manualOriginal?: { hikeKm: number | null; hikeElevationM: number | null } | null
}) {
  const [series, setSeries] = useState<SeriesPoint[] | null>(null)

  useEffect(() => {
    let live = true
    getZeppWorkoutSeries(zepp.workoutId).then(p => { if (live) setSeries(p) })
    return () => { live = false }
  }, [zepp.workoutId])

  const pace = zepp.distanceKm && (zepp.movingMin ?? zepp.durationMin)
    ? (zepp.movingMin ?? zepp.durationMin)! / zepp.distanceKm : null

  const stats: { label: string; value: string | number; unit?: string }[] = []
  if (zepp.durationMin) stats.push({ label: 'Duration', value: fmtDuration(zepp.durationMin) })
  if (zepp.movingMin && zepp.durationMin && zepp.movingMin < zepp.durationMin - 1) stats.push({ label: 'Moving', value: fmtDuration(zepp.movingMin) })
  if (zepp.avgHr) stats.push({ label: 'Avg HR', value: zepp.avgHr, unit: 'bpm' })
  if (zepp.maxHr) stats.push({ label: 'Max HR', value: zepp.maxHr, unit: 'bpm' })
  if (pace && pace < 60) stats.push({ label: 'Avg pace', value: fmtPace(pace) })
  if (zepp.calories) stats.push({ label: 'Calories', value: zepp.calories, unit: 'kcal' })
  if (zepp.steps) stats.push({ label: 'Steps', value: zepp.steps.toLocaleString() })
  if (zepp.elevationGainM) stats.push({ label: 'Ascent', value: zepp.elevationGainM, unit: 'm' })
  if (zepp.elevationLossM) stats.push({ label: 'Descent', value: zepp.elevationLossM, unit: 'm' })
  if (zepp.avgCadenceSpm) stats.push({ label: 'Cadence', value: zepp.avgCadenceSpm, unit: 'spm' })

  const zones = zepp.hrZones ?? []
  const zoneTotal = zones.reduce((n, z) => n + z.seconds, 0)
  const chartData = (series ?? []).map(([min, hr, alt]) => ({ min, hr, alt }))
  const hasAlt = chartData.filter(p => p.alt != null).length > 1
  const fmtMinTick = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}`

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#1A1A1A', border: `1px solid ${ACCENT}40` }}>
      <div className="px-4 py-2 flex items-center justify-between gap-3" style={{ background: `${ACCENT}10`, borderBottom: `1px solid ${ACCENT}30` }}>
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>
          <Watch size={14} color={ACCENT} aria-hidden="true" /> From your watch
        </span>
        <span className="text-xs" style={{ color: 'var(--color-text-subtle)', fontFamily: 'var(--font-mono)' }}>
          {fmtClock(zepp.startTime)} – {fmtClock(zepp.endTime)}
        </span>
      </div>

      {stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4" style={{ borderBottom: '1px solid #2E2E2E' }}>
          {stats.map(s => <Stat key={s.label} {...s} />)}
        </div>
      )}

      {(manualOriginal?.hikeKm != null || zepp.distanceMismatch) && (
        <p className="px-4 py-3 text-xs flex items-start gap-2" style={{ color: 'var(--color-text-subtle)', borderBottom: '1px solid #2E2E2E' }}>
          <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          {zepp.distanceMismatch
            ? `The watch recorded ${zepp.distanceKm ?? '–'} km, likely only part of the outing — your logged distance and elevation are kept.`
            : `Distance and elevation are from the watch — you logged ${manualOriginal!.hikeKm} km${manualOriginal!.hikeElevationM != null ? ` / ${manualOriginal!.hikeElevationM} m` : ''}.`}
        </p>
      )}

      <div className="p-4 space-y-6">
        {(zepp.trainingEffect != null || zepp.anaerobicTrainingEffect != null) && (
          <div>
            <SectionLabel>Training effect</SectionLabel>
            <TrainingEffectRings aerobic={zepp.trainingEffect} anaerobic={zepp.anaerobicTrainingEffect} />
          </div>
        )}

        {chartData.length > 1 && (
          <div>
            <SectionLabel>Heart rate{zepp.avgHr ? ` · avg ${zepp.avgHr} bpm (dashed)` : ''}</SectionLabel>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
                  <XAxis dataKey="min" type="number" domain={['dataMin', 'dataMax']} tickFormatter={fmtMinTick} {...axisProps} />
                  <YAxis {...axisProps} width={36} domain={['dataMin - 5', 'dataMax + 5']} />
                  <Tooltip {...chartTooltipStyle} labelFormatter={v => fmtMinTick(Number(v))} formatter={(v: unknown) => [`${v} bpm`, 'Heart rate']} />
                  {zepp.avgHr && <ReferenceLine y={zepp.avgHr} stroke="#8A8A8A" strokeDasharray="5 4" />}
                  <Line type="monotone" dataKey="hr" stroke={ACCENT} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {hasAlt && (
          <div>
            <SectionLabel>Elevation{zepp.minAltitudeM != null && zepp.maxAltitudeM != null ? ` · ${zepp.minAltitudeM}–${zepp.maxAltitudeM} m` : ''}</SectionLabel>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
                  <XAxis dataKey="min" type="number" domain={['dataMin', 'dataMax']} tickFormatter={fmtMinTick} {...axisProps} />
                  <YAxis {...axisProps} width={36} domain={['dataMin - 10', 'dataMax + 10']} />
                  <Tooltip {...chartTooltipStyle} labelFormatter={v => fmtMinTick(Number(v))} formatter={(v: unknown) => [`${v} m`, 'Altitude']} />
                  <Area type="monotone" dataKey="alt" stroke={ELEV} strokeWidth={2} fill={`${ELEV}26`} connectNulls isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {zoneTotal > 0 && (
          <div>
            <SectionLabel>Time in heart-rate zones</SectionLabel>
            <ul className="space-y-1.5">
              {zones.map((z, i) => {
                const lower = i === 0 ? null : zones[i - 1].upperBpm
                const pct = z.seconds / zoneTotal
                return (
                  <li key={i} className="grid items-center gap-3" style={{ gridTemplateColumns: '84px 1fr 64px' }}>
                    <span className="text-xs" style={{ color: '#A0A0A0', fontFamily: 'var(--font-mono)' }}>
                      {lower == null ? `< ${z.upperBpm}` : `${lower}–${z.upperBpm}`}
                    </span>
                    <div className="h-3 rounded" style={{ background: '#242424' }}>
                      <div className="h-3 rounded" style={{ width: `${Math.max(pct * 100, z.seconds ? 1 : 0)}%`, background: ZONE_RAMP[i] ?? ACCENT }} />
                    </div>
                    <span className="text-xs text-right" style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>
                      {z.seconds ? fmtDuration(z.seconds / 60) : '–'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {zepp.splits && zepp.splits.length > 0 && (
          <div>
            <SectionLabel>Splits</SectionLabel>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
                <thead>
                  <tr style={{ color: 'var(--color-text-subtle)' }}>
                    {['Km', 'Pace /km', 'Avg HR', 'Climb'].map(h => (
                      <th key={h} className="text-xs font-normal text-right first:text-left pb-2 px-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {zepp.splits.map(s => (
                    <tr key={s.km} style={{ color: '#F5F5F5', borderTop: '1px solid #242424' }}>
                      <td className="py-1.5 px-2">{s.distanceM < 1000 ? `${(s.distanceM / 1000).toFixed(2)}` : s.km}</td>
                      <td className="py-1.5 px-2 text-right">{s.distanceM > 0 ? fmtMinSec(s.seconds / (s.distanceM / 1000)) : '–'}</td>
                      <td className="py-1.5 px-2 text-right">{s.avgHr ?? '–'}</td>
                      <td className="py-1.5 px-2 text-right">{s.elevationGainM != null ? `${s.elevationGainM} m` : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
