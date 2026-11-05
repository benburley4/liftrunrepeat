'use client'

import { useMemo, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend, Cell,
} from 'recharts'
import Card from '@/components/ui/Card'
import StatTile from '@/components/ui/StatTile'
import { chartTooltipStyle, axisProps, fmtDay } from '@/components/recovery/chartStyle'
import { BalanceDay, BurnEstimate, summarizeBalance, weightTrend, bucketBalance, bucketSizeFor, BucketSize } from '@/lib/nutrition'

// Validated (dataviz validator, dark #141414): resting ↔ active ↔ eaten categorical set; deficit ↔ surplus polarity.
export const ENERGY_COLORS = { resting: '#C7851F', active: '#00A893', burned: '#00A893', eaten: '#8B6CF0', deficit: '#00A893', surplus: '#D9474C' }

const RANGES = [
  { key: 'week', label: 'Week', days: 7 },
  { key: 'month', label: 'Month', days: 30 },
  { key: '6m', label: '6 months', days: 182 },
  { key: 'year', label: 'Year', days: 365 },
  { key: 'all', label: 'All', days: null },
] as const
type RangeKey = (typeof RANGES)[number]['key']

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const bucketLabel = (start: string, size: BucketSize) =>
  size === 'month' ? `${MONTHS[Number(start.slice(5, 7)) - 1]} ${start.slice(2, 4)}` : fmtDay(start)
const PER: Record<BucketSize, string> = { day: 'per day', week: 'daily average per week', month: 'daily average per month' }
const sub = 'var(--color-text-subtle)'
const fmtSigned = (n: number) => `${n > 0 ? '+' : ''}${n}`

function ChartCard({ title, sub: s, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <Card hover={false}>
      <p className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>{title}</p>
      <p className="text-xs mb-4" style={{ color: sub }}>{s}</p>
      <div className="h-56">{children}</div>
    </Card>
  )
}

export default function EnergyBalance({
  days, today, todayEaten, todayBurn, missingStats,
}: {
  days: BalanceDay[]           // oldest → newest, ending today; 'All' = everything passed in
  today: string
  todayEaten: number
  todayBurn: BurnEstimate | null
  missingStats: string[]       // e.g. ['height'] — burned can't be estimated without them
}) {
  const [range, setRange] = useState<RangeKey>('month')
  const rangeDays = RANGES.find(r => r.key === range)!.days
  // 'All' = from the first day with a meal logged (at least a week).
  const shown = useMemo(() => {
    if (rangeDays != null) return days.slice(-rangeDays)
    const first = days.findIndex(d => d.eaten != null)
    return first < 0 ? days.slice(-7) : days.slice(Math.min(first, Math.max(0, days.length - 7)))
  }, [days, rangeDays])
  const summary = useMemo(() => summarizeBalance(shown, today), [shown, today])
  const size = bucketSizeFor(shown.length)
  const chartData = useMemo(
    () => bucketBalance(shown, size).map(b => ({ ...b, label: bucketLabel(b.start, size) })),
    [shown, size],
  )
  const wideBars = chartData.length <= 31
  const fmtAvg = (n: number | null, unit = '') => (n == null ? '—' : `${n.toLocaleString('en-GB')}${unit}`)
  // Trend uses all loaded days so the first points of a short range still have history behind them.
  const weightData = useMemo(() => {
    const first = shown[0]?.date ?? today
    return weightTrend(days).filter(w => w.date >= first).map(w => ({ ...w, label: fmtDay(w.date) }))
  }, [days, shown, today])
  const todayDeficit = todayBurn ? todayBurn.total - Math.round(todayEaten) : null

  return (
    <div className="space-y-6">
      {missingStats.length > 0 && (
        <Card tint="#F59E0B" hover={false}>
          <p className="text-sm" style={{ color: '#F5F5F5' }}>
            Add your {missingStats.join(', ')} on the <a href="/profile" className="underline">Profile</a> page to estimate calories burned and your deficit.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile value={Math.round(todayEaten)} label="Eaten today (kcal)" accent="#F5F5F5" />
        <StatTile value={todayBurn ? todayBurn.bmr : '—'} label="Resting (kcal / day)" accent="#F5F5F5" />
        <StatTile value={todayBurn ? todayBurn.active : '—'} label="Active so far (kcal)" accent="#F5F5F5" />
        <StatTile
          value={todayDeficit != null ? fmtSigned(todayDeficit) : '—'}
          label={todayDeficit == null ? 'Deficit' : todayDeficit >= 0 ? 'Deficit so far' : 'Surplus so far'}
          accent={todayDeficit == null ? '#F5F5F5' : todayDeficit >= 0 ? '#00BFA5' : '#E5484D'}
          animate={false}
        />
      </div>
      {todayBurn && (
        <p className="text-xs -mt-3" style={{ color: sub }}>
          Burned so far {todayBurn.total} = resting {todayBurn.bmr} (what your body uses at rest — Mifflin–St Jeor from your profile) + active {todayBurn.active}
          {todayBurn.activeSource === 'watch' ? ' (movement and workouts, from your watch)' : todayBurn.activeSource === 'steps' ? ' (estimated from steps)' : ' (no watch activity yet)'}.
          Today is still in progress.
        </p>
      )}

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
      </div>

      <div>
        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#00BFA5' }}>
          Daily averages · {summary.loggedDays} logged day{summary.loggedDays === 1 ? '' : 's'}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatTile value={fmtAvg(summary.avgEaten)} label="Eaten (kcal)" animate={false} />
          <StatTile value={fmtAvg(summary.avgBurned)} label="Burned (kcal)" animate={false} />
          <StatTile value={fmtAvg(summary.avgResting)} label="Resting (kcal)" animate={false} />
          <StatTile value={fmtAvg(summary.avgActive)} label="Active (kcal)" animate={false} />
          <StatTile value={summary.avgDeficit != null ? fmtSigned(summary.avgDeficit) : '—'} label={summary.avgDeficit != null && summary.avgDeficit < 0 ? 'Surplus (kcal)' : 'Deficit (kcal)'} animate={false}
            accent={summary.avgDeficit == null ? '#F5F5F5' : summary.avgDeficit >= 0 ? '#00BFA5' : '#E5484D'} />
          <StatTile value={fmtAvg(summary.avgProtein, 'g')} label="Protein" animate={false} />
          <StatTile value={fmtAvg(summary.avgCarbs, 'g')} label="Carbs" animate={false} />
          <StatTile value={fmtAvg(summary.avgFat, 'g')} label="Fat" animate={false} />
          <StatTile value={summary.expectedChangeKg != null ? fmtSigned(summary.expectedChangeKg) : '—'} label="Expected change (kg)" animate={false} />
          <StatTile value={summary.actualChangeKg != null ? fmtSigned(summary.actualChangeKg) : '—'} label="Scale change (kg)" animate={false} />
        </div>
      </div>
      <p className="text-xs -mt-3" style={{ color: sub }}>
        Averages use completed days with meals logged (today is left out until it&apos;s over). Expected change assumes ~7,700 kcal per kg;
        if the scale moves much less than expected, meals are probably under-logged or under-estimated.
      </p>

      <ChartCard title="Eaten vs burned" sub={`kcal ${PER[size]} — burned is resting + active stacked; periods without logged meals show burned only`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={2} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="#1E1E1E" vertical={false} />
            <XAxis dataKey="label" {...axisProps} minTickGap={16} />
            <YAxis {...axisProps} width={48} />
            <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            {/* itemSorter null: keep stack order (Resting, Active, Eaten), not A–Z */}
            <Legend wrapperStyle={{ fontSize: 11, color: '#A0A0A0' }} itemSorter={null} />
            {/* Burned = resting + active, stacked. A 1px surface stroke per segment leaves a 2px gap —
                only when bars are wide enough; on thin (weekly/monthly) bars it would hide the fill. */}
            <Bar dataKey="resting" name="Resting" stackId="burned" fill={ENERGY_COLORS.resting} maxBarSize={18}
              stroke={wideBars ? '#141414' : 'none'} strokeWidth={wideBars ? 1 : 0} />
            <Bar dataKey="active" name="Active" stackId="burned" fill={ENERGY_COLORS.active} radius={wideBars ? [4, 4, 0, 0] : 0} maxBarSize={18}
              stroke={wideBars ? '#141414' : 'none'} strokeWidth={wideBars ? 1 : 0} />
            <Bar dataKey="eaten" name="Eaten" fill={ENERGY_COLORS.eaten} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={size === 'day' ? 'Daily deficit' : 'Average daily deficit'} sub={`Burned − eaten, ${PER[size]}. Above zero = deficit, below = surplus`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="#1E1E1E" vertical={false} />
            <XAxis dataKey="label" {...axisProps} minTickGap={16} />
            <YAxis {...axisProps} width={48} />
            <ReferenceLine y={0} stroke="#606060" />
            <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              formatter={(v) => [`${fmtSigned(Number(v))} kcal`, Number(v) >= 0 ? 'Deficit' : 'Surplus']} />
            <Bar dataKey="deficit" name="Deficit" radius={4} maxBarSize={18}>
              {chartData.map(d => <Cell key={d.start} fill={(d.deficit ?? 0) >= 0 ? ENERGY_COLORS.deficit : ENERGY_COLORS.surplus} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Bodyweight" sub={weightData.length ? 'Smart-scale readings (kg) with 7-day average trend' : 'No scale readings in this range'}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={weightData} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="#1E1E1E" vertical={false} />
            <XAxis dataKey="label" {...axisProps} minTickGap={16} />
            <YAxis {...axisProps} width={48} allowDecimals={false}
              domain={[(min: number) => Math.floor(min - 0.5), (max: number) => Math.ceil(max + 0.5)]} />
            <Tooltip {...chartTooltipStyle} formatter={(v, name) => [`${v} kg`, name]} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#A0A0A0' }} />
            {/* Readings: dots only (recessive grey); trend: the line to read. */}
            <Line dataKey="weightKg" name="Reading" stroke="#8A8A8A" strokeWidth={0} isAnimationActive={false}
              dot={{ r: 4, strokeWidth: 2, stroke: '#141414', fill: '#8A8A8A' }} activeDot={{ r: 5, strokeWidth: 2, stroke: '#141414', fill: '#A0A0A0' }} legendType="circle" />
            <Line dataKey="trendKg" name="7-day average" stroke={ENERGY_COLORS.burned} strokeWidth={2} dot={false} type="monotone" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
