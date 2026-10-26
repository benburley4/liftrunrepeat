'use client'

import { useMemo, useState } from 'react'
import { Sparkles, ChevronDown, Trash2, Download, Trophy } from 'lucide-react'
import type { SessionData } from '@/lib/computeStats'
import type { CoachReport } from '@/lib/db'
import { weekSummary } from '@/lib/progressData'
import { weekStartOf } from '@/lib/activity'
import { shiftDays } from '@/lib/progressRange'
import { renderWeekImage, shareOrDownload } from './shareImage'
import { Pills } from './kit'
import { ACTIVITY_COLORS, ACTIVITY_LABELS, cardStyle, fmtTonnes } from './progressStyle'
import type { RangeCtx } from './types'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const fmtWeek = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })

function renderReport(text: string) {
  return text.split(/^##\s+/m).filter(Boolean).map((section, idx) => {
    const lines = section.split('\n')
    const title = lines[0].trim()
    const isRecs = /RECOMMENDATION/i.test(title)
    const bullets = lines.slice(1).join('\n').trim().split('\n').filter(l => l.trim()).map((l, i) => {
      const content = l.replace(/^[-•*]\s*/, '').trim()
      if (!content) return null
      const parts = content.split(/\*\*(.*?)\*\*/g)
      return (
        <div key={i} className="flex gap-2 mb-2">
          <span aria-hidden="true" className="shrink-0 mt-1.5" style={{ width: 6, height: 6, borderRadius: '50%', background: isRecs ? '#C084FC' : '#00BFA5' }} />
          <p className="m-0" style={{ color: '#A0A0A0', fontSize: 13, lineHeight: 1.6 }}>
            {parts.map((p, pi) => pi % 2 === 1 ? <strong key={pi} style={{ color: '#F5F5F5', fontWeight: 600 }}>{p}</strong> : p)}
          </p>
        </div>
      )
    })
    return (
      <div key={idx} className="rounded-xl p-5" style={{ background: '#1A1A1A', border: `1px solid ${isRecs ? 'rgba(167,139,250,0.25)' : '#2E2E2E'}` }}>
        <p className="text-xs font-black uppercase mb-3" style={{ color: isRecs ? '#A78BFA' : 'var(--color-text-subtle)', fontFamily: 'var(--font-heading)', letterSpacing: '0.08em' }}>{title}</p>
        <div>{bullets}</div>
      </div>
    )
  })
}

export default function WeeklyReviewTab({ history, ctx, reports, demo, onDeleteReport }: {
  history: SessionData[]
  ctx: RangeCtx
  reports: CoachReport[]
  demo: boolean
  onDeleteReport: (id: string) => void
}) {
  const [which, setWhich] = useState<'last' | 'this'>('last')
  const [saving, setSaving] = useState<string | null>(null)
  const [openMonth, setOpenMonth] = useState<string | null>(null)
  const [openReport, setOpenReport] = useState<string | null>(null)

  const thisMonday = weekStartOf(ctx.today)
  const start = which === 'this' ? thisMonday : shiftDays(thisMonday, -7)
  const week = useMemo(() => weekSummary(history, ctx.mults, start), [history, ctx.mults, start])
  const title = which === 'this' ? 'This week' : `Week of ${fmtWeek(start)}`

  // Show the newest report up top while it's at most a week old.
  const sorted = useMemo(() => [...reports].sort((a, b) => b.weekEnding.localeCompare(a.weekEnding)), [reports])
  const latest = sorted[0] && Date.parse(`${ctx.today}T00:00:00Z`) - Date.parse(`${sorted[0].weekEnding}T00:00:00Z`) <= 7 * 86400000 ? sorted[0] : null
  const past = sorted.filter(r => r !== latest)
  const byMonth = past.reduce<Record<string, CoachReport[]>>((m, r) => { (m[r.weekEnding.slice(0, 7)] ??= []).push(r); return m }, {})

  async function save() {
    setSaving('Rendering…')
    try {
      const blob = await renderWeekImage(week, which === 'this' ? 'This week' : `Week of ${fmtWeek(start)}`)
      const how = await shareOrDownload(blob, `liftrunrepeat-week-${start}.png`)
      setSaving(how === 'shared' ? 'Shared' : 'Saved')
    } catch { setSaving('Could not create the image') }
    setTimeout(() => setSaving(null), 2500)
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl p-5 lrr-reveal" style={{ background: 'linear-gradient(135deg, rgba(0,191,165,0.10), rgba(167,139,250,0.08) 60%, #1A1A1A)', border: '1px solid #2E2E2E' }}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#00BFA5' }}>Week at a glance</p>
            <h3 className="text-2xl font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>{title}</h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Pills label="Which week" value={which} onChange={setWhich} options={[{ id: 'last', label: 'Last week' }, { id: 'this', label: 'This week' }]} />
            <button type="button" onClick={save} disabled={!!saving}
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: '#00BFA5', color: '#0D0D0D', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              <Download size={13} aria-hidden="true" /> {saving ?? 'Save as image'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Sessions', value: String(week.sessions), color: '#F5F5F5' },
            { label: 'Lifted', value: week.liftKg ? fmtTonnes(week.liftKg) : '–', color: ACTIVITY_COLORS.lift },
            { label: 'On foot', value: week.km ? `${week.km} km` : '–', color: ACTIVITY_COLORS.run },
            { label: 'Climbed', value: week.climb ? `${week.climb} m` : '–', color: ACTIVITY_COLORS.hike },
          ].map(t => (
            <div key={t.label} className="rounded-lg px-4 py-3" style={{ background: 'rgba(13,13,13,0.6)', border: '1px solid #2E2E2E' }}>
              <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-subtle)' }}>{t.label}</p>
              <p className="text-2xl font-bold" style={{ color: t.color, fontFamily: 'var(--font-mono)' }}>{t.value}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-between gap-1 max-w-xl" role="list" aria-label="Training days">
          {week.days.map((k, i) => (
            <div key={i} role="listitem" className="flex flex-col items-center gap-1.5" aria-label={`${DAYS[i]}: ${k ? ACTIVITY_LABELS[k] : 'rest'}`}>
              <span className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-xs font-bold lrr-pop"
                style={{ background: k ? ACTIVITY_COLORS[k] : '#1F1F1F', border: k ? 'none' : '1px solid #2E2E2E', color: k ? '#0D0D0D' : '#5A5A5A', animationDelay: `${i * 60}ms` }}>
                {DAYS[i].slice(0, 2)}
              </span>
              <span className="text-xs" style={{ color: k ? ACTIVITY_COLORS[k] : 'var(--color-text-subtle)' }}>{k ? ACTIVITY_LABELS[k] : 'Rest'}</span>
            </div>
          ))}
        </div>

        {week.records.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {week.records.map(r => (
              <span key={`${r.name}-${r.date}`} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#F5F5F5' }}>
                <Trophy size={12} style={{ color: '#F59E0B' }} aria-hidden="true" /> {r.name} <span style={{ fontFamily: 'var(--font-mono)', color: r.kind === 'lift' ? ACTIVITY_COLORS.lift : ACTIVITY_COLORS.run }}>{r.value}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl p-6" style={{ background: '#1A1A1A', border: '1px solid rgba(167,139,250,0.2)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={15} style={{ color: '#A78BFA' }} aria-hidden="true" />
          <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#A78BFA' }}>AI Coach</span>
        </div>
        <h3 className="text-2xl font-black uppercase mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>Weekly Review</h3>
        <p className="text-sm" style={{ color: 'var(--color-text-subtle)', maxWidth: 560 }}>
          Every Sunday night, your AI coach reviews the week you actually trained — sessions, load, strength trends, running volume and recovery — and tells you what&apos;s working and what to change next week.
        </p>
        {history.length === 0 && <p className="text-xs mt-2" style={{ color: '#C8102E' }}>Log some sessions first to enable AI analysis.</p>}
      </section>

      {latest ? (
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-widest" style={{ color: '#A78BFA' }}>
            Latest report — week ending {new Date(`${latest.weekEnding}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          {renderReport(latest.reportText)}
        </div>
      ) : history.length > 0 && (
        <div className="rounded-xl p-10 text-center" style={cardStyle}>
          <Sparkles size={32} style={{ color: '#3A3A3A', margin: '0 auto 12px' }} aria-hidden="true" />
          <p className="text-sm font-semibold" style={{ color: '#A0A0A0' }}>No report for this week yet.</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>Your next report will auto-generate this Sunday at 23:50.</p>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-subtle)' }}>Past Reports</p>
          <div className="rounded-xl overflow-hidden" style={{ background: '#141414', border: '1px solid #2E2E2E' }}>
            {Object.keys(byMonth).sort((a, b) => b.localeCompare(a)).map((m, mi, months) => {
              const open = openMonth === m
              return (
                <div key={m} style={{ borderBottom: mi < months.length - 1 ? '1px solid #1E1E1E' : 'none' }}>
                  <button type="button" onClick={() => setOpenMonth(open ? null : m)} aria-expanded={open}
                    className="w-full flex items-center justify-between px-5 py-4 text-left" style={{ cursor: 'pointer' }}>
                    <span className="flex items-center gap-2.5">
                      <span className="text-sm font-black uppercase tracking-wide" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>
                        {new Date(`${m}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#242424', color: '#8A8A8A', fontFamily: 'var(--font-mono)' }}>{byMonth[m].length}</span>
                    </span>
                    <ChevronDown size={14} style={{ color: '#606060', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} aria-hidden="true" />
                  </button>
                  {open && (
                    <div className="px-3 pb-3 space-y-2">
                      {byMonth[m].map(r => {
                        const isOpen = openReport === r.id
                        return (
                          <div key={r.id} className="rounded-xl overflow-hidden" style={cardStyle}>
                            <div className="flex items-center justify-between px-5 py-4 gap-3">
                              <button type="button" onClick={() => setOpenReport(isOpen ? null : r.id)} aria-expanded={isOpen}
                                className="flex items-center gap-3 text-left flex-1 min-w-0" style={{ cursor: 'pointer' }}>
                                <Sparkles size={13} style={{ color: '#A78BFA', flexShrink: 0 }} aria-hidden="true" />
                                <span className="min-w-0">
                                  <span className="block text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>
                                    Week ending {new Date(`${r.weekEnding}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                  </span>
                                  <span className="block text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-subtle)' }}>
                                    {r.reportText.split('\n').find(l => l.startsWith('- '))?.replace('- ', '').replace(/\*\*/g, '').slice(0, 80) ?? 'Weekly review'}…
                                  </span>
                                </span>
                              </button>
                              {!demo && (
                                <button type="button" onClick={() => { if (confirm('Delete this report?')) onDeleteReport(r.id) }}
                                  className="p-1.5 rounded-lg lrr-danger" style={{ color: '#5A5A5A', cursor: 'pointer' }} aria-label="Delete report">
                                  <Trash2 size={13} />
                                </button>
                              )}
                              <ChevronDown size={14} style={{ color: '#606060', flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} aria-hidden="true" />
                            </div>
                            {isOpen && <div className="px-5 pb-5 pt-4 space-y-4" style={{ borderTop: '1px solid #2E2E2E' }}>{renderReport(r.reportText)}</div>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
