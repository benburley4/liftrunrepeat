'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Zap, CircleCheck, Leaf, BedDouble, Footprints, Moon, Watch, Dumbbell } from 'lucide-react'
import { getZeppDaily, getSessionsOnDate, getSessionsNeedingSets, type StoredSession } from '@/lib/db'
import { freshWatchReadiness, localToday, latestReadiness, READINESS_CALL, type ZeppDay } from '@/lib/recovery'
import type { SessionData } from '@/lib/computeStats'

const LEVEL_ICON = { go: Zap, planned: CircleCheck, easy: Leaf, rest: BedDouble }

const fmtHours = (min: number) => `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, '0')}m`
const fmtClock = (iso: string) => new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

/**
 * Watch summary for the day: readiness call, steps, last night's sleep.
 * variant "today" (log page) adds the watch workouts on `date` and strength
 * sessions waiting for sets; "home" is a compact strip.
 * Renders nothing for users without watch data.
 */
export default function TodayWatchCard({ variant, date, onPickDate }: {
  variant: 'home' | 'today'
  date?: string
  onPickDate?: (date: string) => void
}) {
  const [rows, setRows] = useState<ZeppDay[] | null>(null)
  const [workouts, setWorkouts] = useState<SessionData[]>([])
  const [needsSets, setNeedsSets] = useState<SessionData[]>([])
  const today = localToday()
  const day = date ?? today

  useEffect(() => {
    getZeppDaily().then(setRows).catch(() => setRows([]))
    if (variant === 'today') getSessionsNeedingSets().then(s => setNeedsSets(s as unknown as SessionData[])).catch(() => {})
  }, [variant])

  useEffect(() => {
    if (variant !== 'today') return
    getSessionsOnDate(day)
      .then((list: StoredSession[]) => setWorkouts((list as unknown as SessionData[]).filter(s => s.zepp)))
      .catch(() => setWorkouts([]))
  }, [variant, day])

  if (!rows || !rows.length) return null

  const readiness = day === today ? freshWatchReadiness(rows, today) : null
  const pastDay = day !== today ? rows.find(r => r.date === day) : null
  const score = readiness?.score ?? (pastDay?.readiness != null ? Math.round(pastDay.readiness) : null)
  const call = readiness ? READINESS_CALL[readiness.level] : null
  const Icon = readiness ? LEVEL_ICON[readiness.level] : null
  const row = rows.find(r => r.date === day)
  const lastScored = latestReadiness(rows)

  const stats = (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm" style={{ color: '#A0A0A0' }}>
      {row?.steps != null && (
        <span className="flex items-center gap-1.5"><Footprints size={14} aria-hidden="true" />
          <span style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>{row.steps.toLocaleString()}</span> steps</span>
      )}
      {row?.sleep_min != null && (
        <span className="flex items-center gap-1.5"><Moon size={14} aria-hidden="true" />
          <span style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>{fmtHours(row.sleep_min)}</span> sleep{row.sleep_score != null ? ` · score ${row.sleep_score}` : ''}</span>
      )}
    </div>
  )

  const readinessBlock = score != null ? (
    <div className="flex items-center gap-3">
      <span className="text-3xl font-black" style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>{score}</span>
      <div>
        <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--color-text-subtle)' }}>
          Readiness{readiness && readiness.day.date !== today ? ' · last night' : ''}
        </p>
        {call && Icon && (
          <p className="flex items-center gap-1.5 text-sm font-bold" style={{ color: '#F5F5F5' }}>
            <Icon size={14} color={call.color} aria-hidden="true" /> {call.label}
          </p>
        )}
      </div>
    </div>
  ) : (
    <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
      No fresh watch readiness{lastScored ? ` — last scored ${fmtDate(lastScored.date)}` : ''}. Open ZeppBridge to sync.
    </p>
  )

  if (variant === 'home') {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-24">
        <div className="rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-4" style={{ background: '#141414', border: '1px solid #2E2E2E' }}>
          <div className="flex flex-wrap items-center gap-6">
            {readinessBlock}
            {stats}
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/log/session" style={{ color: '#00BFA5' }}>Log today →</Link>
            <Link href="/recovery" style={{ color: '#A0A0A0' }}>Recovery</Link>
          </div>
        </div>
      </div>
    )
  }

  const pendingOthers = needsSets.filter(s => s.date !== day).slice(0, 5)
  const pendingHere = needsSets.find(s => s.date === day)

  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: '#1A1A1A', border: `1px solid ${call ? `${call.color}40` : '#2E2E2E'}` }}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        {readinessBlock}
        {stats}
      </div>
      {call && <p className="text-sm" style={{ color: '#A0A0A0' }}>{call.advice}</p>}

      {workouts.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-subtle)' }}>
            <Watch size={12} aria-hidden="true" /> Recorded on your watch
          </p>
          <ul className="space-y-1">
            {workouts.map(s => (
              <li key={s.savedAt} className="text-sm flex flex-wrap gap-x-2" style={{ color: '#F5F5F5' }}>
                <span className="font-semibold">{s.name}</span>
                <span style={{ color: 'var(--color-text-subtle)', fontFamily: 'var(--font-mono)' }}>
                  {fmtClock(s.zepp!.startTime)} · {s.zepp!.durationMin} min{s.zepp!.distanceKm ? ` · ${s.zepp!.distanceKm} km` : ''}{s.zepp!.avgHr ? ` · HR ${s.zepp!.avgHr}` : ''}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-subtle)' }}>
            {pendingHere
              ? 'Log the sets for this strength session here — the next sync merges the watch heart rate and time into what you save.'
              : 'Watch heart rate and time attach to a matching session you log for this day at the next sync.'}
          </p>
        </div>
      )}

      {pendingOthers.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-widest mb-2" style={{ color: '#F59E0B' }}>
            <Dumbbell size={12} aria-hidden="true" /> Strength sessions waiting for sets
          </p>
          <ul className="flex flex-wrap gap-2">
            {pendingOthers.map(s => (
              <li key={s.savedAt}>
                <button onClick={() => onPickDate?.(s.date)} className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#F5F5F5', cursor: 'pointer' }}>
                  {fmtDate(s.date)} · {s.zepp?.durationMin} min{s.zepp?.avgHr ? ` · HR ${s.zepp.avgHr}` : ''}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
