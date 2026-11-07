'use client'

import Card from '@/components/ui/Card'
import type { WeekBudget } from '@/lib/weightPlan'

const sub = 'var(--color-text-subtle)'
const UNDER = '#00BFA5'
const OVER = '#E5484D'
const kcal = (n: number) => Math.abs(Math.round(n)).toLocaleString('en-GB')
const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`

/** The active weight plan's calorie budget for the selected day and its week. */
export default function PlanBudget({ eaten, target, week, isToday }: {
  eaten: number
  target: number
  week: WeekBudget
  isToday: boolean
}) {
  const left = target - Math.round(eaten)
  const over = left < 0
  const pct = Math.min(100, (eaten / target) * 100)
  const current = week.restDays > 0
  const under = week.balanceKcal >= 0

  return (
    <Card hover={false}>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <p className="text-4xl font-black" style={{ color: over ? OVER : '#F5F5F5', fontFamily: 'var(--font-mono)' }}>
          {kcal(left)}
          <span className="text-sm font-normal ml-1" style={{ color: sub }}>kcal {over ? 'over' : isToday ? 'left' : 'under'}</span>
        </p>
        <p className="text-sm" style={{ color: '#A0A0A0' }}>
          Plan target <b style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>{kcal(target)}</b>
        </p>
      </div>

      <div className="h-2 rounded-full overflow-hidden mt-3" style={{ background: '#1E1E1E' }}
        role="progressbar" aria-label="Calories eaten against plan target" aria-valuenow={Math.round(eaten)} aria-valuemin={0} aria-valuemax={target}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: over ? OVER : UNDER }} />
      </div>

      <div className="mt-4 space-y-1">
        <p className="text-xs uppercase tracking-widest" style={{ color: '#00BFA5' }}>{current ? 'This week' : 'That week'}</p>
        {week.loggedDays > 0 ? (
          <p className="text-sm" style={{ color: '#A0A0A0' }}>
            <b style={{ color: under ? UNDER : OVER, fontFamily: 'var(--font-mono)' }}>{kcal(week.balanceKcal)} kcal {under ? 'under' : 'over'}</b>
            {' '}across {days(week.loggedDays)} logged{current ? ', not counting today' : ''}.
          </p>
        ) : (
          <p className="text-sm" style={{ color: '#A0A0A0' }}>{current ? 'No finished days logged yet this week.' : 'No days logged that week.'}</p>
        )}
        {week.restPerDay != null && week.loggedDays > 0 && (
          <p className="text-sm" style={{ color: '#A0A0A0' }}>
            To finish the week on target, eat {under ? 'up to' : 'about'}{' '}
            <b style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>{kcal(week.restPerDay)} kcal</b> a day for the {days(week.restDays)} left, including today.
          </p>
        )}
        {week.atFloor && (
          <p className="text-xs" style={{ color: '#F59E0B' }}>That&apos;s your resting burn, so it stops there. Don&apos;t try to win back more this week.</p>
        )}
        {week.unloggedDays > 0 && (
          <p className="text-xs" style={{ color: sub }}>{days(week.unloggedDays)} with nothing logged {week.unloggedDays === 1 ? "isn't" : "aren't"} counted.</p>
        )}
      </div>
    </Card>
  )
}
