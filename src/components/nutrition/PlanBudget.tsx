'use client'

import Card from '@/components/ui/Card'
import { KCAL_PER_KG } from '@/lib/nutrition'
import type { WeekBudget } from '@/lib/weightPlan'

const sub = 'var(--color-text-subtle)'
const UNDER = '#00BFA5'
const OVER = '#E5484D'
const kcal = (n: number) => Math.abs(Math.round(n)).toLocaleString('en-GB')
const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`

const heading = (text: string) => <p className="text-xs uppercase tracking-widest" style={{ color: '#00BFA5' }}>{text}</p>
const strong = (text: string, color = '#F5F5F5') => <b style={{ color, fontFamily: 'var(--font-mono)' }}>{text}</b>

/** One period's balance and what would finish it on target. */
function Period({ title, b, finish }: { title: string; b: WeekBudget; finish: string }) {
  const under = b.balanceKcal >= 0
  const kg = Math.abs(b.balanceKcal) / KCAL_PER_KG
  return (
    <div className="space-y-1 min-w-0">
      {heading(title)}
      {b.loggedDays > 0 ? (
        <p className="text-sm" style={{ color: '#A0A0A0' }}>
          {strong(`${kcal(b.balanceKcal)} kcal ${under ? 'under' : 'over'}`, under ? UNDER : OVER)}
          {' '}across {days(b.loggedDays)} logged, not counting today
          {kg >= 0.05 ? ` (about ${kg.toFixed(1)} kg ${under ? 'ahead' : 'behind'})` : ''}.
        </p>
      ) : (
        <p className="text-sm" style={{ color: '#A0A0A0' }}>No finished days logged yet.</p>
      )}
      {b.restPerDay != null && b.loggedDays > 0 && (
        <p className="text-sm" style={{ color: '#A0A0A0' }}>
          To finish {finish} on target, eat {under ? 'up to' : 'about'} {strong(`${kcal(b.restPerDay)} kcal`)} a day for the {days(b.restDays)} left, including today.
        </p>
      )}
      {b.atFloor && (
        <p className="text-xs" style={{ color: '#F59E0B' }}>That&apos;s your resting burn, so it stops there. Don&apos;t try to win back more.</p>
      )}
      {b.unloggedDays > 0 && (
        <p className="text-xs" style={{ color: sub }}>{days(b.unloggedDays)} with nothing logged {b.unloggedDays === 1 ? "isn't" : "aren't"} counted.</p>
      )}
    </div>
  )
}

/** The plan's calorie budget: today, this week and since the plan started. */
export default function PlanBudget({ eaten, target, week, whole }: {
  eaten: number            // today so far
  target: number
  week: WeekBudget
  whole: WeekBudget        // since the plan started
}) {
  const left = target - Math.round(eaten)
  const over = left < 0
  const pct = Math.min(100, (eaten / target) * 100)

  return (
    <Card hover={false}>
      {heading('Today')}
      <div className="flex items-end justify-between gap-3 flex-wrap mt-1">
        <p className="text-4xl font-black" style={{ color: over ? OVER : '#F5F5F5', fontFamily: 'var(--font-mono)' }}>
          {kcal(left)}
          <span className="text-sm font-normal ml-1" style={{ color: sub }}>kcal {over ? 'over' : 'left'}</span>
        </p>
        <p className="text-sm" style={{ color: '#A0A0A0' }}>
          Plan target {strong(kcal(target))}
        </p>
      </div>

      <div className="h-2 rounded-full overflow-hidden mt-3" style={{ background: '#1E1E1E' }}
        role="progressbar" aria-label="Calories eaten against plan target" aria-valuenow={Math.round(eaten)} aria-valuemin={0} aria-valuemax={target}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: over ? OVER : UNDER }} />
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Period title="This week" b={week} finish="the week" />
        <Period title="Since plan start" b={whole} finish="the plan" />
      </div>
    </Card>
  )
}
