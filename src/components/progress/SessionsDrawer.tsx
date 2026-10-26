'use client'

import { useEffect, useRef } from 'react'
import { X, ChevronRight } from 'lucide-react'
import type { SessionData } from '@/lib/computeStats'
import type { VolumeMultipliers } from '@/lib/exerciseLoad'
import { activityKind, sessionVolume } from '@/lib/progressData'
import { footKm } from '@/lib/activity'
import { ACTIVITY_COLORS, ACTIVITY_LABELS, fmtLongDay, fmtTonnes } from './progressStyle'

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Slide-in panel listing the sessions behind a chart bar or heatmap day.
 * Escape / backdrop closes it; focus is trapped inside while open.
 */
export default function SessionsDrawer({ title, subtitle, sessions, mults, onClose, onOpenSession }: {
  title: string
  subtitle?: string
  sessions: SessionData[]
  mults?: VolumeMultipliers
  onClose: () => void
  onOpenSession: (s: SessionData) => void
}) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date) || b.savedAt.localeCompare(a.savedAt))
  const kg = sorted.reduce((n, s) => n + sessionVolume(s, mults), 0)
  const km = Math.round(sorted.reduce((n, s) => n + footKm(s), 0) * 10) / 10

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close.current(); return }
      if (e.key !== 'Tab' || !panel.current) return
      const els = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (!els.length) return
      const first = els[0], last = els[els.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; prev?.focus?.() }
  }, [])

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <div className="absolute inset-0 lrr-fade" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }} onClick={onClose} />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="drawer-title"
        className="absolute right-0 top-0 h-full w-full max-w-md flex flex-col lrr-slide"
        style={{ background: '#141414', borderLeft: '1px solid #2E2E2E', boxShadow: '-12px 0 40px rgba(0,0,0,0.5)' }}>
        <div className="flex items-start justify-between gap-3 px-5 py-4" style={{ borderBottom: '1px solid #2E2E2E' }}>
          <div className="min-w-0">
            {subtitle && <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#00BFA5' }}>{subtitle}</p>}
            <h2 id="drawer-title" className="text-xl font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg" style={{ color: '#A0A0A0', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 px-5 py-4" style={{ borderBottom: '1px solid #242424' }}>
          {[
            { label: 'Sessions', value: String(sorted.length), color: '#F5F5F5' },
            { label: 'Lifted', value: kg ? fmtTonnes(kg) : '–', color: ACTIVITY_COLORS.lift },
            { label: 'On foot', value: km ? `${km} km` : '–', color: ACTIVITY_COLORS.run },
          ].map(t => (
            <div key={t.label} className="rounded-lg px-3 py-2" style={{ background: '#1E1E1E' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{t.label}</p>
              <p className="text-base font-bold" style={{ color: t.color, fontFamily: 'var(--font-mono)' }}>{t.value}</p>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <p className="text-sm text-center py-12" style={{ color: 'var(--color-text-subtle)' }}>No sessions in this period.</p>
          ) : sorted.map(s => {
            const kind = activityKind(s)
            const c = ACTIVITY_COLORS[kind]
            const v = sessionVolume(s, mults), d = footKm(s)
            return (
              <button key={s.savedAt} type="button" onClick={() => onOpenSession(s)}
                className="w-full text-left px-5 py-3 flex items-center gap-3 pr-row" style={{ borderBottom: '1px solid #1F1F1F', cursor: 'pointer' }}>
                <span aria-hidden="true" className="w-1.5 self-stretch rounded-full" style={{ background: c, minHeight: 32 }} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold uppercase truncate" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>{s.name}</span>
                  <span className="block text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                    {fmtLongDay(s.date)} · <span style={{ color: c }}>{ACTIVITY_LABELS[kind]}</span>
                  </span>
                </span>
                <span className="text-xs text-right shrink-0" style={{ fontFamily: 'var(--font-mono)', color: '#A0A0A0' }}>
                  {v > 0 && <span className="block">{fmtTonnes(v)}</span>}
                  {d > 0 && <span className="block">{Math.round(d * 10) / 10} km</span>}
                </span>
                <ChevronRight size={14} style={{ color: '#606060', flexShrink: 0 }} aria-hidden="true" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
