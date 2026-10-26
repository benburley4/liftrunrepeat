'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Dumbbell, Footprints, Mountain, Zap, Trash2, PersonStanding } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { SessionData, LoggedRunSegment } from '@/lib/computeStats'
import type { VolumeMultipliers } from '@/lib/exerciseLoad'
import { activityKind, sessionVolume, runKm, type ActivityKind } from '@/lib/progressData'
import { footKm, weekStartOf } from '@/lib/activity'
import { shiftDays } from '@/lib/progressRange'
import { ACTIVITY_COLORS, ACTIVITY_LABELS, cardStyle, fmtTonnes } from './progressStyle'
import { Pills } from './kit'

const ICONS: Record<ActivityKind, LucideIcon> = { lift: Dumbbell, run: Footprints, hike: Mountain, walk: PersonStanding, hybrid: Zap }
type Filter = 'all' | ActivityKind
const FILTERS: { id: Filter; label: string; color?: string }[] = [
  { id: 'all', label: 'All' },
  ...(['lift', 'run', 'hybrid', 'hike', 'walk'] as const).map(k => ({ id: k, label: ACTIVITY_LABELS[k], color: ACTIVITY_COLORS[k] })),
]
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** Per-session "load" for the weekly mini bars: tonnes/1000 + km, the readiness model's unit. */
const loadOf = (s: SessionData, mults?: VolumeMultipliers) => sessionVolume(s, mults) / 1000 + footKm(s)

function WeekBars({ start, sessions, mults }: { start: string; sessions: SessionData[]; mults?: VolumeMultipliers }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = shiftDays(start, i)
    const list = sessions.filter(s => s.date === d)
    return { d, load: list.reduce((n, s) => n + loadOf(s, mults), 0), kinds: list.map(activityKind) }
  })
  const max = Math.max(1, ...days.map(d => d.load))
  return (
    <div className="flex items-end gap-1" aria-hidden="true" style={{ height: 26 }}>
      {days.map((d, i) => {
        const kind = d.kinds.includes('hybrid') || (d.kinds.includes('lift') && d.kinds.some(k => k === 'run' || k === 'hike')) ? 'hybrid'
          : d.kinds.find(k => k !== 'walk') ?? d.kinds[0]
        return (
          <div key={d.d} className="flex flex-col items-center gap-0.5">
            <div style={{ width: 8, height: d.load ? Math.max(3, (d.load / max) * 18) : 2, borderRadius: 2, background: kind ? ACTIVITY_COLORS[kind] : '#2E2E2E' }} />
            <span style={{ fontSize: 8, color: '#8A8A8A', lineHeight: 1 }}>{DOW[i]}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function HistorySessions({ sessions, mults, demo, onOpen, onDelete, shortWalkKm, isShortWalk }: {
  sessions: SessionData[]
  mults?: VolumeMultipliers
  demo: boolean
  onOpen: (s: SessionData) => void
  onDelete: (savedAt: string) => void
  shortWalkKm: number
  isShortWalk: (s: SessionData) => boolean
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [showShortWalks, setShowShortWalks] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([`y-${new Date().getFullYear()}`, new Date().toISOString().slice(0, 7)]))
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const shortWalkCount = useMemo(() => sessions.filter(isShortWalk).length, [sessions, isShortWalk])

  const visible = useMemo(() => sessions
    .filter(s => showShortWalks || filter === 'walk' || !isShortWalk(s))
    .filter(s => filter === 'all' || activityKind(s) === filter)
    .sort((a, b) => b.date.localeCompare(a.date) || b.savedAt.localeCompare(a.savedAt)), [sessions, filter, showShortWalks, isShortWalk])

  const years = useMemo(() => {
    const y: Record<string, Record<string, SessionData[]>> = {}
    for (const s of visible) { const [yy, mm] = s.date.split('-'); ((y[yy] ??= {})[`${yy}-${mm}`] ??= []).push(s) }
    return y
  }, [visible])

  const toggle = (key: string) => setExpanded(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })

  const header = (key: string, label: string, count: number, nested: boolean, extra?: React.ReactNode) => (
    <button type="button" onClick={() => toggle(key)} aria-expanded={expanded.has(key)}
      className={`w-full flex items-center justify-between gap-3 py-3 ${nested ? 'pl-9 pr-5' : 'px-5'} pr-row`}
      style={{ background: nested ? '#161616' : '#1A1A1A', cursor: 'pointer' }}>
      <span className="flex items-center gap-3">
        <span className={`${nested ? 'text-xs' : 'text-sm'} font-bold uppercase`} style={{ color: nested ? '#C8C8C8' : '#F5F5F5', fontFamily: 'var(--font-heading)' }}>{label}</span>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#2E2E2E', color: '#8A8A8A' }}>{count}</span>
      </span>
      <span className="flex items-center gap-3">
        {extra}
        <ChevronDown size={16} style={{ color: '#606060', transform: expanded.has(key) ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} aria-hidden="true" />
      </span>
    </button>
  )

  function renderRow(s: SessionData) {
    const kind = activityKind(s)
    const col = ACTIVITY_COLORS[kind]
    const Icon = ICONS[kind]
    const km = runKm(s) + (s.hikeKm ?? 0)
    const kg = sessionVolume(s, mults)
    return (
      <div key={s.savedAt} className="relative pl-14 pr-5 py-3 pr-row" role="button" tabIndex={0} onClick={() => onOpen(s)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(s) } }}
        style={{ cursor: 'pointer' }}>
        <span className="absolute left-[22px] top-0 bottom-0 w-px" style={{ background: '#2A2A2A' }} aria-hidden="true" />
        <span className="absolute left-[11px] top-3.5 w-[23px] h-[23px] rounded-full flex items-center justify-center" style={{ background: `${col}22`, border: `1px solid ${col}66` }} aria-hidden="true">
          <Icon size={12} style={{ color: col }} />
        </span>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold uppercase truncate" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>{s.name}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-subtle)' }}>
              {new Date(`${s.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
              {' · '}<span style={{ color: col }}>{ACTIVITY_LABELS[kind]}</span>
            </p>
          </div>
          <span className="text-xs text-right" style={{ fontFamily: 'var(--font-mono)' }}>
            {kg > 0 && <span className="block" style={{ color: ACTIVITY_COLORS.lift }}>{fmtTonnes(kg)}</span>}
            {km > 0 && <span className="block" style={{ color: kind === 'run' || kind === 'hybrid' ? ACTIVITY_COLORS.run : ACTIVITY_COLORS.hike }}>{Math.round(km * 10) / 10} km</span>}
          </span>
          {s.needsSets && !demo && (
            <Link href={`/log/session?date=${s.date}`} onClick={e => e.stopPropagation()}
              className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}
              title="Recorded on your watch — log the sets you did">Add sets</Link>
          )}
          {!demo && (confirmDelete === s.savedAt ? (
            <span className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <button type="button" onClick={() => { onDelete(s.savedAt); setConfirmDelete(null) }} className="px-2 py-1 rounded text-xs font-semibold" style={{ background: '#C8102E', color: '#fff', cursor: 'pointer' }}>Delete</button>
              <button type="button" onClick={() => setConfirmDelete(null)} className="px-2 py-1 rounded text-xs" style={{ background: '#2E2E2E', color: '#A0A0A0', cursor: 'pointer' }}>Cancel</button>
            </span>
          ) : (
            <button type="button" onClick={e => { e.stopPropagation(); setConfirmDelete(s.savedAt) }} aria-label={`Delete ${s.name}`}
              className="p-1.5 rounded-lg lrr-danger" style={{ color: '#5A5A5A', cursor: 'pointer' }}>
              <Trash2 size={13} />
            </button>
          ))}
        </div>
        {(s.exercises ?? []).length > 0 && (
          <p className="text-xs mt-1 truncate" style={{ color: '#8A8A8A' }}>{(s.exercises ?? []).map(e => e.exerciseName).join(' · ')}</p>
        )}
        {(s.run ?? []).length > 0 && (
          <p className="text-xs mt-0.5 truncate" style={{ color: '#8A8A8A', fontFamily: 'var(--font-mono)' }}>
            {(s.run ?? []).map(e => 'kind' in e && e.kind === 'repeat'
              ? `${e.count}× (${e.laps.map(l => `${l.segmentType} ${l.actualValue}${l.metric === 'distance' ? 'km' : 'min'}`).join(' / ')})`
              : (() => { const g = e as LoggedRunSegment; return `${g.segmentType} ${g.actualValue}${g.metric === 'distance' ? ' km' : g.metric === 'time' ? ' min' : ''}${g.actualPace ? ` @ ${g.actualPace}` : ''}` })()).join(' · ')}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Pills label="Session type" options={FILTERS} value={filter} onChange={setFilter} />
        {shortWalkCount > 0 && filter !== 'walk' && (
          <button type="button" onClick={() => setShowShortWalks(v => !v)} aria-pressed={showShortWalks}
            className="px-3 py-1.5 rounded-lg text-xs" style={{ background: '#1A1A1A', color: showShortWalks ? '#00BFA5' : '#A0A0A0', border: '1px solid #2E2E2E', cursor: 'pointer' }}>
            {showShortWalks ? 'Hide' : 'Show'} {shortWalkCount} short watch walks (under {shortWalkKm} km)
          </button>
        )}
      </div>

      <div className="rounded-xl overflow-hidden" style={cardStyle}>
        {visible.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm" style={{ color: '#A0A0A0' }}>{sessions.length ? 'No sessions match this filter.' : 'No sessions logged yet.'}</p>
            {!sessions.length && <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Sessions saved in Log Session will appear here.</p>}
          </div>
        ) : Object.keys(years).sort((a, b) => b.localeCompare(a)).map(y => {
          const months = years[y]
          const total = Object.values(months).reduce((n, l) => n + l.length, 0)
          return (
            <div key={y} style={{ borderBottom: '1px solid #2E2E2E' }}>
              {header(`y-${y}`, y, total, false)}
              {expanded.has(`y-${y}`) && Object.keys(months).sort((a, b) => b.localeCompare(a)).map(mKey => {
                const list = months[mKey]
                const weeks = new Map<string, SessionData[]>()
                for (const s of list) { const w = weekStartOf(s.date); weeks.set(w, [...(weeks.get(w) ?? []), s]) }
                const monthKm = list.reduce((n, s) => n + footKm(s), 0)
                const monthKg = list.reduce((n, s) => n + sessionVolume(s, mults), 0)
                return (
                  <div key={mKey} style={{ borderTop: '1px solid #2E2E2E' }}>
                    {header(mKey, new Date(`${mKey}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long' }), list.length, true,
                      <span className="hidden sm:flex gap-3 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                        {monthKg > 0 && <span style={{ color: ACTIVITY_COLORS.lift }}>{fmtTonnes(monthKg)}</span>}
                        {monthKm > 0 && <span style={{ color: ACTIVITY_COLORS.run }}>{Math.round(monthKm)} km</span>}
                      </span>)}
                    {expanded.has(mKey) && [...weeks.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([w, ws]) => (
                      <div key={w}>
                        <div className="flex items-center justify-between gap-3 pl-14 pr-5 pt-3 pb-1">
                          <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-subtle)' }}>
                            Week of {new Date(`${w}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                          <WeekBars start={w} sessions={sessions.filter(s => s.date >= w && s.date < shiftDays(w, 7))} mults={mults} />
                        </div>
                        {ws.map(renderRow)}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
