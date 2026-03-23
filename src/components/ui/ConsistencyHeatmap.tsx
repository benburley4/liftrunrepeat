'use client'

import { useMemo } from 'react'

type SessionType = 'lift' | 'run' | 'hybrid' | null

const typeColors: Record<string, string> = {
  lift: '#00BFA5',
  run: '#C8102E',
  hybrid: '#A78BFA',
}

interface Props {
  sessions: Array<{ date: string; type: string }>
}

export default function ConsistencyHeatmap({ sessions }: Props) {
  const data = useMemo(() => {
    // Build a lookup: date string → session type (multiple sessions → hybrid)
    const byDate: Record<string, string> = {}
    for (const s of sessions) {
      const existing = byDate[s.date]
      if (!existing) {
        byDate[s.date] = s.type
      } else if (existing !== s.type) {
        byDate[s.date] = 'hybrid'
      }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const result: { date: string; type: SessionType }[] = []

    for (let i = 180; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const t = byDate[dateStr] as SessionType ?? null
      result.push({ date: dateStr, type: t })
    }
    return result
  }, [sessions])

  // Group into weeks
  const weeks: typeof data[] = []
  for (let i = 0; i < data.length; i += 7) {
    weeks.push(data.slice(i, i + 7))
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1" style={{ minWidth: 'fit-content' }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day, di) => (
              <div
                key={di}
                className="w-3 h-3 rounded-sm"
                title={`${day.date} — ${day.type ?? 'rest'}`}
                style={{
                  background: day.type ? typeColors[day.type] : '#1A1A1A',
                  border: day.type ? 'none' : '1px solid #2E2E2E',
                  opacity: day.type ? 0.8 : 1,
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3">
        {(['lift', 'run', 'hybrid'] as const).map(t => (
          <div key={t} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: typeColors[t] }} />
            <span className="text-xs capitalize" style={{ color: '#606060' }}>{t}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }} />
          <span className="text-xs" style={{ color: '#606060' }}>rest</span>
        </div>
      </div>
    </div>
  )
}
