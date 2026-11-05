'use client'

import { useMemo, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend, Cell,
} from 'recharts'
import Card from '@/components/ui/Card'
import StatTile from '@/components/ui/StatTile'
import { chartTooltipStyle, axisProps, fmtDay } from '@/components/recovery/chartStyle'
import { BalanceDay, BurnEstimate, summarizeBalance } from '@/lib/nutrition'

// Validated (dataviz validator, dark #141414): burned ↔ eaten categorical pair; deficit ↔ surplus polarity.
export const ENERGY_COLORS = { burned: '#00A893', eaten: '#8B6CF0', deficit: '#00A893', surplus: '#D9474C' }

const RANGES = [7, 30, 90] as const
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
  days: BalanceDay[]           // oldest → newest, ending today
  today: string
  todayEaten: number
  todayBurn: BurnEstimate | null
  missingStats: string[]       // e.g. ['height'] — burned can't be estimated without them
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(30)
  const shown = useMemo(() => days.slice(-range), [days, range])
  const summary = useMemo(() => summarizeBalance(shown, today), [shown, today])
  const chartData = shown.map(d => ({ ...d, label: fmtDay(d.date) }))
  const weightData = chartData.filter(d => d.weightKg != null)
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
        <StatTile value={todayBurn ? todayBurn.total : '—'} label="Burned so far (kcal)" accent="#F5F5F5" />
        <StatTile
          value={todayDeficit != null ? fmtSigned(todayDeficit) : '—'}
          label={todayDeficit == null ? 'Deficit' : todayDeficit >= 0 ? 'Deficit so far' : 'Surplus so far'}
          accent={todayDeficit == null ? '#F5F5F5' : todayDeficit >= 0 ? '#00BFA5' : '#E5484D'}
          animate={false}
        />
        <StatTile value={todayBurn ? todayBurn.bmr : '—'} label="Resting burn / day" accent="#F5F5F5" />
      </div>
      {todayBurn && (
        <p className="text-xs -mt-3" style={{ color: sub }}>
          Burned = resting {todayBurn.bmr} (Mifflin–St Jeor) + active {todayBurn.active} kcal
          {todayBurn.activeSource === 'watch' ? ' from your watch' : todayBurn.activeSource === 'steps' ? ' estimated from steps' : ' (no watch activity yet)'}.
          Today is still in progress.
        </p>
      )}

      <div className="flex gap-2" role="group" aria-label="Range">
        {RANGES.map(r => (
          <button
            key={r} type="button" onClick={() => setRange(r)} aria-pressed={range === r}
            className="px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: range === r ? 'rgba(0,191,165,0.12)' : '#1E1E1E', color: range === r ? '#00BFA5' : '#A0A0A0', border: '1px solid #2E2E2E' }}
          >
            {r} days
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile value={summary.avgDeficit != null ? fmtSigned(summary.avgDeficit) : '—'} label={`Avg daily deficit (${summary.loggedDays} logged days)`} animate={false}
          accent={summary.avgDeficit == null ? '#F5F5F5' : summary.avgDeficit >= 0 ? '#00BFA5' : '#E5484D'} />
        <StatTile value={summary.avgEaten ?? '—'} label="Avg eaten (kcal)" />
        <StatTile value={summary.expectedChangeKg != null ? `${fmtSigned(summary.expectedChangeKg)} kg` : '—'} label="Expected change from deficit" animate={false} />
        <StatTile value={summary.actualChangeKg != null ? `${fmtSigned(summary.actualChangeKg)} kg` : '—'} label="Scale change" animate={false} />
      </div>
      <p className="text-xs -mt-3" style={{ color: sub }}>
        Averages use completed days with meals logged. Expected change assumes ~7,700 kcal per kg; if the scale moves much less than
        expected, meals are probably under-logged or under-estimated.
      </p>

      <ChartCard title="Eaten vs burned" sub="kcal per day — days without logged meals show burned only">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={2} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="#1E1E1E" vertical={false} />
            <XAxis dataKey="label" {...axisProps} minTickGap={16} />
            <YAxis {...axisProps} width={48} />
            <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#A0A0A0' }} />
            <Bar dataKey="burned" name="Burned" fill={ENERGY_COLORS.burned} radius={[4, 4, 0, 0]} maxBarSize={18} />
            <Bar dataKey="eaten" name="Eaten" fill={ENERGY_COLORS.eaten} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Daily deficit" sub="Burned − eaten. Above zero = deficit, below = surplus">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="#1E1E1E" vertical={false} />
            <XAxis dataKey="label" {...axisProps} minTickGap={16} />
            <YAxis {...axisProps} width={48} />
            <ReferenceLine y={0} stroke="#606060" />
            <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              formatter={(v) => [`${fmtSigned(Number(v))} kcal`, Number(v) >= 0 ? 'Deficit' : 'Surplus']} />
            <Bar dataKey="deficit" name="Deficit" radius={4} maxBarSize={18}>
              {chartData.map(d => <Cell key={d.date} fill={(d.deficit ?? 0) >= 0 ? ENERGY_COLORS.deficit : ENERGY_COLORS.surplus} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Bodyweight" sub={weightData.length ? 'Smart-scale readings (kg)' : 'No scale readings in this range'}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={weightData} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="#1E1E1E" vertical={false} />
            <XAxis dataKey="label" {...axisProps} minTickGap={16} />
            <YAxis {...axisProps} width={48} domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={(v: number) => v.toFixed(0)} />
            <Tooltip {...chartTooltipStyle} formatter={(v) => [`${v} kg`, 'Weight']} />
            <Line dataKey="weightKg" name="Weight" stroke={ENERGY_COLORS.burned} strokeWidth={2} dot={{ r: 4, strokeWidth: 0, fill: ENERGY_COLORS.burned }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
