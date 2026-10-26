'use client'

import { useMemo, useState } from 'react'
import { Flame } from 'lucide-react'
import type { SessionData } from '@/lib/computeStats'
import { activityKind, dayKind, weekStreaks, type ActivityKind } from '@/lib/progressData'
import { shiftDays } from '@/lib/progressRange'
import { weekStartOf } from '@/lib/activity'
import { ACTIVITY_COLORS, ACTIVITY_LABELS, fmtLongDay } from './progressStyle'
import { Pills } from './kit'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const CELL = 12, GAP = 3

type Filter = 'all' | 'lift' | 'run' | 'hike' | 'walk'
const FILTERS: { id: Filter; label: string; color?: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'lift', label: 'Lift', color: ACTIVITY_COLORS.lift },
  { id: 'run', label: 'Run', color: ACTIVITY_COLORS.run },
  { id: 'hike', label: 'Hike', color: ACTIVITY_COLORS.hike },
  { id: 'walk', label: 'Walk', color: ACTIVITY_COLORS.walk },
]

function matches(kind: ActivityKind, f: Filter) {
  if (f === 'all') return true
  if (kind === 'hybrid') return f === 'lift' || f === 'run'
  return kind === f
}

/**
 * Calendar heatmap of training days. Hover or focus a day to see what was
 * done; click to open it. Days are columns of Monday-first weeks.
 */
export default function ActivityHeatmap({ sessions, today, onOpenDay }: {
  sessions: SessionData[]
  today: string
  onOpenDay: (date: string, sessions: SessionData[]) => void
}) {
  const [months, setMonths] = useState<6 | 12>(6)
  const [filter, setFilter] = useState<Filter>('all')
  const [hover, setHover] = useState<{ date: string; left: number; y: number } | null>(null)

  /** Position the tooltip above a cell, kept inside the card. */
  function place(cell: HTMLElement, date: string) {
    const box = cell.closest('[data-heatmap]')
    if (!box) return
    const r = cell.getBoundingClientRect(), p = box.getBoundingClientRect()
    const left = Math.min(Math.max(0, r.left - p.left + CELL / 2 - 100), Math.max(0, p.width - 200))
    setHover({ date, left, y: r.top - p.top })
  }

  const byDate = useMemo(() => {
    const m = new Map<string, SessionData[]>()
    for (const s of sessions) {
      if (!matches(activityKind(s), filter)) continue
      const list = m.get(s.date)
      if (list) list.push(s); else m.set(s.date, [s])
    }
    return m
  }, [sessions, filter])

  const { weeks, monthLabels, activeDays } = useMemo(() => {
    const firstMonday = weekStartOf(shiftDays(today, -Math.round(months * 30.44)))
    const weeks: { date: string; future: boolean }[][] = []
    for (let w = firstMonday; w <= today; w = shiftDays(w, 7))
      weeks.push(Array.from({ length: 7 }, (_, i) => { const d = shiftDays(w, i); return { date: d, future: d > today } }))
    const monthLabels: { col: number; label: string }[] = []
    let last = ''
    weeks.forEach((wk, i) => {
      const firstOfMonth = wk.find(d => d.date.endsWith('-01'))
      const m = (firstOfMonth ?? (i === 0 ? wk[0] : null))?.date.slice(5, 7)
      // Skip a label that would collide with the previous one (a part-month at the left edge).
      const prevCol = monthLabels.at(-1)?.col ?? -9
      if (m && m !== last) { if (i - prevCol < 3) monthLabels.pop(); monthLabels.push({ col: i, label: MONTHS[Number(m) - 1] }); last = m }
    })
    const start = weeks[0]?.[0].date ?? today
    let activeDays = 0
    for (const d of byDate.keys()) if (d >= start && d <= today) activeDays++
    return { weeks, monthLabels, activeDays }
  }, [today, months, byDate])

  const streaks = useMemo(() => weekStreaks([...byDate.keys()], today), [byDate, today])

  const kindOf = (date: string) => {
    const list = byDate.get(date)
    return list ? dayKind(new Set(list.map(activityKind))) : null
  }
  const hovered = hover ? byDate.get(hover.date) ?? [] : []

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <Pills label="Activity filter" options={FILTERS} value={filter} onChange={setFilter} />
        <Pills label="Heatmap length" options={[{ id: 6, label: '6 months' }, { id: 12, label: '12 months' }]} value={months} onChange={v => setMonths(v as 6 | 12)} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <Flame size={14} style={{ color: '#F59E0B' }} aria-hidden="true" />
          <span className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>{streaks.current}</span>
          <span className="text-xs" style={{ color: '#A0A0A0' }}>week streak</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#242424', border: '1px solid #2E2E2E' }}>
          <span className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>{streaks.longest}</span>
          <span className="text-xs" style={{ color: '#A0A0A0' }}>longest streak (weeks)</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#242424', border: '1px solid #2E2E2E' }}>
          <span className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>{activeDays}</span>
          <span className="text-xs" style={{ color: '#A0A0A0' }}>active days</span>
        </div>
      </div>

      <div className="relative" data-heatmap onMouseLeave={() => setHover(null)}>
        <div style={{ overflowX: 'auto' }} data-noswipe>
          <div style={{ display: 'flex', gap: 6, minWidth: 'fit-content' }}>
            <div style={{ display: 'grid', gridTemplateRows: `16px repeat(7, ${CELL}px)`, rowGap: GAP, fontSize: 9, color: '#8A8A8A' }} aria-hidden="true">
              <span />{['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((d, i) => <span key={i} style={{ lineHeight: `${CELL}px` }}>{d}</span>)}
            </div>
            <div>
              <div style={{ position: 'relative', height: 16, marginBottom: GAP }} aria-hidden="true">
                {monthLabels.map(({ col, label }) => (
                  <span key={label + col} style={{ position: 'absolute', left: col * (CELL + GAP), fontSize: 10, color: '#8A8A8A', fontWeight: 600 }}>{label}</span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: GAP }}>
                {weeks.map((wk, wi) => (
                  <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
                    {wk.map(({ date, future }) => {
                      const kind = future ? null : kindOf(date)
                      const list = byDate.get(date)
                      const style = {
                        width: CELL, height: CELL, borderRadius: 3, flexShrink: 0,
                        background: kind ? ACTIVITY_COLORS[kind] : future ? 'transparent' : '#1F1F1F',
                        border: kind ? 'none' : future ? 'none' : '1px solid #2A2A2A',
                        opacity: kind === 'walk' ? 0.7 : 1,
                      }
                      if (!kind || !list) return <div key={date} style={style} aria-hidden="true" />
                      const label = `${fmtLongDay(date)}: ${list.map(s => s.name).join(', ')}`
                      return (
                        <button key={date} type="button" aria-label={label} className="lrr-cell"
                          style={{ ...style, cursor: 'pointer', padding: 0 }}
                          onMouseEnter={e => place(e.currentTarget, date)}
                          onFocus={e => place(e.currentTarget, date)}
                          onBlur={() => setHover(null)}
                          onClick={() => onOpenDay(date, list)} />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {hover && hovered.length > 0 && (
          <div role="tooltip" className="absolute z-20 pointer-events-none rounded-lg px-3 py-2"
            style={{
              left: hover.left, top: Math.max(0, hover.y - 8), transform: 'translateY(-100%)',
              width: 200, background: '#242424', border: '1px solid #3A3A3A', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
            <p className="text-xs font-semibold mb-1" style={{ color: '#F5F5F5' }}>{fmtLongDay(hover.date)}</p>
            {hovered.slice(0, 4).map(s => {
              const k = activityKind(s)
              return (
                <p key={s.savedAt} className="text-xs flex items-center gap-1.5 truncate" style={{ color: '#A0A0A0' }}>
                  <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 2, background: ACTIVITY_COLORS[k], flexShrink: 0 }} />
                  <span className="truncate">{s.name}</span>
                </p>
              )
            })}
            {hovered.length > 4 && <p className="text-xs" style={{ color: '#8A8A8A' }}>+{hovered.length - 4} more</p>}
            <p className="text-xs mt-1" style={{ color: '#8A8A8A' }}>Click to open</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 mt-3">
        {(Object.keys(ACTIVITY_COLORS) as ActivityKind[]).map(k => (
          <span key={k} className="flex items-center gap-1.5 text-xs" style={{ color: '#A0A0A0' }}>
            <span aria-hidden="true" style={{ width: CELL, height: CELL, borderRadius: 3, background: ACTIVITY_COLORS[k], opacity: k === 'walk' ? 0.7 : 1 }} />
            {ACTIVITY_LABELS[k]}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-xs" style={{ color: '#A0A0A0' }}>
          <span aria-hidden="true" style={{ width: CELL, height: CELL, borderRadius: 3, background: '#1F1F1F', border: '1px solid #2A2A2A' }} />
          Rest
        </span>
      </div>
    </div>
  )
}
