'use client'

import { useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import { fmtDay } from '@/components/recovery/chartStyle'
import { upsertSetting } from '@/lib/db'
import { proteinTarget, weightTrend, type BalanceDay } from '@/lib/nutrition'
import {
  MAX_PLAN_WEEKS, WEIGHT_PLAN_KEY, planEndDate, planIssue, planNumbers, recentBurn, trendOn, type WeightPlan,
} from '@/lib/weightPlan'
import type { ZeppDailyRow } from '@/lib/zeppDaily'
import { BurnNote, PlanFigures, PlanWarnings, sub, WARN } from './PlanFigures'

/** Plan tab: set the start date, target and weeks; see the rate and daily targets. Progress is on Tracking. */
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
  const [startDate, setStartDate] = useState(today)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const actual = useMemo(() => weightTrend(
    rows.filter(r => r.date <= today).map(r => ({ date: r.date, weightKg: r.weight_kg, morningKg: r.weight_am_kg })),
  ), [rows, today])
  const latest = actual[actual.length - 1] ?? null
  const currentKg = latest?.trendKg ?? null

  const burn = recentBurn(balance, today)
  const proteinG = proteinTarget(currentKg)

  const targetKg = Number(target)
  const weekCount = Number(weeks)
  // The plan starts from the smoothed weight on its start date, which can be in the past.
  const startPoint = trendOn(actual, startDate)
  const startKg = startPoint?.trendKg ?? null
  const issue = planIssue(startKg, targetKg, weekCount, startDate, today)
  const draft = !issue && startKg != null ? planNumbers({ startKg, targetKg, weeks: weekCount }, burn, bmr) : null

  async function save() {
    if (issue || startKg == null) return
    const next: WeightPlan = { startDate, startKg, targetKg, weeks: weekCount }
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
    if (plan) { setTarget(String(plan.targetKg)); setWeeks(String(plan.weeks)); setStartDate(plan.startDate) }
    setEditing(true)
  }

  if (!loaded) return null

  const inputStyle = { background: '#1E1E1E', border: '1px solid #2E2E2E', color: '#F5F5F5', colorScheme: 'dark' as const }

  if (!plan || editing) {
    return (
      <div className="space-y-6">
        <Card hover={false}>
          <p className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>{plan ? 'Change your plan' : 'Set a weight-loss plan'}</p>
          <p className="text-xs mb-4" style={{ color: sub }}>
            {startPoint
              ? `Starts from your trend weight on ${fmtDay(startPoint.date)}, ${startPoint.trendKg.toFixed(1)} kg.`
              : 'Needs a scale reading to start from.'}
            {plan ? ' Saving restarts the plan from the start date.' : ''}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:max-w-xl">
            <label className="text-xs col-span-2 sm:col-span-1" style={{ color: sub }}>
              Start date
              <input type="date" value={startDate} max={today} onChange={e => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-lg px-3 py-2 text-base sm:text-sm" style={inputStyle} />
            </label>
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
            <BurnNote burn={burn} />
          </div>
        )}
      </div>
    )
  }

  const numbers = planNumbers(plan, burn, bmr)

  return (
    <div className="space-y-6">
      <Card hover={false}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest" style={{ color: '#00BFA5' }}>Your plan</p>
            <p className="text-2xl font-black mt-1" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>
              {plan.startKg.toFixed(1)} kg to {plan.targetKg.toFixed(1)} kg
            </p>
            <p className="text-sm" style={{ color: '#A0A0A0' }}>
              {plan.weeks} week{plan.weeks === 1 ? '' : 's'} · {fmtDay(plan.startDate)} to {fmtDay(planEndDate(plan))}. See how it&apos;s going on the Tracking tab.
            </p>
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

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-widest" style={{ color: '#00BFA5' }}>Your daily targets</p>
        <PlanFigures n={numbers} proteinG={proteinG} />
        <PlanWarnings n={numbers} burn={burn} />
        <BurnNote burn={burn} />
      </div>
    </div>
  )
}
