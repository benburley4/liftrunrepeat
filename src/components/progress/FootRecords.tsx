'use client'

import { Mountain } from 'lucide-react'
import { footRecords } from '@/lib/activity'
import type { SessionData } from '@/lib/computeStats'
import { cardStyle, fmtDay } from './progressStyle'

/** On-foot personal records (runs, hikes, walks) — used on On Foot and Personal Records. */
export default function FootRecords({ sessions }: { sessions: SessionData[] }) {
  const records = footRecords(sessions)
  if (!records.length) return null
  return (
    <div className="rounded-xl overflow-hidden" style={cardStyle}>
      <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #2E2E2E', background: '#242424' }}>
        <Mountain size={14} color="#65A30D" aria-hidden="true" />
        <span className="font-black uppercase text-sm" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>On-Foot Records</span>
      </div>
      <ul>
        {records.map(r => (
          <li key={r.label} className="px-5 py-3 flex items-center justify-between gap-4" style={{ borderBottom: '1px solid #242424' }}>
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: '#F5F5F5' }}>{r.label}</p>
              <p className="text-xs truncate" style={{ color: 'var(--color-text-subtle)' }}>{r.name} · {fmtDay(r.date)} {r.date.slice(0, 4)}</p>
            </div>
            <span className="text-lg font-bold shrink-0" style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
