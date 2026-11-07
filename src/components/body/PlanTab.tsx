'use client'

import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import Card from '@/components/ui/Card'
import StatTile from '@/components/ui/StatTile'
import { chartTooltipStyle, axisProps, fmtDay } from '@/components/recovery/chartStyle'
import { upsertSetting } from '@/lib/db'
import { proteinTarget, weightTrend, type BalanceDay } from '@/lib/nutrition'
import {
  MAX_PLAN_WEEKS, WEIGHT_PLAN_KEY, planEndDate, planIssue, planNumbers, planProgress, planSchedule, recentBurn,
  type PlanNumbers, type PlanPace, type WeightPlan,
} from '@/lib/weightPlan'
import type { ZeppDailyRow } from '@/lib/zeppDaily'

const EATEN_DAYS = 14
const sub = 'var(--color-text-subtle)'
const WARN = '#F59E0B'

const PACE_LABEL: Record<PlanPace, string> = { gentle: 'Gentle', steady: 'Steady', fast: 'Fast' }

const legendText = (value: string) => <span style={{ color: '#A0A0A0' }}>{value}</span>
const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null)

function PlanFigures({ n, proteinG }: { n: PlanNumbers; proteinG: number | null }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <StatTile value={n.perWeekKg.toFixed(2)} label="Loss per week (kg)" animate={false} />
      <StatTile value={PACE_LABEL[n.pace]} label={`Pace · ${n.pctPerWeek.toFixed(1)}% a week`} animate={false} />
      <StatTile value={n.dailyDeficit.toLocaleString('en-GB')} label="Daily deficit (kcal)" animate={false} />
      <StatTile value={n.calorieTarget != null ? n.calorieTarget.toLocaleString('en-GB') : '—'} label="Eat per day (kcal)" animate={false} />
      <StatTile value={proteinG ?? '—'} label="Protein per day (g)" animate={false} />
    </div>
  )
}

function PlanWarnings({ n, burn }: { n: PlanNumbers; burn: number | null }) {
  return (
    <>
      {n.belowResting && (
        <p className="text-sm" style={{ color: WARN }}>
          This pace would mean eating less than your resting burn, so the target above stops there and you&apos;d lose more slowly than planned.
          {n.weeksAtResting != null && ` About ${n.weeksAtResting} weeks would suit this target.`}
        </p>
      )}
      {!n.belowResting && n.pace === 'fast' && (
        <p className="text-sm" style={{ color: WARN }}>
          That&apos;s over 1% of your bodyweight a week, which makes losing muscle more likely. Adding weeks would ease it.
        </p>
      )}
      {burn == null && (
        <p className="text-sm" style={{ color: sub }}>
          Add your height, date of birth and sex on the <a href="/profile" className="underline">Profile</a> page to get a calorie target.
        </p>
      )}
    </>
  )
}

/** Plan tab: pick a target and a number of weeks; see the rate, calories and schedule. */
export default function PlanTab({ plan, loaded, onPlanChange, rows, balance, bmr, today }: {
  plan: WeightPlan | null
  loaded: boolean
  onPlanChange: (plan: WeightPlan | null) => void
  rows: ZeppDailyRow[]
  balance: BalanceDay[]
  bmr: number | null       // today's resting burn
  today: string
}) {
  const [editing, setEditing] = useState(false)
  const [target, setTarget] = useState('')
  const [weeks, setWeeks] = useState('12')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const actual = useMemo(() => weightTrend(
    rows.filter(r => r.date <= today).map(r => ({ date: r.date, weightKg: r.weight_kg, morningKg: r.weight_am_kg })),
  ), [rows, today])
  const latest = actual[actual.length - 1] ?? null
  const currentKg = latest?.trendKg ?? null

  const burn = recentBurn(balance, today)
  const eaten = mean(balance.filter(d => d.date < today).slice(-EATEN_DAYS).flatMap(d => (d.eaten != null ? [d.eaten] : [])))
  const proteinG = proteinTarget(currentKg)

  const targetKg = Number(target)
  const weekCount = Number(weeks)
  const issue = planIssue(currentKg, targetKg, weekCount)
  const draft = !issue && currentKg != null ? planNumbers({ startKg: currentKg, targetKg, weeks: weekCount }, burn, bmr) : null

  async function save() {
    if (issue || currentKg == null) return
    const next: WeightPlan = { startDate: today, startKg: currentKg, targetKg, weeks: weekCount }
    setSaving(true)
    setError('')
    try {
      await upsertSetting(WEIGHT_PLAN_KEY, JSON.stringify(next))
      onPlanChange(next)
      setEditing(false)
    } catch { setError('Could not save your plan') } finally { setSaving(false) }
  }

  async function remove() {
    if (!confirm('Delete this plan?')) return
    try {
      await upsertSetting(WEIGHT_PLAN_KEY, null)
      onPlanChange(null)
      setEditing(false)
    } catch { setError('Could not delete your plan') }
  }

  function startEdit() {
    if (plan) { setTarget(String(plan.targetKg)); setWeeks(String(plan.weeks)) }
    setEditing(true)
  }

  const schedule = useMemo(() => (plan ? planSchedule(plan, actual, today) : []), [plan, actual, today])
  const chartData = useMemo(() => schedule.map(w => ({ ...w, label: fmtDay(w.date) })), [schedule])

  if (!loaded) return null

  const inputStyle = { background: '#1E1E1E', border: '1px solid #2E2E2E', color: '#F5F5F5', colorScheme: 'dark' as const }

  if (!plan || editing) {
    return (
      <div className="space-y-6">
        <Card hover={false}>
          <p className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>{plan ? 'Change your plan' : 'Set a weight-loss plan'}</p>
          <p className="text-xs mb-4" style={{ color: sub }}>
            {currentKg != null ? `Starts from your current trend weight, ${currentKg.toFixed(1)} kg.` : 'Needs a scale reading to start from.'}
            {plan ? ' Saving restarts the plan from today.' : ''}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <label className="text-xs" style={{ color: sub }}>
              Target weight (kg)
              <input type="number" inputMode="decimal" step="0.1" min={1} value={target} onChange={e => setTarget(e.target.value)}
                className="mt-1 w-full rounded-lg px-3 py-2 text-base sm:text-sm" style={inputStyle} />
            </label>
            <label className="text-xs" style={{ color: sub }}>
              Number of weeks
              <input type="number" inputMode="numeric" step="1" min={1} max={MAX_PLAN_WEEKS} value={weeks} onChange={e => setWeeks(e.target.value)}
                className="mt-1 w-full rounded-lg px-3 py-2 text-base sm:text-sm" style={inputStyle} />
            </label>
          </div>
          {target !== '' && issue && <p className="text-sm mt-3" style={{ color: WARN }}>{issue}</p>}
          {error && <p className="text-sm mt-3" style={{ color: WARN }}>{error}</p>}
          <div className="flex gap-2 mt-4">
            <button type="button" onClick={save} disabled={!!issue || saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: issue || saving ? '#242424' : '#00BFA5', color: issue || saving ? '#A0A0A0' : '#0D0D0D', cursor: issue || saving ? 'default' : 'pointer' }}>
              {saving ? 'Saving…' : 'Save plan'}
            </button>
            {plan && (
              <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: '#1E1E1E', color: '#A0A0A0', border: '1px solid #2E2E2E', cursor: 'pointer' }}>
                Cancel
              </button>
            )}
          </div>
        </Card>

        {draft && (
          <div className="space-y-3">
            <PlanFigures n={draft} proteinG={proteinG} />
            <PlanWarnings n={draft} burn={burn} />
            {burn != null && (
              <p className="text-xs" style={{ color: sub }}>
                Calories use your average burn of {burn.toLocaleString('en-GB')} kcal a day over the last 28 days, and about 7,700 kcal per kg. These are estimates, not medical advice.
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  const numbers = planNumbers(plan, burn, bmr)
  const progress = planProgress(plan, latest, today)
  const finished = today >= planEndDate(plan)
  const statusWord = !progress ? '' : progress.state === 'ahead' ? 'Ahead of plan' : progress.state === 'behind' ? 'Behind plan' : 'On track'

  return (
    <div className="space-y-6">
      <Card hover={false}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest" style={{ color: '#00BFA5' }}>
              {plan.startKg.toFixed(1)} kg to {plan.targetKg.toFixed(1)} kg · {plan.weeks} week{plan.weeks === 1 ? '' : 's'} · ends {fmtDay(planEndDate(plan))}
            </p>
            {progress && (
              <>
                <p className="text-2xl font-black mt-1" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>{finished ? 'Plan finished' : statusWord}</p>
                <p className="text-sm" style={{ color: '#A0A0A0' }}>
                  Trend weight {progress.actualKg.toFixed(1)} kg, plan says {progress.expectedKg.toFixed(1)} kg
                  {progress.state !== 'on-track' ? ` (${Math.abs(progress.diffKg).toFixed(1)} kg ${progress.diffKg < 0 ? 'under' : 'over'})` : ''}.
                </p>
              </>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button type="button" onClick={startEdit} className="px-3 py-2 rounded-lg text-xs font-bold"
              style={{ background: '#1E1E1E', color: '#A0A0A0', border: '1px solid #2E2E2E', cursor: 'pointer' }}>Change plan</button>
            <button type="button" onClick={remove} className="px-3 py-2 rounded-lg text-xs font-bold"
              style={{ background: '#1E1E1E', color: '#A0A0A0', border: '1px solid #2E2E2E', cursor: 'pointer' }}>Delete</button>
          </div>
        </div>
        {error && <p className="text-sm mt-3" style={{ color: WARN }}>{error}</p>}
      </Card>

      {progress && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile value={Math.abs(progress.lostKg).toFixed(1)} label={progress.lostKg < 0 ? 'Gained so far (kg)' : 'Lost so far (kg)'} animate={false} />
          <StatTile value={progress.remainingKg.toFixed(1)} label="Still to lose (kg)" animate={false} />
          <StatTile value={Math.ceil(progress.daysLeft / 7)} label="Weeks left" animate={false} />
          <StatTile value={eaten != null ? eaten.toLocaleString('en-GB') : '—'} label={`Eaten per day, last ${EATEN_DAYS} days`} animate={false} />
        </div>
      )}

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-widest" style={{ color: '#00BFA5' }}>Your daily targets</p>
        <PlanFigures n={numbers} proteinG={proteinG} />
        <PlanWarnings n={numbers} burn={burn} />
        {burn != null && (
          <p className="text-xs" style={{ color: sub }}>
            Calories update with your average burn over the last 28 days ({burn.toLocaleString('en-GB')} kcal a day), and assume about 7,700 kcal per kg. These are estimates, not medical advice.
          </p>
        )}
      </div>

      <Card hover={false}>
        <p className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>Plan vs actual</p>
        <p className="text-xs mb-4" style={{ color: sub }}>Planned weight each week against your 7-day trend weight, in kg</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#1E1E1E" vertical={false} />
              <XAxis dataKey="label" {...axisProps} minTickGap={24} />
              <YAxis {...axisProps} width={48} allowDecimals={false}
                domain={[(min: number) => Math.floor(min - 0.5), (max: number) => Math.ceil(max + 0.5)]} />
              <Tooltip {...chartTooltipStyle} formatter={(v, name) => [`${Number(v).toFixed(1)} kg`, name]} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={legendText} />
              <Line dataKey="planKg" name="Plan" stroke="#8A8A8A" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              <Line dataKey="actualKg" name="Actual" stroke="#00A893" strokeWidth={2} connectNulls isAnimationActive={false}
                dot={{ r: 3, strokeWidth: 0, fill: '#00A893' }} activeDot={{ r: 4, strokeWidth: 2, stroke: '#141414', fill: '#00A893' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card hover={false}>
        <p className="text-sm font-bold mb-3" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>Week by week</p>
        <div className="overflow-auto" style={{ maxHeight: '360px' }}>
          <table className="w-full text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
            <thead>
              <tr>
                {['Week', 'Date', 'Plan kg', 'Actual kg', 'Difference'].map((h, i) => (
                  <th key={h} scope="col" className={`${i < 2 ? 'text-left' : 'text-right'} font-medium pb-2 px-2 text-xs whitespace-nowrap`} style={{ color: sub, fontFamily: 'var(--font-sans)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedule.map(w => (
                <tr key={w.week} style={{ borderTop: '1px solid #2E2E2E' }}>
                  <td className="py-2 px-2" style={{ color: '#F5F5F5' }}>{w.week === 0 ? 'Start' : w.week}</td>
                  <td className="py-2 px-2 whitespace-nowrap" style={{ color: '#A0A0A0' }}>{fmtDay(w.date)}</td>
                  <td className="py-2 px-2 text-right" style={{ color: '#A0A0A0' }}>{w.planKg.toFixed(1)}</td>
                  <td className="py-2 px-2 text-right" style={{ color: '#A0A0A0' }}>{w.actualKg?.toFixed(1) ?? '—'}</td>
                  <td className="py-2 px-2 text-right" style={{ color: '#A0A0A0' }}>
                    {w.actualKg != null ? `${w.actualKg - w.planKg > 0 ? '+' : ''}${(w.actualKg - w.planKg).toFixed(1)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
