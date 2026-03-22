'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Dumbbell, Heart, Footprints, ArrowRight, TrendingUp, BarChart2, Zap, X, Plus } from 'lucide-react'
import { programmes, Programme } from '@/lib/mockData'
import ProgrammeCard from '@/components/ui/ProgrammeCard'
import QuickLogFAB from '@/components/log/QuickLogFAB'
import WeekPreview from '@/components/ui/WeekPreview'

type ModalType = 'logger' | 'analytics' | 'programme' | 'builder' | null

// ── Modal wrapper ──────────────────────────────────────────────────────────────
function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      {children}
    </div>
  )
}

// ── Logger Modal ───────────────────────────────────────────────────────────────
function LoggerModal({ onClose }: { onClose: () => void }) {
  const [sessionType, setSessionType] = useState<'lift' | 'run' | 'hybrid'>('hybrid')
  const sets = [
    { set: 1, weight: 130, reps: 5, rpe: 7 },
    { set: 2, weight: 130, reps: 5, rpe: 8 },
    { set: 3, weight: 130, reps: 4, rpe: 9 },
  ]
  const typeColors: Record<string, string> = { lift: '#00BFA5', run: '#C8102E', hybrid: '#A78BFA' }
  const color = typeColors[sessionType]

  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-full flex flex-col rounded-2xl overflow-hidden" style={{ maxWidth: '520px', maxHeight: '90vh', background: '#141414', border: '1px solid #2E2E2E' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2E2E2E' }}>
          <div>
            <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Session Logger</p>
            <h2 className="text-2xl font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>Today&apos;s Session</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#606060', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Session type */}
          <div className="flex gap-2">
            {(['lift', 'run', 'hybrid'] as const).map(t => (
              <button key={t} onClick={() => setSessionType(t)}
                className="flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all"
                style={{
                  background: sessionType === t ? `${typeColors[t]}20` : '#1E1E1E',
                  color: sessionType === t ? typeColors[t] : '#606060',
                  border: `1px solid ${sessionType === t ? typeColors[t] + '44' : '#2E2E2E'}`,
                  fontFamily: 'Inter, sans-serif',
                }}>
                {t}
              </button>
            ))}
          </div>

          {/* Lift block */}
          {(sessionType === 'lift' || sessionType === 'hybrid') && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Dumbbell size={13} style={{ color: '#00BFA5' }} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#00BFA5', fontFamily: 'Montserrat, sans-serif' }}>Lift Block</span>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ background: '#1E1E1E', border: '1px solid #2E2E2E' }}>
                <div className="px-4 py-3" style={{ borderBottom: '1px solid #2E2E2E' }}>
                  <p className="text-sm font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>Back Squat</p>
                </div>
                <div className="p-3 space-y-1.5">
                  <div className="grid grid-cols-4 gap-2 mb-1">
                    {['Set', 'kg', 'Reps', 'RPE'].map(h => (
                      <div key={h} className="text-center text-xs" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>{h}</div>
                    ))}
                  </div>
                  {sets.map(s => (
                    <div key={s.set} className="grid grid-cols-4 gap-2">
                      <div className="py-1.5 rounded text-xs text-center" style={{ background: '#2A2A2A', color: '#606060', fontFamily: 'JetBrains Mono, monospace' }}>{s.set}</div>
                      <div className="py-1.5 rounded text-xs text-center" style={{ background: '#2A2A2A', color: '#F5F5F5', fontFamily: 'JetBrains Mono, monospace' }}>{s.weight}</div>
                      <div className="py-1.5 rounded text-xs text-center" style={{ background: '#2A2A2A', color: '#F5F5F5', fontFamily: 'JetBrains Mono, monospace' }}>{s.reps}</div>
                      <div className="py-1.5 rounded text-xs text-center" style={{ background: '#2A2A2A', color: '#A0A0A0', fontFamily: 'JetBrains Mono, monospace' }}>{s.rpe}</div>
                    </div>
                  ))}
                </div>
              </div>
              <button className="flex items-center gap-1.5 mt-2 text-xs" style={{ background: 'none', border: 'none', color: '#606060', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                <Plus size={12} /> Add Exercise
              </button>
            </div>
          )}

          {/* Run block */}
          {(sessionType === 'run' || sessionType === 'hybrid') && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Footprints size={13} style={{ color: '#C8102E' }} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#C8102E', fontFamily: 'Montserrat, sans-serif' }}>Run Block</span>
              </div>
              <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: '#1E1E1E', border: '1px solid #2E2E2E' }}>
                <div>
                  <p className="text-sm font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>Easy Run</p>
                  <p className="text-xs mt-0.5" style={{ color: '#606060' }}>Zone 2 · 5:30/km</p>
                </div>
                <p className="text-lg font-bold" style={{ color: '#C8102E', fontFamily: 'JetBrains Mono, monospace' }}>8 km</p>
              </div>
            </div>
          )}

          {/* Sign up note */}
          <div className="rounded-xl px-4 py-3 text-center" style={{ background: 'rgba(0,191,165,0.06)', border: '1px solid rgba(0,191,165,0.2)' }}>
            <p className="text-xs" style={{ color: '#A0A0A0', fontFamily: 'Inter, sans-serif' }}>
              <Link href="/login" style={{ color: '#00BFA5', fontWeight: 700 }}>Sign up</Link> to save your sessions and track progress over time
            </p>
          </div>
        </div>

        <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid #2E2E2E' }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'none', border: '1px solid #2E2E2E', color: '#606060', fontSize: '14px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            Close
          </button>
          <Link href="/login"
            className="flex-1 text-center py-3 rounded-xl text-sm font-bold"
            style={{ background: color, color: '#0D0D0D', fontFamily: 'Inter, sans-serif' }}>
            Sign Up to Save
          </Link>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── Analytics Modal ────────────────────────────────────────────────────────────
function AnalyticsModal({ onClose }: { onClose: () => void }) {
  const stats = [
    { label: 'Total Sessions', value: '84', accent: '#00BFA5' },
    { label: 'Total Km Run', value: '612', accent: '#C8102E' },
    { label: 'PRs Set', value: '23', accent: '#A78BFA' },
    { label: 'Avg Weekly Vol', value: '14.2t', accent: '#F59E0B' },
  ]

  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-full flex flex-col rounded-2xl overflow-hidden" style={{ maxWidth: '620px', maxHeight: '90vh', background: '#141414', border: '1px solid #2E2E2E' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2E2E2E' }}>
          <div>
            <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Analytics Preview</p>
            <h2 className="text-2xl font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>Hybrid Dashboard</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#606060', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map(s => (
              <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: '#1E1E1E', border: '1px solid #2E2E2E' }}>
                <p className="text-2xl font-black" style={{ color: s.accent, fontFamily: 'JetBrains Mono, monospace' }}>{s.value}</p>
                <p className="text-xs mt-0.5" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Interference chart */}
          <div className="rounded-xl p-5" style={{ background: '#1E1E1E', border: '1px solid #2E2E2E' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: '#606060' }}>12-Week Trend</p>
                <p className="text-base font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>Interference Analysis</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 rounded" style={{ background: '#00BFA5' }} />
                  <span className="text-xs" style={{ color: '#606060' }}>Squat 1RM</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-2 rounded-sm" style={{ background: '#C8102E', opacity: 0.5 }} />
                  <span className="text-xs" style={{ color: '#606060' }}>Weekly Km</span>
                </div>
              </div>
            </div>

            <div className="relative h-44">
              <div className="flex items-end gap-1 h-full">
                {[30, 35, 40, 50, 60, 65, 85, 95, 90, 65, 50, 38].map((h, i) => (
                  <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: '#C8102E', opacity: 0.4, minHeight: '4px', marginTop: 'auto' }} />
                ))}
              </div>
              <div className="absolute inset-0 pointer-events-none">
                <svg className="w-full h-full" viewBox="0 0 120 48" preserveAspectRatio="none">
                  <polyline points="5,40 15,36 25,32 35,28 45,23 55,19 65,19 75,21 85,19 95,14 105,9 115,5"
                    fill="none" stroke="#00BFA5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  {[5,15,25,35,45,55,65,75,85,95,105,115].map((x, i) => {
                    const ys = [40,36,32,28,23,19,19,21,19,14,9,5]
                    return <circle key={i} cx={x} cy={ys[i]} r="2" fill="#00BFA5" />
                  })}
                </svg>
              </div>
            </div>

            <div className="rounded-lg px-4 py-3 flex items-start gap-3 mt-4"
              style={{ background: 'rgba(200,16,46,0.08)', border: '1px solid rgba(200,16,46,0.25)' }}>
              <TrendingUp size={15} style={{ color: '#C8102E', flexShrink: 0, marginTop: 2 }} />
              <p className="text-xs leading-relaxed" style={{ color: '#A0A0A0', fontFamily: 'Inter, sans-serif' }}>
                <span style={{ color: '#C8102E', fontWeight: 600 }}>Interference Detected (W7–9):</span> Squat stalled while weekly km peaked at 61 km. Sign up to unlock your personal analysis.
              </p>
            </div>
          </div>

          {/* Sign up note */}
          <div className="rounded-xl px-4 py-3 text-center" style={{ background: 'rgba(0,191,165,0.06)', border: '1px solid rgba(0,191,165,0.2)' }}>
            <p className="text-xs" style={{ color: '#A0A0A0', fontFamily: 'Inter, sans-serif' }}>
              <Link href="/login" style={{ color: '#00BFA5', fontWeight: 700 }}>Sign up</Link> to track your own data and see your interference patterns
            </p>
          </div>
        </div>

        <div className="px-6 py-4" style={{ borderTop: '1px solid #2E2E2E' }}>
          <Link href="/login" className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold"
            style={{ background: '#00BFA5', color: '#0D0D0D', fontFamily: 'Inter, sans-serif' }}>
            <BarChart2 size={15} /> Sign Up to Track Your Data
          </Link>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── Programme Modal ────────────────────────────────────────────────────────────
function ProgrammeModal({ programme, onClose }: { programme: Programme; onClose: () => void }) {
  const goalColors: Record<string, string> = { strength: '#00BFA5', endurance: '#C8102E', hybrid: '#A78BFA', 'strength-bias': '#00BFA5', 'endurance-bias': '#C8102E' }
  const color = goalColors[programme.goalBias] || '#A0A0A0'

  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-full flex flex-col rounded-2xl overflow-hidden" style={{ maxWidth: '540px', maxHeight: '90vh', background: '#141414', border: '1px solid #2E2E2E' }}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5" style={{ borderBottom: '1px solid #2E2E2E' }}>
          <div>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color, fontFamily: 'Inter, sans-serif' }}>{programme.goalBias.replace('-', ' ')}</p>
            <h2 className="text-2xl font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>{programme.name}</h2>
            <p className="text-sm mt-1" style={{ color: '#A0A0A0', fontFamily: 'Inter, sans-serif' }}>{programme.description}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#606060', cursor: 'pointer', flexShrink: 0, marginLeft: '16px' }}><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Duration', value: `${programme.durationWeeks}wk` },
              { label: 'Lift Days', value: `${programme.liftDays}/wk` },
              { label: 'Level', value: programme.level },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: '#1E1E1E', border: '1px solid #2E2E2E' }}>
                <p className="text-xl font-black capitalize" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>{s.value}</p>
                <p className="text-xs mt-0.5" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Week preview */}
          <div>
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Sample Week</p>
            <WeekPreview days={programme.weekPreview} />
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {programme.tags.map(tag => (
              <span key={tag} className="px-2.5 py-1 rounded text-xs" style={{ background: '#1E1E1E', color: '#606060', border: '1px solid #2E2E2E' }}>
                {tag}
              </span>
            ))}
          </div>

          {/* Sign up note */}
          <div className="rounded-xl px-4 py-3 text-center" style={{ background: 'rgba(0,191,165,0.06)', border: '1px solid rgba(0,191,165,0.2)' }}>
            <p className="text-xs" style={{ color: '#A0A0A0', fontFamily: 'Inter, sans-serif' }}>
              <Link href="/login" style={{ color: '#00BFA5', fontWeight: 700 }}>Sign up</Link> to start this programme and track your progress week by week
            </p>
          </div>
        </div>

        <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid #2E2E2E' }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'none', border: '1px solid #2E2E2E', color: '#606060', fontSize: '14px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            Back
          </button>
          <Link href="/login" className="flex-1 text-center py-3 rounded-xl text-sm font-bold"
            style={{ background: color, color: '#0D0D0D', fontFamily: 'Inter, sans-serif' }}>
            Sign Up to Start
          </Link>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── Builder Modal ──────────────────────────────────────────────────────────────
const SESSION_TYPES = ['Rest', 'Lift', 'Run', 'Hybrid'] as const
type DaySession = typeof SESSION_TYPES[number]
const sessionColors: Record<DaySession, string> = { Rest: '#3E3E3E', Lift: '#00BFA5', Run: '#C8102E', Hybrid: '#A78BFA' }
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const defaultSchedule: DaySession[] = ['Lift', 'Run', 'Rest', 'Lift', 'Run', 'Hybrid', 'Rest']

function BuilderModal({ onClose }: { onClose: () => void }) {
  const [schedule, setSchedule] = useState<DaySession[]>(defaultSchedule)

  function cycle(i: number) {
    const idx = SESSION_TYPES.indexOf(schedule[i])
    const next = SESSION_TYPES[(idx + 1) % SESSION_TYPES.length]
    setSchedule(s => s.map((v, j) => j === i ? next : v))
  }

  const liftCount = schedule.filter(s => s === 'Lift' || s === 'Hybrid').length
  const runCount = schedule.filter(s => s === 'Run' || s === 'Hybrid').length

  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-full flex flex-col rounded-2xl overflow-hidden" style={{ maxWidth: '520px', maxHeight: '90vh', background: '#141414', border: '1px solid #2E2E2E' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2E2E2E' }}>
          <div>
            <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Programme Builder</p>
            <h2 className="text-2xl font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>Weekly Schedule</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#606060', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <p className="text-xs" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Tap a day to cycle through session types</p>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-2">
            {days.map((day, i) => {
              const type = schedule[i]
              const color = sessionColors[type]
              return (
                <button key={day} onClick={() => cycle(i)}
                  className="flex flex-col items-center gap-2 py-3 rounded-xl transition-all"
                  style={{
                    background: `${color}18`,
                    border: `1px solid ${color}44`,
                    cursor: 'pointer',
                  }}>
                  <span className="text-xs font-bold" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>{day}</span>
                  <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="text-xs font-bold" style={{ color, fontFamily: 'Inter, sans-serif', fontSize: '9px' }}>{type.toUpperCase()}</span>
                </button>
              )
            })}
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl p-3 text-center" style={{ background: '#1E1E1E', border: '1px solid #2E2E2E' }}>
              <p className="text-2xl font-black" style={{ color: '#00BFA5', fontFamily: 'JetBrains Mono, monospace' }}>{liftCount}</p>
              <p className="text-xs mt-0.5" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Lift days</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: '#1E1E1E', border: '1px solid #2E2E2E' }}>
              <p className="text-2xl font-black" style={{ color: '#C8102E', fontFamily: 'JetBrains Mono, monospace' }}>{runCount}</p>
              <p className="text-xs mt-0.5" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Run days</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: '#1E1E1E', border: '1px solid #2E2E2E' }}>
              <p className="text-2xl font-black" style={{ color: '#3E3E3E', fontFamily: 'JetBrains Mono, monospace' }}>{schedule.filter(s => s === 'Rest').length}</p>
              <p className="text-xs mt-0.5" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Rest days</p>
            </div>
          </div>

          {/* Sign up note */}
          <div className="rounded-xl px-4 py-3 text-center" style={{ background: 'rgba(0,191,165,0.06)', border: '1px solid rgba(0,191,165,0.2)' }}>
            <p className="text-xs" style={{ color: '#A0A0A0', fontFamily: 'Inter, sans-serif' }}>
              <Link href="/login" style={{ color: '#00BFA5', fontWeight: 700 }}>Sign up</Link> to save your schedule and build a full programme with exercises and targets
            </p>
          </div>
        </div>

        <div className="px-6 py-4" style={{ borderTop: '1px solid #2E2E2E' }}>
          <Link href="/login" className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold"
            style={{ background: '#00BFA5', color: '#0D0D0D', fontFamily: 'Inter, sans-serif' }}>
            <Zap size={15} /> Sign Up to Save Your Schedule
          </Link>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── Home Page ──────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [modal, setModal] = useState<ModalType>(null)
  const [activeProgramme, setActiveProgramme] = useState<Programme | null>(null)

  function openProgramme(p: Programme) {
    setActiveProgramme(p)
    setModal('programme')
  }

  return (
    <div style={{ background: '#0D0D0D' }}>
      <QuickLogFAB />

      {/* Modals */}
      {modal === 'logger' && <LoggerModal onClose={() => setModal(null)} />}
      {modal === 'analytics' && <AnalyticsModal onClose={() => setModal(null)} />}
      {modal === 'programme' && activeProgramme && (
        <ProgrammeModal programme={activeProgramme} onClose={() => { setModal(null); setActiveProgramme(null) }} />
      )}
      {modal === 'builder' && <BuilderModal onClose={() => setModal(null)} />}

      {/* HERO */}
      <section className="relative overflow-hidden min-h-screen flex items-center">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 20% 50%, rgba(0,229,200,0.06) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 50%, rgba(255,107,53,0.06) 0%, transparent 60%)',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
          <div className="max-w-4xl">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
              style={{ background: 'rgba(0,229,200,0.08)', border: '1px solid rgba(0,229,200,0.2)' }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#00BFA5' }} />
              <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: '#00BFA5', fontFamily: 'Inter, sans-serif' }}>
                Built for Hybrid Athletes
              </span>
            </div>

            <h1
              className="leading-none font-black uppercase mb-6"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontSize: 'clamp(52px, 10vw, 112px)',
                letterSpacing: '-0.02em',
                color: '#F5F5F5',
              }}
            >
              STRONG ENOUGH<br />
              TO <span style={{ color: '#00BFA5' }}>RUN FAR.</span>
              <br />
              FAST ENOUGH<br />
              TO <span style={{ color: '#C8102E' }}>LIFT HEAVY.</span>
            </h1>

            <p
              className="text-xl mb-10 max-w-2xl leading-relaxed"
              style={{ color: '#A0A0A0', fontFamily: 'Inter, sans-serif' }}
            >
              The platform built for hybrid athletes. Log both. Track both. Peak at both.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="flex items-center gap-2 px-7 py-4 rounded-xl text-base font-bold transition-opacity hover:opacity-90"
                style={{ background: '#00BFA5', color: '#0D0D0D', fontFamily: 'Inter, sans-serif' }}
              >
                Get Started Free
                <ArrowRight size={18} />
              </Link>
              <Link
                href="/programmes"
                className="flex items-center gap-2 px-7 py-4 rounded-xl text-base font-bold"
                style={{
                  background: 'transparent',
                  color: '#C8102E',
                  border: '2px solid #C8102E',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Browse Programmes
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* PHILOSOPHY STRIP */}
      <section className="py-24" style={{ borderTop: '1px solid #1A1A1A' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2
              className="text-5xl font-black uppercase mb-4"
              style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}
            >
              Train Both. Peak Together.
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: '#A0A0A0', fontFamily: 'Inter, sans-serif' }}>
              Concurrent training interference is real — but manageable. Smart programming means you never have to choose.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Dumbbell,
                title: 'Strength',
                desc: 'Build a solid barbell foundation. Track 1RMs, volume, and progressive overload with tools built for strength athletes.',
                accent: '#00BFA5',
                bg: 'rgba(0,229,200,0.06)',
                border: 'rgba(0,229,200,0.15)',
              },
              {
                icon: Heart,
                title: 'Recovery',
                desc: 'Interference happens when programming ignores recovery. Our conflict checker flags risky session pairings before they cost you.',
                accent: '#A78BFA',
                bg: 'rgba(167,139,250,0.06)',
                border: 'rgba(167,139,250,0.15)',
              },
              {
                icon: Footprints,
                title: 'Endurance',
                desc: 'From 5K to ultra. Track VDOT, paces, mileage, and race goals alongside your lifting — all in one dashboard.',
                accent: '#C8102E',
                bg: 'rgba(255,107,53,0.06)',
                border: 'rgba(255,107,53,0.15)',
              },
            ].map(({ icon: Icon, title, desc, accent, bg, border }) => (
              <div
                key={title}
                className="rounded-2xl p-8 flex flex-col gap-4"
                style={{ background: bg, border: `1px solid ${border}` }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: `${accent}18` }}
                >
                  <Icon size={24} style={{ color: accent }} />
                </div>
                <h3
                  className="text-2xl font-black uppercase"
                  style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}
                >
                  {title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: '#A0A0A0', fontFamily: 'Inter, sans-serif' }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROGRAMME SHOWCASE */}
      <section className="py-24" style={{ background: '#0A0A0A', borderTop: '1px solid #1A1A1A' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#00BFA5', fontFamily: 'Inter, sans-serif' }}>
                Programming
              </p>
              <h2
                className="text-5xl font-black uppercase"
                style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}
              >
                Featured Programmes
              </h2>
            </div>
            <Link
              href="/programmes"
              className="flex items-center gap-1.5 text-sm font-semibold"
              style={{ color: '#A0A0A0', fontFamily: 'Inter, sans-serif' }}
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {programmes.slice(0, 3).map(p => (
              <ProgrammeCard key={p.id} programme={p} onStart={() => openProgramme(p)} />
            ))}
          </div>
        </div>
      </section>

      {/* LOGGER PREVIEW */}
      <section className="py-24" style={{ borderTop: '1px solid #1A1A1A' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#C8102E', fontFamily: 'Inter, sans-serif' }}>
                Session Logging
              </p>
              <h2
                className="text-5xl font-black uppercase mb-4"
                style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}
              >
                Log Both.<br />In One Place.
              </h2>
              <p className="text-base leading-relaxed mb-6" style={{ color: '#A0A0A0', fontFamily: 'Inter, sans-serif' }}>
                The only logger that understands hybrid sessions. Log your squat PR and your easy run in the same session. Track interference. See patterns.
              </p>
              <button
                onClick={() => setModal('logger')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-opacity hover:opacity-90"
                style={{ background: '#C8102E', color: '#F5F5F5', fontFamily: 'Inter, sans-serif', border: 'none', cursor: 'pointer' }}
              >
                Open Logger <ArrowRight size={16} />
              </button>
            </div>

            {/* Mock log card */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}
            >
              <div
                className="px-5 py-4 flex items-center justify-between"
                style={{ background: '#242424', borderBottom: '1px solid #2E2E2E' }}
              >
                <div>
                  <p className="text-xs uppercase tracking-wider" style={{ color: '#A0A0A0' }}>March 19, 2026</p>
                  <h3
                    className="text-lg font-black uppercase"
                    style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}
                  >
                    Today&apos;s Session: Hybrid
                  </h3>
                </div>
                <div
                  className="px-3 py-1 rounded-full text-xs font-bold"
                  style={{ background: 'rgba(167,139,250,0.12)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.3)' }}
                >
                  HYBRID
                </div>
              </div>

              <div className="p-5" style={{ borderBottom: '1px solid #2E2E2E' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Dumbbell size={14} style={{ color: '#00BFA5' }} />
                  <span className="text-xs uppercase font-bold tracking-wider" style={{ color: '#00BFA5', fontFamily: 'Montserrat, sans-serif' }}>
                    Lift Block
                  </span>
                </div>
                <div
                  className="rounded-lg px-4 py-3"
                  style={{ background: '#242424', border: '1px solid #2E2E2E' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold" style={{ color: '#F5F5F5', fontFamily: 'Montserrat, sans-serif', fontSize: '16px' }}>
                      BACK SQUAT
                    </span>
                    <span className="text-xs" style={{ color: '#00BFA5', fontFamily: 'JetBrains Mono, monospace' }}>
                      Est. 1RM: 161 kg
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { set: 1, weight: 143, reps: 5, rpe: 8 },
                      { set: 2, weight: 143, reps: 5, rpe: 8 },
                      { set: 3, weight: 143, reps: 5, rpe: 9 },
                    ].map(s => (
                      <div key={s.set} className="grid grid-cols-4 gap-2">
                        <div className="py-1 rounded text-xs text-center" style={{ background: '#1A1A1A', color: '#606060', fontFamily: 'JetBrains Mono, monospace' }}>{s.set}</div>
                        <div className="py-1 rounded text-xs text-center" style={{ background: '#1A1A1A', color: '#F5F5F5', fontFamily: 'JetBrains Mono, monospace' }}>{s.weight}kg</div>
                        <div className="py-1 rounded text-xs text-center" style={{ background: '#1A1A1A', color: '#F5F5F5', fontFamily: 'JetBrains Mono, monospace' }}>{s.reps}</div>
                        <div className="py-1 rounded text-xs text-center" style={{ background: '#1A1A1A', color: '#A0A0A0', fontFamily: 'JetBrains Mono, monospace' }}>RPE {s.rpe}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Footprints size={14} style={{ color: '#C8102E' }} />
                  <span className="text-xs uppercase font-bold tracking-wider" style={{ color: '#C8102E', fontFamily: 'Montserrat, sans-serif' }}>
                    Run Block
                  </span>
                </div>
                <div
                  className="rounded-lg px-4 py-3 flex items-center justify-between"
                  style={{ background: '#242424', border: '1px solid #2E2E2E' }}
                >
                  <div>
                    <p className="font-bold" style={{ color: '#F5F5F5', fontFamily: 'Montserrat, sans-serif', fontSize: '16px' }}>
                      EASY RUN
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#A0A0A0' }}>Zone 2 aerobic</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold" style={{ color: '#C8102E', fontFamily: 'JetBrains Mono, monospace' }}>10 km</p>
                    <p className="text-xs" style={{ color: '#606060', fontFamily: 'JetBrains Mono, monospace' }}>@ 5:33/km</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ANALYTICS TEASER */}
      <section className="py-24" style={{ background: '#0A0A0A', borderTop: '1px solid #1A1A1A' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div
              className="rounded-2xl p-6"
              style={{
                background: 'linear-gradient(135deg, rgba(0,229,200,0.04) 0%, rgba(255,107,53,0.04) 100%)',
                border: '1px solid #2E2E2E',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-wider" style={{ color: '#606060' }}>Hybrid Analytics</p>
                  <h3
                    className="text-xl font-black uppercase"
                    style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}
                  >
                    Interference Trend
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 rounded" style={{ background: '#00BFA5' }} />
                    <span className="text-xs" style={{ color: '#606060' }}>Squat 1RM</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-2 rounded-sm" style={{ background: '#C8102E', opacity: 0.5 }} />
                    <span className="text-xs" style={{ color: '#606060' }}>Weekly Km</span>
                  </div>
                </div>
              </div>

              <div className="relative h-48 mb-3">
                <div className="flex items-end gap-1 h-full">
                  {[30, 35, 40, 50, 60, 65, 85, 95, 90, 65, 50, 38].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm"
                      style={{ height: `${h}%`, background: '#C8102E', opacity: 0.4, minHeight: '4px', marginTop: 'auto' }}
                    />
                  ))}
                </div>
                <div className="absolute inset-0 pointer-events-none">
                  <svg className="w-full h-full" viewBox="0 0 120 48" preserveAspectRatio="none">
                    <polyline
                      points="5,40 15,36 25,32 35,28 45,23 55,19 65,19 75,21 85,19 95,14 105,9 115,5"
                      fill="none"
                      stroke="#00BFA5"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {[5,15,25,35,45,55,65,75,85,95,105,115].map((x, i) => {
                      const ys = [40,36,32,28,23,19,19,21,19,14,9,5]
                      return <circle key={i} cx={x} cy={ys[i]} r="2" fill="#00BFA5" />
                    })}
                  </svg>
                </div>
              </div>

              <div
                className="rounded-lg px-4 py-3 flex items-start gap-3"
                style={{ background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)' }}
              >
                <TrendingUp size={16} style={{ color: '#C8102E', flexShrink: 0, marginTop: 2 }} />
                <p className="text-xs leading-relaxed" style={{ color: '#A0A0A0', fontFamily: 'Inter, sans-serif' }}>
                  <span style={{ color: '#C8102E', fontWeight: 600 }}>Interference Detected (W7-9):</span> Squat stalled while km peaked at 61 km/wk.
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#00BFA5', fontFamily: 'Inter, sans-serif' }}>
                Analytics
              </p>
              <h2
                className="text-5xl font-black uppercase mb-4"
                style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}
              >
                See the<br />Interference.
              </h2>
              <p className="text-base leading-relaxed mb-6" style={{ color: '#A0A0A0', fontFamily: 'Inter, sans-serif' }}>
                We overlay your strength trends with your running volume to reveal the exact weeks where concurrent training interference hit your gains. No other platform does this.
              </p>
              <button
                onClick={() => setModal('analytics')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-opacity hover:opacity-90"
                style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #2E2E2E', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}
              >
                <BarChart2 size={16} />
                View Analytics
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <section
        className="py-20"
        style={{
          background: 'linear-gradient(135deg, rgba(0,229,200,0.08) 0%, rgba(255,107,53,0.08) 100%)',
          borderTop: '1px solid rgba(0,229,200,0.15)',
        }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2
            className="text-6xl font-black uppercase mb-4"
            style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}
          >
            Ready to Train Like<br />a <span style={{ color: '#00BFA5' }}>Hybrid Athlete?</span>
          </h2>
          <p className="text-lg mb-8" style={{ color: '#A0A0A0', fontFamily: 'Inter, sans-serif' }}>
            Build your schedule, track both disciplines, and peak at both.
          </p>
          <button
            onClick={() => setModal('builder')}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base font-bold transition-opacity hover:opacity-90"
            style={{ background: '#00BFA5', color: '#0D0D0D', fontFamily: 'Inter, sans-serif', border: 'none', cursor: 'pointer' }}
          >
            <Zap size={18} />
            Start Building Your Schedule
          </button>
        </div>
      </section>
    </div>
  )
}
