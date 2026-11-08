'use client'

import { useMemo, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import Card from '@/components/ui/Card'
import StatTile from '@/components/ui/StatTile'
import { chartTooltipStyle, axisProps, fmtDay } from '@/components/recovery/chartStyle'
import { bucketSizeFor, shiftDay, weightTrend, type BucketSize } from '@/lib/nutrition'
import {
  BODY_METRICS, TREND_FLAT, WEIGHT_FLAT_KG, bucketBody, dailyBody, linearFit, linearTrend, lowestWeights, weightChanges,
  type BodyDay, type BodyMetric, type BodyMetricKey, type Trend,
} from '@/lib/bodyComp'
import type { BodyReading } from '@/lib/renpho'
import type { ZeppDailyRow } from '@/lib/zeppDaily'
import RenphoSync from './RenphoSync'
import WeightChange, { TrendBadge, signed } from './WeightChange'

// Validated (dataviz validator, dark #141414): fat ↔ fat-free pair; single series use the teal.
const BODY_COLORS = { fat: '#C7851F', fatFree: '#00A893', reading: '#8A8A8A' }

const RANGES = [
  { key: 'month', label: 'Month', days: 30 },
  { key: '3m', label: '3 months', days: 91 },
  { key: '6m', label: '6 months', days: 182 },
  { key: 'year', label: 'Year', days: 365 },
  { key: 'all', label: 'All', days: null },
] as const
type RangeKey = (typeof RANGES)[number]['key']

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const bucketLabel = (date: string, size: BucketSize) =>
  size === 'month' ? `${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(2, 4)}` : fmtDay(date)
const PER: Record<BucketSize, string> = { day: 'each day', week: 'weekly average', month: 'monthly average' }
const sub = 'var(--color-text-subtle)'

// Legend text stays neutral; the swatch beside it carries the series colour.
const legendText = (value: string) => <span style={{ color: '#A0A0A0' }}>{value}</span>

const dayCount = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
const metricTrend = (days: BodyDay[], key: BodyMetricKey) =>
  linearTrend(days.map(d => ({ date: d.date, value: d[key] })), TREND_FLAT[key])

function ChartCard({ title, sub: s, height = 'h-56', badge, children }: {
  title: string; sub: string; height?: string; badge?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <Card hover={false}>
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <p className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>{title}</p>
        {badge}
      </div>
      <p className="text-xs mb-4" style={{ color: sub }}>{s}</p>
      <div className={height}>{children}</div>
    </Card>
  )
}

// Week and month points are averages, so the fitted line is read at the middle of each period.
const MID_OFFSET: Record<BucketSize, number> = { day: 0, week: 3, month: 14 }

function MetricChart({ metric, data, days, size, trend }: {
  metric: BodyMetric; data: (BodyDay & { label: string })[]; days: BodyDay[]; size: BucketSize; trend: Trend | null
}) {
  const { digits, unit } = metric
  const pad = digits === 0 ? 1 : digits === 2 ? 0.05 : 0.2
  const fixed = (v: number) => v.toFixed(digits)
  // Straight best-fit line through the daily readings (the same fit as the badge).
  const withFit = useMemo(() => {
    const fit = trend ? linearFit(days.map(d => ({ date: d.date, value: d[metric.key] }))) : null
    return fit ? data.map(d => ({ ...d, fit: fit.at(shiftDay(d.date, MID_OFFSET[size])) })) : data
  }, [data, days, size, trend, metric.key])
  return (
    <ChartCard title={metric.label} sub={metric.note} height="h-40"
      badge={<TrendBadge trend={trend} unit={unit} digits={Math.min(digits + 1, 2)} />}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={withFit} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="#1E1E1E" vertical={false} />
          <XAxis dataKey="label" {...axisProps} minTickGap={28} />
          <YAxis {...axisProps} width={46} allowDecimals={digits > 0} tickFormatter={v => fixed(Number(v))}
            domain={[(min: number) => min - pad, (max: number) => max + pad]} />
          <Tooltip {...chartTooltipStyle} formatter={(v, name) => [`${fixed(Number(v))}${unit}`, name]} />
          <Line dataKey={metric.key} name={metric.label} stroke={BODY_COLORS.fatFree} strokeWidth={2} dot={data.length <= 31 ? { r: 2.5, strokeWidth: 0, fill: BODY_COLORS.fatFree } : false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#141414', fill: BODY_COLORS.fatFree }} connectNulls isAnimationActive={false} />
          {trend && (
            <Line dataKey="fit" name="Trend" stroke="#8A8A8A" strokeWidth={1.5} strokeDasharray="5 4" dot={false} activeDot={false} isAnimationActive={false} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

const TILES: { key: BodyMetricKey; label: string; digits: number; unit: string }[] = [
  { key: 'body_fat_pct', label: 'Body fat (%)', digits: 1, unit: '' },
  { key: 'fat_mass_kg', label: 'Fat mass (kg)', digits: 1, unit: '' },
  { key: 'fat_free_kg', label: 'Fat-free mass (kg)', digits: 1, unit: '' },
  { key: 'muscle_pct', label: 'Muscle (%)', digits: 1, unit: '' },
  { key: 'visceral_fat', label: 'Visceral fat', digits: 0, unit: '' },
]

const TABLE: { key: BodyMetricKey; label: string; digits: number }[] = [
  { key: 'body_fat_pct', label: 'Fat %', digits: 1 },
  { key: 'fat_mass_kg', label: 'Fat kg', digits: 1 },
  { key: 'fat_free_kg', label: 'Fat-free kg', digits: 1 },
  { key: 'muscle_pct', label: 'Muscle %', digits: 1 },
  { key: 'water_pct', label: 'Water %', digits: 1 },
  { key: 'visceral_fat', label: 'Visceral', digits: 0 },
]

/** Weight & Body tab: Renpho weight, body composition charts and the sync button. */
export default function BodyTab({ rows, readings, today, onSynced }: {
  rows: ZeppDailyRow[]            // weight_kg / weight_am_kg, kept current by renpho-sync
  readings: BodyReading[]
  today: string
  onSynced: () => void
}) {
  const [range, setRange] = useState<RangeKey>('6m')
  const [lowestOnly, setLowestOnly] = useState(false)
  const rangeDays = RANGES.find(r => r.key === range)!.days
  const lowest = lowestOnly && readings.length > 0

  const allDays = useMemo(() => dailyBody(readings, lowest ? 'lowest' : 'first'), [readings, lowest])
  const weightAll = useMemo(() => weightTrend(
    lowest ? lowestWeights(readings).filter(w => w.date <= today)
      : rows.filter(r => r.date <= today).map(r => ({ date: r.date, weightKg: r.weight_kg, morningKg: r.weight_am_kg })),
  ), [rows, readings, lowest, today])

  const firstData = [allDays[0]?.date, weightAll[0]?.date].filter(Boolean).sort()[0] ?? today
  const start = rangeDays != null ? shiftDay(today, -(rangeDays - 1)) : firstData
  const size = bucketSizeFor(dayCount(start, today))

  const days = useMemo(() => allDays.filter(d => d.date >= start), [allDays, start])
  const chartData = useMemo(() => bucketBody(days, size).map(d => ({ ...d, label: bucketLabel(d.date, size) })), [days, size])

  // If the range has under 2 readings, show the latest few so the chart is never empty.
  const { weightData, weightFallback } = useMemo(() => {
    let pts = weightAll.filter(w => w.date >= start)
    const fallback = pts.length < 2 && weightAll.length > pts.length
    if (fallback) pts = [...weightAll.filter(w => w.date < start).slice(-(6 - pts.length)), ...pts]
    return { weightData: pts.map(w => ({ ...w, label: fmtDay(w.date) })), weightFallback: fallback }
  }, [weightAll, start])
  const lastWeight = weightData[weightData.length - 1]
  const weightFit = useMemo(
    () => (weightFallback ? null : linearTrend(weightData.map(w => ({ date: w.date, value: w.weightKg })), WEIGHT_FLAT_KG)),
    [weightData, weightFallback],
  )
  const inRange = weightFallback ? [] : weightData.map(w => w.weightKg)
  const period = size === 'month' ? 'month' : 'week'
  const changeBars = useMemo(
    () => weightChanges(weightAll, period, start).map(b => ({ ...b, label: bucketLabel(b.date, period) })),
    [weightAll, period, start],
  )
  const per = size === 'day' ? `${lowest ? 'lowest' : 'first'} reading ${PER.day}` : `${PER[size]} of ${lowest ? 'lowest' : 'first'} daily readings`

  const recent = allDays.slice(-7).reverse()
  const manyPoints = weightData.length > 120
  const fatFreeThin = chartData.length > 31

  return (
    <div className="space-y-6">
      <RenphoSync onSynced={onSynced} />

      {/* Range: scrolls sideways on narrow phones rather than wrapping */}
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1" role="group" aria-label="Range">
        {RANGES.map(r => (
          <button
            key={r.key} type="button" onClick={() => setRange(r.key)} aria-pressed={range === r.key}
            className="px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0"
            style={{ background: range === r.key ? 'rgba(0,191,165,0.12)' : '#1E1E1E', color: range === r.key ? '#00BFA5' : '#A0A0A0', border: '1px solid #2E2E2E' }}
          >
            {r.label}
          </button>
        ))}
        <button
          type="button" onClick={() => setLowestOnly(v => !v)} aria-pressed={lowestOnly} disabled={!readings.length}
          className="sm:ml-auto px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0"
          style={{ background: lowestOnly ? 'rgba(0,191,165,0.12)' : '#1E1E1E', color: lowestOnly ? '#00BFA5' : '#A0A0A0', border: `1px solid ${lowestOnly ? '#00BFA5' : '#2E2E2E'}`, cursor: readings.length ? 'pointer' : 'default' }}
        >
          Lowest of day
        </button>
      </div>

      <div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatTile value={lastWeight ? lastWeight.weightKg.toFixed(1) : '—'} animate={false}
            label={`Weight (kg)${weightFit ? ` · ${signed(weightFit.total, 1)}` : ''}`} />
          {TILES.map(t => {
            const latest = days.findLast(d => d[t.key] != null)?.[t.key]
            const fit = metricTrend(days, t.key)
            return (
              <StatTile key={t.key} value={latest != null ? latest.toFixed(t.digits) : '—'} animate={false}
                label={`${t.label}${fit ? ` · ${signed(fit.total, 1)}` : ''}`} />
            )
          })}
        </div>
        <p className="text-xs mt-2" style={{ color: sub }}>Latest value, then the best-fit change across the selected range.</p>
      </div>

      <ChartCard
        title="Bodyweight"
        badge={<TrendBadge trend={weightFit} unit=" kg" digits={2} />}
        sub={!weightData.length ? 'No scale readings yet'
          : weightFallback ? `No reading in this range. Last one ${lastWeight.weightKg} kg on ${lastWeight.label}; showing your latest readings.`
            : lowest ? 'Lowest reading each day (kg) with its 7-day average'
              : 'Daily readings (kg) with the 7-day trend of lowest morning weights'}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={weightData} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="#1E1E1E" vertical={false} />
            <XAxis dataKey="label" {...axisProps} minTickGap={24} />
            <YAxis {...axisProps} width={48} allowDecimals={false}
              domain={[(min: number) => Math.floor(min - 0.5), (max: number) => Math.ceil(max + 0.5)]} />
            <Tooltip {...chartTooltipStyle} formatter={(v, name) => [`${v} kg`, name]} />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={legendText} />
            {/* Readings: dots only (recessive grey); trend: the line to read. */}
            <Line dataKey="weightKg" name={lowest ? 'Lowest of day' : 'Reading'} stroke={BODY_COLORS.reading} strokeWidth={0} isAnimationActive={false} legendType="circle"
              dot={manyPoints ? { r: 1.5, strokeWidth: 0, fill: BODY_COLORS.reading } : { r: 3, strokeWidth: 1, stroke: '#141414', fill: BODY_COLORS.reading }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#141414', fill: '#A0A0A0' }} />
            <Line dataKey="trendKg" name="7-day average" stroke={BODY_COLORS.fatFree} strokeWidth={2} dot={false} type="monotone" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <WeightChange
        weight={weightFit} fat={metricTrend(days, 'fat_mass_kg')} fatFree={metricTrend(days, 'fat_free_kg')}
        lowest={inRange.length ? Math.min(...inRange) : null} highest={inRange.length ? Math.max(...inRange) : null}
        bars={changeBars} period={period}
      />

      {chartData.length > 0 ? (
        <>
          <ChartCard title="What your weight is made of" sub={`Fat and fat-free mass in kg, ${per}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="#1E1E1E" vertical={false} />
                <XAxis dataKey="label" {...axisProps} minTickGap={24} />
                <YAxis {...axisProps} width={48} />
                <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v, name) => [`${Number(v).toFixed(1)} kg`, name]} />
                {/* itemSorter null: keep stack order, not A–Z */}
                <Legend wrapperStyle={{ fontSize: 11 }} itemSorter={null} formatter={legendText} />
                <Bar dataKey="fat_free_kg" name="Fat-free mass" stackId="body" fill={BODY_COLORS.fatFree} maxBarSize={18}
                  stroke={fatFreeThin ? 'none' : '#141414'} strokeWidth={fatFreeThin ? 0 : 1} isAnimationActive={false} />
                <Bar dataKey="fat_mass_kg" name="Fat mass" stackId="body" fill={BODY_COLORS.fat} radius={fatFreeThin ? 0 : [4, 4, 0, 0]} maxBarSize={18}
                  stroke={fatFreeThin ? 'none' : '#141414'} strokeWidth={fatFreeThin ? 0 : 1} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div>
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#00BFA5' }}>Body composition · {per}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {BODY_METRICS.map(m => <MetricChart key={m.key} metric={m} data={chartData} days={days} size={size} trend={metricTrend(days, m.key)} />)}
            </div>
          </div>
        </>
      ) : (
        <Card hover={false}>
          <p className="text-sm" style={{ color: sub }}>No body composition readings in this range.</p>
        </Card>
      )}

      {recent.length > 0 && (
        <Card hover={false}>
          <p className="text-sm font-bold mb-3" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>Recent readings</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr>
                  <th scope="col" className="text-left font-medium pb-2 pr-4 text-xs" style={{ color: sub, fontFamily: 'var(--font-sans)' }}>Date</th>
                  {TABLE.map(c => <th key={c.key} scope="col" className="text-right font-medium pb-2 pl-4 text-xs whitespace-nowrap" style={{ color: sub, fontFamily: 'var(--font-sans)' }}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {recent.map(d => (
                  <tr key={d.date} style={{ borderTop: '1px solid #2E2E2E' }}>
                    <td className="py-2 pr-4 whitespace-nowrap" style={{ color: '#F5F5F5' }}>{fmtDay(d.date)}</td>
                    {TABLE.map(c => <td key={c.key} className="py-2 pl-4 text-right" style={{ color: '#A0A0A0' }}>{d[c.key]?.toFixed(c.digits) ?? '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="text-xs" style={{ color: sub }}>
        Body composition is estimated from a small electrical signal, so single readings swing with food, water and training. Read the trend, not the day. Only your own Renpho profile is synced.
      </p>
    </div>
  )
}
