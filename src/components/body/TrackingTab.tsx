'use client'

import { useMemo, type ReactNode } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import Card from '@/components/ui/Card'
import StatTile from '@/components/ui/StatTile'
import { chartTooltipStyle, axisProps, fmtDay } from '@/components/recovery/chartStyle'
import { compChange, dailyBody } from '@/lib/bodyComp'
import { proteinTarget, weightTrend, type BalanceDay } from '@/lib/nutrition'
import type { BodyReading } from '@/lib/renpho'
import { MIN_FIT_DAYS, planActuals, planEndDate, planNumbers, planProgress, planSchedule, recentBurn, type WeightPlan } from '@/lib/weightPlan'
import type { ZeppDailyRow } from '@/lib/zeppDaily'
import { ActualFigures, BurnNote, PlanFigures, PlanWarnings, sub } from './PlanFigures'

const legendText = (value: string) => <span style={{ color: '#A0A0A0' }}>{value}</span>
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
const signed = (n: number, digits: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits)}`

const heading = (text: string) => <p className="text-xs uppercase tracking-widest" style={{ color: '#00BFA5' }}>{text}</p>

/** Tracking tab: how the weight, body composition and food are going against the plan. */
export default function TrackingTab({ plan, loaded, rows, readings, balance, bmr, today, budget, onSetPlan }: {
  plan: WeightPlan | null
  loaded: boolean
  rows: ZeppDailyRow[]
  readings: BodyReading[]
  balance: BalanceDay[]
  bmr: number | null       // today's resting burn
  today: string
  budget: ReactNode        // today's calorie budget card, when the plan is running
  onSetPlan: () => void
}) {
  const actual = useMemo(() => weightTrend(
    rows.filter(r => r.date <= today).map(r => ({ date: r.date, weightKg: r.weight_kg, morningKg: r.weight_am_kg })),
  ), [rows, today])
  const latest = actual[actual.length - 1] ?? null
  // One reading per day for the fitted loss rate: the lowest morning one when there is one.
  const dailyKg = useMemo(() => rows.flatMap(r => {
    const kg = r.weight_am_kg ?? r.weight_kg
    return kg != null ? [{ date: r.date, kg }] : []
  }), [rows])
  const bodyDays = useMemo(() => dailyBody(readings), [readings])

  const schedule = useMemo(() => (plan ? planSchedule(plan, actual, today) : []), [plan, actual, today])
  const chartData = useMemo(() => schedule.map(w => ({ ...w, label: fmtDay(w.date) })), [schedule])

  if (!loaded) return null

  if (!plan) {
    return (
      <Card hover={false}>
        <p className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>No plan yet</p>
        <p className="text-sm mt-1" style={{ color: '#A0A0A0' }}>Set a target weight and a number of weeks, and this tab tracks your weight, body composition and food against it.</p>
        <button type="button" onClick={onSetPlan} className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: '#00BFA5', color: '#0D0D0D', cursor: 'pointer' }}>
          Set a plan
        </button>
      </Card>
    )
  }

  const burn = recentBurn(balance, today)
  const numbers = planNumbers(plan, burn, bmr)
  const actuals = planActuals(plan, dailyKg, balance, today)
  const progress = planProgress(plan, latest, today)
  const comp = compChange(bodyDays, plan.startDate, today)
  const end = planEndDate(plan)
  const finished = today >= end
  const planDaysDone = Math.max(0, Math.min(daysBetween(plan.startDate, today), plan.weeks * 7))
  const statusWord = !progress ? '' : progress.state === 'ahead' ? 'Ahead of plan' : progress.state === 'behind' ? 'Behind plan' : 'On track'

  return (
    <div className="space-y-6">
      <Card hover={false}>
        <p className="text-xs uppercase tracking-widest" style={{ color: '#00BFA5' }}>
          {plan.startKg.toFixed(1)} kg to {plan.targetKg.toFixed(1)} kg · started {fmtDay(plan.startDate)} · ends {fmtDay(end)}
        </p>
        {progress ? (
          <>
            <p className="text-2xl font-black mt-1" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>{finished ? 'Plan finished' : statusWord}</p>
            <p className="text-sm" style={{ color: '#A0A0A0' }}>
              Trend weight {progress.actualKg.toFixed(1)} kg, plan says {progress.expectedKg.toFixed(1)} kg
              {progress.state !== 'on-track' ? ` (${Math.abs(progress.diffKg).toFixed(1)} kg ${progress.diffKg < 0 ? 'under' : 'over'})` : ''}.
            </p>
          </>
        ) : <p className="text-sm mt-1" style={{ color: '#A0A0A0' }}>Waiting for a scale reading.</p>}
      </Card>

      {progress && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile value={Math.abs(progress.lostKg).toFixed(1)} label={progress.lostKg < 0 ? 'Gained so far (kg)' : 'Lost so far (kg)'} animate={false} />
          <StatTile value={progress.remainingKg.toFixed(1)} label="Still to lose (kg)" animate={false} />
          <StatTile value={Math.ceil(progress.daysLeft / 7)} label="Weeks left" animate={false} />
          <StatTile value={`${actuals.loggedDays}/${planDaysDone}`} label="Days with meals logged" animate={false} />
        </div>
      )}

      {budget}

      <div className="space-y-3">
        {heading('Your daily targets')}
        <PlanFigures n={numbers} proteinG={proteinTarget(latest?.trendKg ?? null)} />
        <PlanWarnings n={numbers} burn={burn} />
      </div>

      <div className="space-y-3">
        {heading('Your daily actuals')}
        <ActualFigures a={actuals} />
        <p className="text-xs" style={{ color: sub }}>
          Since the plan started on {fmtDay(plan.startDate)}. Loss per week is a straight line fitted through every daily weigh-in since then, so one heavy or light morning barely moves it
          {actuals.perWeekKg == null ? `; it appears on day ${MIN_FIT_DAYS} (today is day ${actuals.planDay}), before then water swings outweigh the real change` : ''}.
          {' '}{actuals.loggedDays
            ? `Food figures cover ${actuals.loggedDays} finished day${actuals.loggedDays === 1 ? '' : 's'} with meals logged; days with nothing logged and today are left out.`
            : 'Food figures appear once a finished plan day has meals logged.'}
        </p>
        <BurnNote burn={burn} />
      </div>

      <div className="space-y-3">
        {heading('Body composition since the start')}
        {comp ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatTile value={signed(comp.fatKg, 1)} label={`Fat mass (kg) · ${comp.from.fatKg.toFixed(1)} → ${comp.to.fatKg.toFixed(1)}`} animate={false} />
              <StatTile value={signed(comp.fatFreeKg, 1)} label={`Fat-free mass (kg) · ${comp.from.fatFreeKg.toFixed(1)} → ${comp.to.fatFreeKg.toFixed(1)}`} animate={false} />
              <StatTile value={signed(comp.bodyFatPct, 1)} label={`Body fat (points) · ${comp.from.bodyFatPct.toFixed(1)}% → ${comp.to.bodyFatPct.toFixed(1)}%`} animate={false} />
              <StatTile value={comp.fatShare != null ? `${comp.fatShare}%` : '—'} label="Of the weight lost, fat" animate={false} />
            </div>
            <p className="text-xs" style={{ color: sub }}>
              Averages of first-thing scale readings in the week up to {fmtDay(comp.from.date)} and up to {fmtDay(comp.to.date)}.
              {' '}Scale body composition swings with water and food, so read it over weeks, not days.
              {comp.fatShare == null && ' The fat share appears once you have lost at least 0.5 kg.'}
            </p>
          </>
        ) : (
          <p className="text-sm" style={{ color: sub }}>Needs Renpho readings with body composition from around the start date and this week.</p>
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
