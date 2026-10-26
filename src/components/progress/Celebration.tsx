'use client'

import { useEffect, useState } from 'react'
import { Trophy, X } from 'lucide-react'
import type { PrEvent } from '@/lib/progressData'
import { useReducedMotion } from './kit'

const KEY = 'lrr_celebrated_pr'
const COLORS = ['#00BFA5', '#C8102E', '#A78BFA', '#F59E0B', '#84CC16', '#F5F5F5']

/**
 * A one-time celebration for a record set in the last week: a short confetti
 * burst (skipped for reduced motion) and a dismissible toast. Remembered per
 * browser so it shows once per record.
 */
export default function Celebration({ record, today }: { record: PrEvent | null; today: string }) {
  const reduced = useReducedMotion()
  const [show, setShow] = useState(false)
  const id = record ? `${record.kind}:${record.name}:${record.date}:${record.value}` : null

  useEffect(() => {
    if (!record || !id) return
    const ageDays = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${record.date}T00:00:00Z`)) / 86400000
    if (ageDays > 7) return
    let seen: string | null = null
    try { seen = localStorage.getItem(KEY) } catch { /* storage blocked: celebrate anyway */ }
    if (seen === id) return
    try { localStorage.setItem(KEY, id) } catch { /* ignore */ }
    const t = setTimeout(() => setShow(true), 400)
    const hide = setTimeout(() => setShow(false), 9000)
    return () => { clearTimeout(t); clearTimeout(hide) }
  }, [record, id, today])

  if (!show || !record) return null
  return (
    <>
      {!reduced && (
        <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden" aria-hidden="true">
          {Array.from({ length: 48 }, (_, i) => (
            <span key={i} className="lrr-confetti" style={{
              left: `${(i * 37) % 100}%`, background: COLORS[i % COLORS.length],
              animationDelay: `${(i % 12) * 60}ms`, animationDuration: `${1600 + (i % 7) * 180}ms`,
              transform: `rotate(${i * 29}deg)`, width: i % 3 ? 8 : 6, height: i % 3 ? 12 : 6,
            }} />
          ))}
        </div>
      )}
      <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[61] rounded-xl px-5 py-3 flex items-center gap-3 lrr-toast"
        style={{ background: '#1E1E1E', border: '1px solid rgba(245,158,11,0.4)', boxShadow: '0 12px 40px rgba(0,0,0,0.6)', maxWidth: 'calc(100vw - 32px)' }}>
        <Trophy size={22} style={{ color: '#F59E0B', flexShrink: 0 }} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-black uppercase" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>New record!</p>
          <p className="text-xs truncate" style={{ color: '#A0A0A0' }}>{record.name} · {record.value} · +{record.pct}%</p>
        </div>
        <button type="button" onClick={() => setShow(false)} aria-label="Dismiss" className="p-1 rounded" style={{ color: '#8A8A8A', cursor: 'pointer' }}><X size={16} /></button>
      </div>
    </>
  )
}
