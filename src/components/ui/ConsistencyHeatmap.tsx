'use client'

import { useMemo } from 'react'

type SessionType = 'lift' | 'run' | 'hybrid' | null

const typeColors: Record<string, string> = {
  lift: '#00BFA5',
  run: '#C8102E',
  hybrid: '#A78BFA',
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// Use local calendar date to avoid UTC-offset bugs
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Props {
  sessions: Array<{ date: string; type: string }>
}

export default function ConsistencyHeatmap({ sessions }: Props) {
  const { weeks, monthLabels } = useMemo(() => {
    // Build lookup: date → type (multiple sessions on same day → hybrid)
    const byDate: Record<string, string> = {}
    for (const s of sessions) {
      const existing = byDate[s.date]
      if (!existing) {
        byDate[s.date] = s.type
      } else if (existing !== s.type) {
        byDate[s.date] = 'hybrid'
      }
    }

    // Build 181 days ending today using local dates
    const today = new Date()
    const days: { date: string; type: SessionType; month: number; weekIndex: number }[] = []
    for (let i = 180; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = localDateStr(d)
      days.push({
        date: dateStr,
        type: (byDate[dateStr] as SessionType) ?? null,
        month: d.getMonth(),
        weekIndex: Math.floor((180 - i) / 7),
      })
    }

    // Group into weeks (columns)
    const weeks: typeof days[] = []
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7))
    }

    // Month labels: find first column where a new month begins
    const monthLabels: { col: number; label: string }[] = []
    let lastMonth = -1
    for (let wi = 0; wi < weeks.length; wi++) {
      const firstDay = weeks[wi][0]
      if (firstDay.month !== lastMonth) {
        monthLabels.push({ col: wi, label: MONTH_NAMES[firstDay.month] })
        lastMonth = firstDay.month
      }
    }

    return { weeks, monthLabels }
  }, [sessions])

  const CELL = 12, GAP = 3

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* Month labels */}
      <div style={{ display: 'flex', marginBottom: '4px', position: 'relative', height: '16px' }}>
        {monthLabels.map(({ col, label }) => (
          <div
            key={label + col}
            style={{
              position: 'absolute',
              left: `${col * (CELL + GAP)}px`,
              fontSize: '10px',
              color: '#6B7280',
              fontWeight: 600,
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'flex', gap: `${GAP}px`, minWidth: 'fit-content' }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px` }}>
            {week.map((day, di) => (
              <div
                key={di}
                title={`${day.date} — ${day.type ?? 'rest'}`}
                style={{
                  width: `${CELL}px`,
                  height: `${CELL}px`,
                  borderRadius: '3px',
                  background: day.type ? typeColors[day.type] : '#1A1A1A',
                  border: day.type ? 'none' : '1px solid #2E2E2E',
                  opacity: day.type ? 0.85 : 1,
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '10px' }}>
        {(['lift', 'run', 'hybrid'] as const).map(t => (
          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: `${CELL}px`, height: `${CELL}px`, borderRadius: '3px', background: typeColors[t] }} />
            <span style={{ fontSize: '11px', color: '#606060', textTransform: 'capitalize' }}>{t}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: `${CELL}px`, height: `${CELL}px`, borderRadius: '3px', background: '#1A1A1A', border: '1px solid #2E2E2E' }} />
          <span style={{ fontSize: '11px', color: '#606060' }}>rest</span>
        </div>
      </div>
    </div>
  )
}
