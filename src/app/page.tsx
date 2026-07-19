'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Dumbbell, Heart, Footprints, ArrowRight, TrendingUp, BarChart2, Zap, Plus, Sparkles, Brain } from 'lucide-react'
import { programmes, Programme } from '@/lib/exerciseLibrary'
import ProgrammeCard from '@/components/ui/ProgrammeCard'
import QuickLogFAB from '@/components/log/QuickLogFAB'
import WeekPreview from '@/components/ui/WeekPreview'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import StatTile from '@/components/ui/StatTile'
import SectionHeading from '@/components/ui/SectionHeading'
import Reveal from '@/components/ui/Reveal'
import InterferenceChart from '@/components/ui/InterferenceChart'
import { useAuth } from '@/context/AuthContext'
import { BUILTIN_PLANS, expandPlanToProgramme } from '@/lib/builtinProgrammes'
import { upsertProgramme, upsertSetting } from '@/lib/db'

type ModalType = 'logger' | 'analytics' | 'programme' | 'builder' | null

const SUBTLE = 'var(--color-text-subtle)'

// ── Shared sign-up note ────────────────────────────────────────────────────────
function SignupNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl px-4 py-3 text-center" style={{ background: 'rgba(0,191,165,0.06)', border: '1px solid rgba(0,191,165,0.2)' }}>
      <p className="text-xs" style={{ color: '#A0A0A0', fontFamily: 'var(--font-sans)' }}>{children}</p>
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
    <Modal
      onClose={onClose}
      eyebrow="Session Logger"
      title="Today's Session"
      footer={
        <>
          <Button onClick={onClose} variant="subtle" className="flex-1">Close</Button>
          <Button href="/login" accent={color} className="flex-1">Sign Up to Save</Button>
        </>
      }
    >
      {/* Session type */}
      <div className="flex gap-2">
        {(['lift', 'run', 'hybrid'] as const).map(t => (
          <button key={t} onClick={() => setSessionType(t)}
            className="flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all"
            style={{
              background: sessionType === t ? `${typeColors[t]}20` : '#1E1E1E',
              color: sessionType === t ? typeColors[t] : SUBTLE,
              border: `1px solid ${sessionType === t ? typeColors[t] + '44' : '#2E2E2E'}`,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
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
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#00BFA5', fontFamily: 'var(--font-heading)' }}>Lift Block</span>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ background: '#1E1E1E', border: '1px solid #2E2E2E' }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid #2E2E2E' }}>
              <p className="text-sm font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>Back Squat</p>
            </div>
            <div className="p-3 space-y-1.5">
              <div className="grid grid-cols-4 gap-2 mb-1">
                {['Set', 'kg', 'Reps', 'RPE'].map(h => (
                  <div key={h} className="text-center text-xs" style={{ color: SUBTLE, fontFamily: 'var(--font-sans)' }}>{h}</div>
                ))}
              </div>
              {sets.map(s => (
                <div key={s.set} className="grid grid-cols-4 gap-2">
                  <div className="py-1.5 rounded text-xs text-center" style={{ background: '#2A2A2A', color: SUBTLE, fontFamily: 'var(--font-mono)' }}>{s.set}</div>
                  <div className="py-1.5 rounded text-xs text-center" style={{ background: '#2A2A2A', color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>{s.weight}</div>
                  <div className="py-1.5 rounded text-xs text-center" style={{ background: '#2A2A2A', color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>{s.reps}</div>
                  <div className="py-1.5 rounded text-xs text-center" style={{ background: '#2A2A2A', color: '#A0A0A0', fontFamily: 'var(--font-mono)' }}>{s.rpe}</div>
                </div>
              ))}
            </div>
          </div>
          <button className="flex items-center gap-1.5 mt-2 text-xs transition-colors hover:text-white" style={{ background: 'none', border: 'none', color: SUBTLE, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            <Plus size={12} /> Add Exercise
          </button>
        </div>
      )}

      {/* Run block */}
      {(sessionType === 'run' || sessionType === 'hybrid') && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Footprints size={13} style={{ color: '#C8102E' }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#C8102E', fontFamily: 'var(--font-heading)' }}>Run Block</span>
          </div>
          <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: '#1E1E1E', border: '1px solid #2E2E2E' }}>
            <div>
              <p className="text-sm font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>Easy Run</p>
              <p className="text-xs mt-0.5" style={{ color: SUBTLE }}>Zone 2 · 5:30/km</p>
            </div>
            <p className="text-lg font-bold" style={{ color: '#C8102E', fontFamily: 'var(--font-mono)' }}>8 km</p>
          </div>
        </div>
      )}

      <SignupNote>
        <Link href="/login" style={{ color: '#00BFA5', fontWeight: 700 }}>Sign up</Link> to save your sessions and track progress over time
      </SignupNote>
    </Modal>
  )
}

// ── Analytics Modal ────────────────────────────────────────────────────────────
function AnalyticsModal({ onClose }: { onClose: () => void }) {
  const stats = [
    { label: 'Total Sessions', value: '84', accent: '#A78BFA' },
    { label: 'Total Km Run', value: '612', accent: '#C8102E' },
    { label: 'PRs Set', value: '23', accent: '#00BFA5' },
    { label: 'Avg Weekly Vol', value: '14.2t', accent: '#F5F5F5' },
  ]

  return (
    <Modal
      onClose={onClose}
      eyebrow="Progress Preview"
      title="Hybrid Dashboard"
      maxWidth={620}
      footer={
        <Button href="/login" fullWidth><BarChart2 size={15} /> Sign Up to Track Your Data</Button>
      }
    >
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <StatTile key={s.label} value={s.value} label={s.label} accent={s.accent} size="lg" />
        ))}
      </div>

      {/* Interference chart */}
      <div className="rounded-xl p-5" style={{ background: '#1E1E1E', border: '1px solid #2E2E2E' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: SUBTLE }}>12-Week Trend</p>
            <p className="text-base font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>Interference Analysis</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded" style={{ background: '#00BFA5' }} />
              <span className="text-xs" style={{ color: SUBTLE }}>Squat 1RM</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm" style={{ background: '#C8102E', opacity: 0.5 }} />
              <span className="text-xs" style={{ color: SUBTLE }}>Weekly Km</span>
            </div>
          </div>
        </div>

        <InterferenceChart />

        <div className="rounded-lg px-4 py-3 flex items-start gap-3 mt-4"
          style={{ background: 'rgba(200,16,46,0.08)', border: '1px solid rgba(200,16,46,0.25)' }}>
          <TrendingUp size={15} style={{ color: '#C8102E', flexShrink: 0, marginTop: 2 }} />
          <p className="text-sm leading-relaxed" style={{ color: '#A0A0A0', fontFamily: 'var(--font-sans)' }}>
            <span style={{ color: '#C8102E', fontWeight: 600 }}>Interference Detected (W7–9):</span> Squat stalled while weekly km peaked at 61 km. Sign up to unlock your personal analysis.
          </p>
        </div>
      </div>

      <SignupNote>
        <Link href="/login" style={{ color: '#00BFA5', fontWeight: 700 }}>Sign up</Link> to track your own data and see your interference patterns
      </SignupNote>
    </Modal>
  )
}

// ── Programme Modal ────────────────────────────────────────────────────────────
function ProgrammeModal({ programme, onClose }: { programme: Programme; onClose: () => void }) {
  const goalColors: Record<string, string> = { strength: '#00BFA5', endurance: '#C8102E', hybrid: '#A78BFA', 'strength-bias': '#00BFA5', 'endurance-bias': '#C8102E' }
  const color = goalColors[programme.goalBias] || '#A0A0A0'
  const { user } = useAuth()
  const router = useRouter()
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')
  const plan = BUILTIN_PLANS[programme.id]

  async function handleStart() {
    if (!plan || starting) return
    setStarting(true)
    setStartError('')
    try {
      const prog = expandPlanToProgramme(plan)
      await upsertProgramme(prog.id, prog)
      await upsertSetting('current_programme_id', prog.id)
      router.push('/programmes')
    } catch (e) {
      setStartError(e instanceof Error ? e.message : 'Could not start programme')
      setStarting(false)
    }
  }

  return (
    <Modal
      onClose={onClose}
      eyebrow={programme.goalBias.replace('-', ' ')}
      eyebrowColor={color}
      title={programme.name}
      maxWidth={540}
      headerExtra={
        <p className="text-sm mt-1" style={{ color: '#A0A0A0', fontFamily: 'var(--font-sans)' }}>{programme.description}</p>
      }
      footer={
        <>
          <Button onClick={onClose} variant="subtle" className="flex-1">Back</Button>
          {user && plan ? (
            <Button onClick={handleStart} disabled={starting} accent={color} className="flex-1">
              {starting ? 'Starting…' : 'Start This Programme'}
            </Button>
          ) : (
            <Button href="/login" accent={color} className="flex-1">Sign Up to Start</Button>
          )}
        </>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile value={`${programme.durationWeeks}wk`} label="Duration" accent={color} />
        <StatTile value={`${programme.liftDays}/wk`} label="Lift Days" accent={color} />
        <StatTile value={programme.level} label="Level" accent={color} />
      </div>

      {/* Week preview */}
      <div>
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: SUBTLE, fontFamily: 'var(--font-sans)' }}>Sample Week</p>
        <WeekPreview days={programme.weekPreview} />
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {programme.tags.map(tag => (
          <span key={tag} className="px-2.5 py-1 rounded text-xs" style={{ background: '#1E1E1E', color: SUBTLE, border: '1px solid #2E2E2E' }}>
            {tag}
          </span>
        ))}
      </div>

      {/* Start note */}
      <SignupNote>
        {user
          ? 'Starting adds the full week-by-week plan to your programmes, with progression and deloads built in. You can edit every session afterwards.'
          : <><Link href="/login" style={{ color: '#00BFA5', fontWeight: 700 }}>Sign up</Link> to start this programme and track your progress week by week</>}
        {startError && <span className="block text-xs mt-2" style={{ color: '#C8102E' }}>{startError}</span>}
      </SignupNote>
    </Modal>
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
    <Modal
      onClose={onClose}
      eyebrow="Programme Builder"
      title="Weekly Schedule"
      footer={
        <Button href="/login" fullWidth><Zap size={15} /> Sign Up to Save Your Schedule</Button>
      }
    >
      <p className="text-xs" style={{ color: SUBTLE, fontFamily: 'var(--font-sans)' }}>Tap a day to cycle through session types</p>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, i) => {
          const type = schedule[i]
          const color = sessionColors[type]
          return (
            <button key={day} onClick={() => cycle(i)}
              aria-label={`${day}: ${type}. Activate to change`}
              className="flex flex-col items-center gap-2 py-3 rounded-xl transition-all hover:opacity-85 active:opacity-70"
              style={{
                background: `${color}18`,
                border: `1px solid ${color}44`,
                cursor: 'pointer',
              }}>
              <span className="text-xs font-bold" style={{ color: SUBTLE, fontFamily: 'var(--font-sans)' }}>{day}</span>
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-xs font-bold" style={{ color, fontFamily: 'var(--font-sans)', fontSize: '9px' }}>{type.toUpperCase()}</span>
            </button>
          )
        })}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile value={liftCount} label="Lift days" accent="#00BFA5" size="lg" />
        <StatTile value={runCount} label="Run days" accent="#C8102E" size="lg" />
        <StatTile value={schedule.filter(s => s === 'Rest').length} label="Rest days" accent="#3E3E3E" size="lg" />
      </div>

      <SignupNote>
        <Link href="/login" style={{ color: '#00BFA5', fontWeight: 700 }}>Sign up</Link> to save your schedule and build a full programme with exercises and targets
      </SignupNote>
    </Modal>
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
        {/* Diagonal split: teal (lift) left, crimson (run) right */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(105deg, rgba(0,191,165,0.07) 0%, transparent 45%, transparent 55%, rgba(200,16,46,0.07) 100%)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none hero-glow"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 20% 50%, rgba(0,191,165,0.08) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 50%, rgba(200,16,46,0.08) 0%, transparent 60%)',
          }}
        />
        {/* Diagonal seam */}
        <div
          className="absolute pointer-events-none hidden lg:block"
          style={{
            top: '-10%', bottom: '-10%', left: '58%', width: '1px',
            background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.06) 70%, transparent)',
            transform: 'rotate(15deg)',
          }}
        />
        {/* Heartbeat trace along the hero bottom — draws itself in */}
        <div className="absolute bottom-10 left-0 right-0 pointer-events-none chart-animate" aria-hidden="true">
          <svg viewBox="0 0 1200 60" className="w-full h-auto" preserveAspectRatio="none" style={{ opacity: 0.35 }}>
            <path
              className="chart-line"
              d="M0 30 H320 l14-18 18 34 16-26 12 10 H560 l12-16 16 30 14-22 10 8 H860 l14-20 18 36 14-26 12 10 H1200"
              fill="none" stroke="#00BFA5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ strokeDasharray: 1400, strokeDashoffset: 1400, animationDuration: '2.4s' }}
            />
          </svg>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
          <div className="max-w-4xl">
            <Reveal>
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
                style={{ background: 'rgba(0,191,165,0.08)', border: '1px solid rgba(0,191,165,0.2)' }}
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#00BFA5' }} />
                <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: '#00BFA5', fontFamily: 'var(--font-sans)' }}>
                  Built for Hybrid Athletes
                </span>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <h1
                className="leading-none font-black uppercase mb-6"
                style={{
                  fontFamily: 'var(--font-heading)',
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
            </Reveal>

            <Reveal delay={200}>
              <p
                className="text-xl mb-10 max-w-2xl leading-relaxed"
                style={{ color: '#A0A0A0', fontFamily: 'var(--font-sans)' }}
              >
                The platform built for hybrid athletes. Log both. Track both. Peak at both.
              </p>
            </Reveal>

            <Reveal delay={300}>
              <div className="flex flex-wrap gap-3">
                <Button href="/login" size="lg">
                  Get Started Free
                  <ArrowRight size={18} />
                </Button>
                <Button href="/programmes" variant="ghost" accent="#C8102E" size="lg">
                  Browse Programmes
                </Button>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* PHILOSOPHY STRIP */}
      <section className="py-24" style={{ borderTop: '1px solid #1A1A1A' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal>
            <SectionHeading
              align="center"
              title="Train Both. Peak Together."
              sub="Concurrent training interference is real — but manageable. Smart programming means you never have to choose."
              className="mb-14"
            />
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Dumbbell,
                title: 'Strength',
                desc: 'Build a solid barbell foundation. Track 1RMs, volume, and progressive overload with tools built for strength athletes.',
                accent: '#00BFA5',
              },
              {
                icon: Footprints,
                title: 'Endurance',
                desc: 'From 5K to ultra. Track paces, mileage, and run segments alongside your lifting — all in one dashboard.',
                accent: '#C8102E',
              },
              {
                icon: Heart,
                title: 'Recovery',
                desc: 'Interference happens when programming ignores recovery. Our analytics flag the exact weeks where running volume hurt your strength gains.',
                accent: '#F5F5F5',
              },
              {
                icon: Sparkles,
                title: 'AI Coach',
                desc: 'Generate expert hybrid programmes in seconds. Get personalised coaching reviews with Analysis and Recommendations — then let AI revamp your plan.',
                accent: '#A78BFA',
              },
            ].map(({ icon: Icon, title, desc, accent }, i) => (
              <Reveal key={title} delay={i * 90}>
              <Card tint={accent} padding="lg" className="flex flex-col gap-4 h-full">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: `${accent}18` }}
                >
                  <Icon size={24} style={{ color: accent }} />
                </div>
                <h3
                  className="text-2xl font-black uppercase"
                  style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}
                >
                  {title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: '#A0A0A0', fontFamily: 'var(--font-sans)' }}>
                  {desc}
                </p>
              </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PROGRAMME SHOWCASE */}
      <section className="py-24" style={{ background: '#0A0A0A', borderTop: '1px solid #1A1A1A' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
              <SectionHeading eyebrow="Programming" title="Featured Programmes" className="[&>h2]:mb-0" />
              <Link
                href="/programmes"
                className="flex items-center gap-1.5 text-sm font-semibold transition-colors hover:text-white"
                style={{ color: '#A0A0A0', fontFamily: 'var(--font-sans)' }}
              >
                View all <ArrowRight size={14} />
              </Link>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {programmes.slice(0, 3).map((p, i) => (
              <Reveal key={p.id} delay={i * 90} className="h-full [&>div]:h-full">
                <ProgrammeCard programme={p} onStart={() => openProgramme(p)} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* AI FEATURES */}
      <section className="py-24" style={{ borderTop: '1px solid #1A1A1A' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal>
            <SectionHeading
              align="center"
              eyebrow="AI Coaching"
              eyebrowColor="#A78BFA"
              title={<>Your AI Coach.<br />Always On.</>}
              sub="Generate expert hybrid programmes in seconds. Get personalised coaching reviews. Let AI rebuild your programme based on its own recommendations."
              className="mb-14"
            />
          </Reveal>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* AI Programme Generator card */}
            <Reveal className="h-full [&>div]:h-full">
            <div className="rounded-2xl overflow-hidden flex flex-col card-depth" style={{ background: '#0F0F1A', border: '1px solid rgba(167,139,250,0.2)' }}>
              <div className="px-6 py-5" style={{ borderBottom: '1px solid #1E1E2E' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={14} style={{ color: '#A78BFA' }} />
                  <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#A78BFA', fontFamily: 'var(--font-sans)' }}>AI Programme Generator</span>
                </div>
                <h3 className="text-xl font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>Full Programme in Seconds</h3>
                <p className="text-sm mt-1" style={{ color: SUBTLE, fontFamily: 'var(--font-sans)' }}>Tell the AI your goals, schedule, and current lifts. It builds a complete multi-week hybrid programme with progressive overload built in.</p>
              </div>
              <div className="px-6 py-5 space-y-3 flex-1">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs" style={{ color: SUBTLE, fontFamily: 'var(--font-sans)' }}>Building your programme...</span>
                    <span className="text-xs font-bold" style={{ color: '#A78BFA', fontFamily: 'var(--font-mono)' }}>78%</span>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: '#1A1527', borderRadius: '2px' }}>
                    <div style={{ height: '100%', width: '78%', background: 'linear-gradient(90deg, #A78BFA, #C4B5FD)', borderRadius: '2px' }} />
                  </div>
                </div>
                {[
                  { day: 'MON', label: 'Lower Strength', items: 'Back Squat · Romanian Deadlift · Leg Press', color: '#00BFA5' },
                  { day: 'TUE', label: 'Easy Run', items: '10 km @ Zone 2 · 5:30/km pace', color: '#C8102E' },
                  { day: 'THU', label: 'Upper Strength', items: 'Bench Press · Bent-over Row · OHP', color: '#00BFA5' },
                  { day: 'SAT', label: 'Long Run', items: '18 km · Progressive · Tempo finish', color: '#C8102E' },
                ].map(({ day, label, items, color }) => (
                  <div key={day} className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: '#1A1527', border: '1px solid #2A2040' }}>
                    <span className="text-xs font-black w-8 shrink-0 mt-0.5" style={{ color: SUBTLE, fontFamily: 'var(--font-mono)' }}>{day}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black uppercase" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>{label}</p>
                      <p className="text-xs mt-0.5" style={{ color: SUBTLE, fontFamily: 'var(--font-sans)' }}>{items}</p>
                    </div>
                    <div className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: color }} />
                  </div>
                ))}
              </div>
            </div>
            </Reveal>

            {/* AI Coach Review card */}
            <Reveal delay={90} className="h-full [&>div]:h-full">
            <div className="rounded-2xl overflow-hidden flex flex-col card-depth" style={{ background: '#0F0F1A', border: '1px solid rgba(167,139,250,0.2)' }}>
              <div className="px-6 py-5" style={{ borderBottom: '1px solid #1E1E2E' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Brain size={14} style={{ color: '#A78BFA' }} />
                  <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#A78BFA', fontFamily: 'var(--font-sans)' }}>AI Coach Review</span>
                </div>
                <h3 className="text-xl font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>Expert Analysis on Demand</h3>
                <p className="text-sm mt-1" style={{ color: SUBTLE, fontFamily: 'var(--font-sans)' }}>Submit any programme for a full AI coaching review covering strength, running, concurrent training, periodisation, and recovery.</p>
              </div>
              <div className="px-6 py-5 flex-1 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4 flex-1">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: SUBTLE, fontFamily: 'var(--font-heading)' }}>Analysis</p>
                    {[
                      'Squat 3×/wk may limit run adaptation on high mileage weeks',
                      'No deload scheduled across 8 weeks',
                      'Saturday long run follows heavy Friday lower session',
                    ].map((t, i) => (
                      <div key={i} className="flex items-start gap-2 mb-2.5">
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: SUBTLE }} />
                        <p className="text-xs leading-relaxed" style={{ color: '#A0A0A0', fontFamily: 'var(--font-sans)' }}>{t}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#C084FC', fontFamily: 'var(--font-heading)' }}>Recommendations</p>
                    {[
                      'Reduce to 2 squat sessions/wk — swap one for RDL-focused lower',
                      'Insert deload at week 4 and week 8',
                      'Move long run to Sunday for full recovery buffer',
                    ].map((t, i) => (
                      <div key={i} className="flex items-start gap-2 mb-2.5">
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: '#C084FC' }} />
                        <p className="text-xs leading-relaxed" style={{ color: '#A0A0A0', fontFamily: 'var(--font-sans)' }}>{t}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
                  <div className="flex items-center gap-2">
                    <Zap size={13} style={{ color: '#A78BFA' }} />
                    <span className="text-sm font-bold" style={{ color: '#A78BFA', fontFamily: 'var(--font-sans)' }}>Revamp Programme</span>
                  </div>
                  <span className="text-xs" style={{ color: SUBTLE, fontFamily: 'var(--font-sans)' }}>AI applies all recommendations →</span>
                </div>
              </div>
            </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* LOGGER PREVIEW */}
      <section className="py-24" style={{ borderTop: '1px solid #1A1A1A' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <Reveal>
            <div>
              <SectionHeading
                eyebrow="Session Logging"
                eyebrowColor="#C8102E"
                title={<>Log Both.<br />In One Place.</>}
              />
              <p className="text-base leading-relaxed mb-6" style={{ color: '#A0A0A0', fontFamily: 'var(--font-sans)' }}>
                The only logger that understands hybrid sessions. Log your squat PR and your easy run in the same session. Track interference. See patterns.
              </p>
              <Button onClick={() => setModal('logger')} accent="#C8102E">
                <span className="inline-flex items-center gap-2" style={{ color: '#F5F5F5' }}>Open Logger <ArrowRight size={16} /></span>
              </Button>
            </div>
            </Reveal>

            {/* Mock log card */}
            <Reveal delay={120}>
            <div
              className="rounded-2xl overflow-hidden card-depth"
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
                    style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}
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
                  <span className="text-xs uppercase font-bold tracking-wider" style={{ color: '#00BFA5', fontFamily: 'var(--font-heading)' }}>
                    Lift Block
                  </span>
                </div>
                <div
                  className="rounded-lg px-4 py-3"
                  style={{ background: '#242424', border: '1px solid #2E2E2E' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)', fontSize: '16px' }}>
                      BACK SQUAT
                    </span>
                    <span className="text-xs" style={{ color: '#00BFA5', fontFamily: 'var(--font-mono)' }}>
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
                        <div className="py-1 rounded text-xs text-center" style={{ background: '#1A1A1A', color: SUBTLE, fontFamily: 'var(--font-mono)' }}>{s.set}</div>
                        <div className="py-1 rounded text-xs text-center" style={{ background: '#1A1A1A', color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>{s.weight}kg</div>
                        <div className="py-1 rounded text-xs text-center" style={{ background: '#1A1A1A', color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>{s.reps}</div>
                        <div className="py-1 rounded text-xs text-center" style={{ background: '#1A1A1A', color: '#A0A0A0', fontFamily: 'var(--font-mono)' }}>RPE {s.rpe}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Footprints size={14} style={{ color: '#C8102E' }} />
                  <span className="text-xs uppercase font-bold tracking-wider" style={{ color: '#C8102E', fontFamily: 'var(--font-heading)' }}>
                    Run Block
                  </span>
                </div>
                <div
                  className="rounded-lg px-4 py-3 flex items-center justify-between"
                  style={{ background: '#242424', border: '1px solid #2E2E2E' }}
                >
                  <div>
                    <p className="font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)', fontSize: '16px' }}>
                      EASY RUN
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#A0A0A0' }}>Zone 2 aerobic</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold" style={{ color: '#C8102E', fontFamily: 'var(--font-mono)' }}>10 km</p>
                    <p className="text-xs" style={{ color: SUBTLE, fontFamily: 'var(--font-mono)' }}>@ 5:33/km</p>
                  </div>
                </div>
              </div>
            </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ANALYTICS TEASER */}
      <section className="py-24" style={{ background: '#0A0A0A', borderTop: '1px solid #1A1A1A' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <Reveal>
            <div
              className="rounded-2xl p-6 card-depth"
              style={{
                background: 'linear-gradient(135deg, rgba(0,191,165,0.04) 0%, rgba(200,16,46,0.04) 100%)',
                border: '1px solid #2E2E2E',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-wider" style={{ color: SUBTLE }}>Hybrid Progress</p>
                  <h3
                    className="text-xl font-black uppercase"
                    style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}
                  >
                    Interference Trend
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 rounded" style={{ background: '#00BFA5' }} />
                    <span className="text-xs" style={{ color: SUBTLE }}>Squat 1RM</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-2 rounded-sm" style={{ background: '#C8102E', opacity: 0.5 }} />
                    <span className="text-xs" style={{ color: SUBTLE }}>Weekly Km</span>
                  </div>
                </div>
              </div>

              <InterferenceChart className="mb-3" />

              <div
                className="rounded-lg px-4 py-3 flex items-start gap-3"
                style={{ background: 'rgba(200,16,46,0.1)', border: '1px solid rgba(200,16,46,0.3)' }}
              >
                <TrendingUp size={16} style={{ color: '#C8102E', flexShrink: 0, marginTop: 2 }} />
                <p className="text-sm leading-relaxed" style={{ color: '#A0A0A0', fontFamily: 'var(--font-sans)' }}>
                  <span style={{ color: '#C8102E', fontWeight: 600 }}>Interference Detected (W7-9):</span> Squat stalled while km peaked at 61 km/wk.
                </p>
              </div>
            </div>
            </Reveal>

            <Reveal delay={120}>
            <div>
              <SectionHeading eyebrow="Progress" title={<>Know Your<br />Training.</>} />
              <p className="text-base leading-relaxed mb-6" style={{ color: '#A0A0A0', fontFamily: 'var(--font-sans)' }}>
                Track every session on a visual calendar heatmap. See Push/Pull/Legs and body part breakdowns from your actual training history. Overlay strength trends with running volume to reveal the exact weeks where interference hit your gains.
              </p>
              <Button onClick={() => setModal('analytics')} variant="subtle">
                <BarChart2 size={16} />
                View Progress
              </Button>
            </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <section
        className="py-20"
        style={{
          background: 'linear-gradient(135deg, rgba(0,191,165,0.08) 0%, rgba(200,16,46,0.08) 100%)',
          borderTop: '1px solid rgba(0,191,165,0.15)',
        }}
      >
        <Reveal>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="section-title section-title-lg mb-4">
            Ready to Train Like<br />a <span style={{ color: '#00BFA5' }}>Hybrid Athlete?</span>
          </h2>
          <p className="text-lg mb-8" style={{ color: '#A0A0A0', fontFamily: 'var(--font-sans)' }}>
            Log sessions. Track both disciplines. Generate AI programmes. Get coached. Peak at both.
          </p>
          <Button onClick={() => setModal('builder')} size="lg">
            <Zap size={18} />
            Start Building Your Schedule
          </Button>
        </div>
        </Reveal>
      </section>
    </div>
  )
}
