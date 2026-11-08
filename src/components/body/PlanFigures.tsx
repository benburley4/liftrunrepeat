'use client'

import StatTile from '@/components/ui/StatTile'
import type { PlanActuals, PlanNumbers, PlanPace } from '@/lib/weightPlan'

export const sub = 'var(--color-text-subtle)'
export const WARN = '#F59E0B'

const PACE_LABEL: Record<PlanPace | 'gaining', string> = { gentle: 'Gentle', steady: 'Steady', fast: 'Fast', gaining: 'Gaining' }

export function PlanFigures({ n, proteinG }: { n: PlanNumbers; proteinG: number | null }) {
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

/** Same tiles as the targets, averaged since the plan started, so each sits under its target. */
export function ActualFigures({ a }: { a: PlanActuals }) {
  const kcal = (n: number | null) => (n != null ? Math.abs(n).toLocaleString('en-GB') : '—')
  const gaining = a.perWeekKg != null && a.perWeekKg < 0
  const surplus = a.dailyDeficit != null && a.dailyDeficit < 0
  const est = a.early ? ' · early estimate' : ''
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <StatTile value={a.perWeekKg != null ? Math.abs(a.perWeekKg).toFixed(2) : '—'} label={`${gaining ? 'Gain' : 'Loss'} per week (kg)${est}`} animate={false} />
      <StatTile value={a.pace ? PACE_LABEL[a.pace] : '—'} label={a.pctPerWeek != null ? `Pace · ${a.pctPerWeek.toFixed(1)}% a week${est}` : 'Pace'} animate={false} />
      <StatTile value={kcal(a.dailyDeficit)} label={surplus ? 'Daily surplus (kcal)' : 'Daily deficit (kcal)'} animate={false} />
      <StatTile value={kcal(a.eaten)} label="Eaten per day (kcal)" animate={false} />
      <StatTile value={a.protein ?? '—'} label="Protein per day (g)" animate={false} />
    </div>
  )
}

export function PlanWarnings({ n, burn }: { n: PlanNumbers; burn: number | null }) {
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

export function BurnNote({ burn }: { burn: number | null }) {
  if (burn == null) return null
  return (
    <p className="text-xs" style={{ color: sub }}>
      Calories update with your average burn over the last 28 days ({burn.toLocaleString('en-GB')} kcal a day), and assume about 7,700 kcal per kg. These are estimates, not medical advice.
    </p>
  )
}
