'use client'

import { hikeRecords } from '@/lib/activity'
import type { SessionData } from '@/lib/computeStats'

const ACCENT = '#84CC16'   // matches the History hike card

const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/** Hike PR card for the Personal Records tab — same layout as the Run card. */
export default function HikeRecords({ sessions }: { sessions: SessionData[] }) {
  const records = hikeRecords(sessions)
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
      <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #2E2E2E', background: '#242424' }}>
        <div className="w-2 h-2 rounded-full" style={{ background: ACCENT }} />
        <h3 className="text-base font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>Hike</h3>
      </div>
      {records.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>No hike data yet.</p>
        </div>
      ) : records.map((r, i) => (
        <div key={r.label} className="px-5 py-4" style={{ borderBottom: i < records.length - 1 ? '1px solid #2E2E2E' : 'none' }}>
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-sm font-bold uppercase" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>{r.label}</p>
            <p className="text-xs shrink-0" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>{fmtDate(r.date)}</p>
          </div>
          <div className="flex gap-3">
            {r.stats.map((s, j) => (
              <div key={s.label} className="flex-1 rounded-lg px-3 py-2" style={{ background: '#242424' }}>
                <p className="text-xs mb-0.5" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>{s.label}</p>
                <p className="text-sm font-bold" style={{ color: j === 0 ? ACCENT : '#F5F5F5', fontFamily: 'var(--font-mono)' }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
