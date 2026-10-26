'use client'

import { useMemo } from 'react'
import { Flame } from 'lucide-react'
import type { ZeppDay } from '@/lib/recovery'
import { DEFAULT_STEP_GOAL } from '@/lib/activity'
import { goalStreaks } from '@/lib/progressData'
import { shiftDays } from '@/lib/progressRange'
import { STEPS_COLOR, fmtLongDay } from './progressStyle'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** Month calendars marking days at the step goal (solid) and part of the way there (faint). */
export default function GoalCalendar({ rows, today, months = 6 }: { rows: ZeppDay[]; today: string; months?: number }) {
  const byDate = useMemo(() => new Map(rows.map(r => [r.date, r])), [rows])
  const streak = useMemo(() => goalStreaks(rows, today), [rows, today])

  const cal = useMemo(() => {
    const [y, m] = today.split('-').map(Number)
    return Array.from({ length: months }, (_, i) => {
      const idx = y * 12 + (m - 1) - (months - 1 - i)
      const yy = Math.floor(idx / 12), mm = idx % 12
      const first = `${yy}-${String(mm + 1).padStart(2, '0')}-01`
      const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7
      const days: string[] = []
      for (let d = first; d.slice(5, 7) === first.slice(5, 7); d = shiftDays(d, 1)) days.push(d)
      const hits = days.filter(d => { const r = byDate.get(d); return r?.steps != null && r.steps >= (r.step_goal || DEFAULT_STEP_GOAL) }).length
      return { key: first, title: `${MONTHS[mm]} ${yy}`, lead, days, hits }
    })
  }, [today, months, byDate])

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <Flame size={14} style={{ color: '#F59E0B' }} aria-hidden="true" />
          <span className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>{streak.current}</span>
          <span className="text-xs" style={{ color: '#A0A0A0' }}>day goal streak</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#242424', border: '1px solid #2E2E2E' }}>
          <span className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>{streak.longest}</span>
          <span className="text-xs" style={{ color: '#A0A0A0' }}>longest streak (days)</span>
        </div>
      </div>
      <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {cal.map(c => (
          <div key={c.key}>
            <p className="text-xs font-semibold mb-1.5 flex justify-between" style={{ color: '#A0A0A0' }}>
              <span>{c.title.split(' ')[0].slice(0, 3)}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-subtle)' }}>{c.hits}/{c.days.filter(d => d <= today).length}</span>
            </p>
            <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {Array.from({ length: c.lead }, (_, i) => <span key={`l${i}`} />)}
              {c.days.map(d => {
                const r = byDate.get(d)
                const goal = r?.step_goal || DEFAULT_STEP_GOAL
                const pct = r?.steps ? Math.min(1, r.steps / goal) : 0
                const hit = pct >= 1
                const future = d > today
                return (
                  <span key={d} title={future ? undefined : `${fmtLongDay(d)}: ${r?.steps ? r.steps.toLocaleString() : 'no'} steps`}
                    style={{
                      aspectRatio: '1', borderRadius: 3,
                      background: future ? 'transparent' : hit ? STEPS_COLOR : pct > 0 ? `rgba(0,191,165,${(0.1 + pct * 0.35).toFixed(2)})` : '#1F1F1F',
                      outline: d === today ? '1px solid #F5F5F5' : undefined,
                    }} />
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs mt-3" style={{ color: 'var(--color-text-subtle)' }}>Solid = goal reached. Faint = part of the way. Hover a day for its count.</p>
    </div>
  )
}
