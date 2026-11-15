'use client'

import Card from '@/components/ui/Card'
import SectionHeading from '@/components/ui/SectionHeading'
import { MACRO_COLORS } from '@/components/nutrition/DaySummary'
import { BalanceDay, shiftDay } from '@/lib/nutrition'

const sub = 'var(--color-text-subtle)'
const r = Math.round
const teal = '#00BFA5'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const dowOf = (date: string) => DOW[new Date(`${date}T00:00:00Z`).getUTCDay()]

// Mean of the defined values, or null when none are defined.
function mean(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x != null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

/**
 * Last-7-days overview: averages for calories eaten vs burned and the macro
 * split, plus a day-by-day strip. Reuses the energy-balance data the other
 * tabs compute so no bodyweight/BMR logic is duplicated here.
 */
export default function WeeklyTab({ balance, today }: { balance: BalanceDay[]; today: string }) {
  const from = shiftDay(today, -6)
  const week = balance.filter(d => d.date >= from && d.date <= today)
  const logged = week.filter(d => d.eaten != null)

  const avgEaten = mean(week.map(d => d.eaten))
  const avgBurned = mean(week.map(d => d.burned))
  const avgDeficit = mean(week.map(d => d.deficit))
  const avgProtein = mean(week.map(d => d.protein))
  const avgCarbs = mean(week.map(d => d.carbs))
  const avgFat = mean(week.map(d => d.fat))

  const macroRows = [
    { key: 'protein' as const, label: 'Protein', g: avgProtein },
    { key: 'carbs' as const, label: 'Carbs', g: avgCarbs },
    { key: 'fat' as const, label: 'Fat', g: avgFat },
  ]

  // Max eaten/burned across the week, for the day-strip bar scale.
  const peak = Math.max(1, ...week.flatMap(d => [d.eaten ?? 0, d.burned ?? 0]))

  return (
    <section className="space-y-6">
      <SectionHeading
        eyebrow="Last 7 days"
        title="Your week"
        sub={logged.length
          ? `Averages across ${logged.length} day${logged.length === 1 ? '' : 's'} with meals logged, plus a day-by-day view.`
          : 'Log some meals and your weekly averages will build up here.'}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([
          ['Avg eaten', avgEaten, 'kcal/day'],
          ['Avg burned', avgBurned, 'kcal/day'],
          ['Avg deficit', avgDeficit, 'kcal/day'],
        ] as const).map(([label, v, unit]) => {
          const isDeficit = label === 'Avg deficit' && v != null
          const color = isDeficit ? (v! >= 0 ? teal : '#E5484D') : '#F5F5F5'
          const shown = isDeficit && v! < 0 ? -v! : v
          return (
            <Card key={label} hover={false}>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: sub }}>{label}</p>
              <p className="text-3xl font-black" style={{ color, fontFamily: 'var(--font-mono)' }}>
                {shown != null ? r(shown).toLocaleString('en-GB') : '—'}
                <span className="text-sm font-normal ml-1" style={{ color: sub }}>
                  {isDeficit && v! < 0 ? 'surplus' : unit}
                </span>
              </p>
            </Card>
          )
        })}
      </div>

      {/* Average macro split */}
      <Card hover={false}>
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: sub }}>Average macros per day</p>
        <div className="grid grid-cols-3 gap-2">
          {macroRows.map(m => (
            <div key={m.key}>
              <p className="text-xs flex items-center gap-1.5" style={{ color: '#A0A0A0' }}>
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: MACRO_COLORS[m.key] }} />
                {m.label}
              </p>
              <p className="text-lg font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>
                {m.g != null ? r(m.g) : '—'}<span className="text-xs font-normal" style={{ color: sub }}>g</span>
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Day-by-day strip */}
      <Card hover={false}>
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: sub }}>Day by day</p>
        <div className="space-y-2.5">
          {week.map(d => {
            const eatenPct = Math.min(100, ((d.eaten ?? 0) / peak) * 100)
            const burnedPct = Math.min(100, ((d.burned ?? 0) / peak) * 100)
            const isToday = d.date === today
            return (
              <div key={d.date} className="flex items-center gap-3">
                <span className="text-xs w-9 shrink-0" style={{ color: isToday ? teal : '#A0A0A0', fontWeight: isToday ? 700 : 400 }}>
                  {isToday ? 'Today' : dowOf(d.date)}
                </span>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: '#1E1E1E' }}>
                    <div className="h-full rounded-full" style={{ width: `${eatenPct}%`, background: teal }} />
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: '#1E1E1E' }}>
                    <div className="h-full rounded-full" style={{ width: `${burnedPct}%`, background: MACRO_COLORS.carbs }} />
                  </div>
                </div>
                <span className="text-xs w-28 shrink-0 text-right" style={{ color: sub, fontFamily: 'var(--font-mono)' }}>
                  {d.eaten != null ? r(d.eaten).toLocaleString('en-GB') : '—'}
                  {' / '}
                  {d.burned != null ? r(d.burned).toLocaleString('en-GB') : '—'}
                </span>
              </div>
            )
          })}
        </div>
        <div className="flex gap-4 mt-3">
          <span className="text-xs flex items-center gap-1.5" style={{ color: sub }}>
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: teal }} /> Eaten
          </span>
          <span className="text-xs flex items-center gap-1.5" style={{ color: sub }}>
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: MACRO_COLORS.carbs }} /> Burned
          </span>
        </div>
      </Card>
    </section>
  )
}
