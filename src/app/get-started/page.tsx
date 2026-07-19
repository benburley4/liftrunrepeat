'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Compass, BookOpen, ArrowRight, Sparkles, Check } from 'lucide-react'
import { programmes, Programme } from '@/lib/exerciseLibrary'
import ProgrammeCard from '@/components/ui/ProgrammeCard'
import { useAuth } from '@/context/AuthContext'
import { BUILTIN_PLANS, expandPlanToProgramme } from '@/lib/builtinProgrammes'
import { upsertProgramme, upsertSetting } from '@/lib/db'
import { AthleteProfile, loadProfile } from '@/lib/athleteProfile'

// ─── Profile completeness ─────────────────────────────────────────────────────

const PROFILE_SECTIONS: { label: string; isComplete: (p: AthleteProfile) => boolean }[] = [
  { label: 'About you', isComplete: p => !!((p.dob || p.age) && p.bodyweightKg) },
  { label: '1RMs', isComplete: p => !!(p.squat1RM || p.bench1RM || p.deadlift1RM || p.ohp1RM) },
  { label: 'Race PBs', isComplete: p => !!(p.best5k || p.best10k || p.bestHalf || p.bestMarathon) },
  { label: 'Goal race', isComplete: p => !!p.raceDistance },
  { label: 'Injuries & context', isComplete: p => !!(p.injuries || p.notes) },
]

// ─── Quiz definition ──────────────────────────────────────────────────────────

type Experience = 'new' | 'some' | 'experienced'
type Goal = 'strength' | 'balanced' | 'endurance'
type Days = '3' | '4-5' | '6-7'

interface Answers {
  experience?: Experience
  goal?: Goal
  days?: Days
  race?: 'none' | '5k-10k' | 'half-full'
}

function recommend(a: Answers): Programme {
  const byId = (id: string) => programmes.find(p => p.id === id)!
  if (a.experience === 'new') {
    return a.days === '3' ? byId('couch-to-hybrid') : byId('hybrid-beginner')
  }
  if (a.goal === 'strength') return byId('531-easy-miles')
  if (a.experience === 'experienced' && a.days === '6-7' && a.race === 'half-full') return byId('concurrent-peaking')
  if (a.goal === 'endurance' || a.race === 'half-full') return byId('running-priority')
  if (a.experience === 'experienced' && a.days === '6-7') return byId('powerbuilding-tempo')
  return byId('hybrid-beginner')
}

const QUESTIONS: { key: keyof Answers; question: string; options: { value: string; label: string }[] }[] = [
  {
    key: 'experience',
    question: 'How much training experience do you have?',
    options: [
      { value: 'new', label: 'Brand new — starting from scratch' },
      { value: 'some', label: 'Some — I lift or run, but not both consistently' },
      { value: 'experienced', label: 'Experienced — years of consistent training' },
    ],
  },
  {
    key: 'goal',
    question: 'What matters most to you right now?',
    options: [
      { value: 'strength', label: 'Getting stronger — running is a bonus' },
      { value: 'balanced', label: 'Both equally — the true hybrid' },
      { value: 'endurance', label: 'Running faster/further — lifting to stay strong' },
    ],
  },
  {
    key: 'days',
    question: 'How many days a week can you train?',
    options: [
      { value: '3', label: '3 days' },
      { value: '4-5', label: '4–5 days' },
      { value: '6-7', label: '6–7 days' },
    ],
  },
  {
    key: 'race',
    question: 'Do you have a race in mind?',
    options: [
      { value: 'none', label: 'No race — general fitness' },
      { value: '5k-10k', label: '5K or 10K' },
      { value: 'half-full', label: 'Half or full marathon' },
    ],
  },
]

// ─── Glossary ─────────────────────────────────────────────────────────────────

const GLOSSARY: { term: string; def: string }[] = [
  { term: 'RPE', def: 'Rate of Perceived Exertion, 1–10. RPE 7 means you could do about 3 more reps; RPE 9 means 1 rep left in the tank. Programmes here set a target RPE per session.' },
  { term: 'Zone 2 / Easy pace', def: 'A pace where you can hold a conversation. It feels too slow — that\'s the point. Around 80% of your running should be here; it builds the aerobic engine.' },
  { term: 'Tempo / Threshold', def: '"Comfortably hard" — a pace you could hold for about an hour flat out. Raises the speed you can sustain without blowing up.' },
  { term: 'Intervals / VO2max', def: 'Short hard efforts (3–5 min) at 5K pace or faster with recoveries. Develops top-end aerobic capacity. Hard sessions — never on consecutive days.' },
  { term: 'Deload', def: 'A planned easier week (roughly 70% of normal volume) every 4th week. You don\'t get fitter during training — you get fitter recovering from it.' },
  { term: '1RM', def: 'One-rep max: the heaviest weight you can lift once. Working weights are usually set as a percentage of it (e.g. 5 reps at 75%).' },
  { term: 'Progressive overload', def: 'Adding a little weight, a rep, or a few minutes each week. The engine of all progress — programmes here add it automatically week to week.' },
  { term: 'Interference effect', def: 'Hard running blunts strength gains (and vice versa) when scheduled carelessly. Fix: keep hard days hard and easy days easy, and separate heavy legs from hard runs.' },
  { term: 'Compound movements', def: 'Multi-joint lifts — squat, deadlift, bench, row, overhead press. The backbone of every strength plan; isolation work is dessert, not dinner.' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GetStartedPage() {
  const [answers, setAnswers] = useState<Answers>({})
  const [step, setStep] = useState(0)
  const { user } = useAuth()
  const router = useRouter()
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')
  const [profile, setProfile] = useState<AthleteProfile | null>(null)

  useEffect(() => {
    if (!user) return
    loadProfile().then(setProfile).catch(() => {})
  }, [user])

  const sectionsComplete = profile ? PROFILE_SECTIONS.filter(s => s.isComplete(profile)).length : 0
  const profileComplete = sectionsComplete === PROFILE_SECTIONS.length

  const done = step >= QUESTIONS.length
  const recommendation = done ? recommend(answers) : null

  function answer(key: keyof Answers, value: string) {
    setAnswers(prev => ({ ...prev, [key]: value as never }))
    setStep(s => s + 1)
  }

  async function handleStart() {
    if (!recommendation || starting) return
    const plan = BUILTIN_PLANS[recommendation.id]
    if (!plan) return
    setStarting(true)
    setStartError('')
    try {
      const prog = expandPlanToProgramme(plan)
      await upsertProgramme(prog.id, prog)
      await upsertSetting('current_programme_id', prog.id)
      await upsertSetting('onboarding_done', 'true').catch(() => {})
      router.push('/programmes')
    } catch (e) {
      setStartError(e instanceof Error ? e.message : 'Could not start programme')
      setStarting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D0D', padding: '96px 16px 48px' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        {/* Athlete Profile CTA — top of page, signed-in users only */}
        {user && (
          <div style={{ borderRadius: '20px', background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.25)', padding: '24px 28px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(167,139,250,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Sparkles size={18} style={{ color: '#A78BFA' }} />
              </div>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#F5F5F5', fontFamily: 'var(--font-heading)', textTransform: 'uppercase', margin: '0 0 4px' }}>
                  {profileComplete ? 'Athlete Profile complete' : 'Complete your Athlete Profile'}
                </h3>
                <p style={{ fontSize: '13px', color: '#A0A0A0', lineHeight: 1.5, fontFamily: 'var(--font-sans)', margin: '0 0 12px' }}>
                  {profileComplete
                    ? 'Your AI coach knows your lifts, race PBs, and goals. Keep it updated as they change.'
                    : 'Your AI coach tailors every programme, review, and weekly report to your profile — 1RMs, race PBs, goal race, and injuries all shape what it prescribes.'}
                </p>

                {/* Section progress */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                  {PROFILE_SECTIONS.map(s => {
                    const filled = profile ? s.isComplete(profile) : false
                    return (
                      <span key={s.label} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-sans)',
                        background: filled ? 'rgba(0,191,165,0.1)' : '#1E1E1E',
                        color: filled ? '#00BFA5' : '#606060',
                        border: filled ? '1px solid rgba(0,191,165,0.3)' : '1px solid #2E2E2E',
                      }}>
                        {filled && <Check size={10} />}
                        {s.label}
                      </span>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  <Link href="/profile"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px', background: profileComplete ? 'transparent' : '#A78BFA', color: profileComplete ? '#A78BFA' : '#0D0D0D', fontWeight: 800, fontSize: '13px', fontFamily: 'var(--font-sans)', textDecoration: 'none', border: profileComplete ? '1px solid rgba(167,139,250,0.4)' : 'none' }}>
                    {profileComplete ? 'Edit Profile' : 'Complete Profile'} <ArrowRight size={14} />
                  </Link>
                  {!profileComplete && (
                    <span style={{ fontSize: '12px', color: '#8A8A8A', fontFamily: 'var(--font-sans)' }}>
                      {sectionsComplete} of {PROFILE_SECTIONS.length} sections complete
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quiz */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <Compass size={20} style={{ color: '#00BFA5' }} />
          <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#F5F5F5', fontFamily: 'var(--font-heading)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
            Get Started
          </h1>
        </div>
        <p style={{ color: '#A0A0A0', fontSize: '14px', fontFamily: 'var(--font-sans)', marginBottom: '28px' }}>
          Four quick questions and we&apos;ll point you at the right programme. New to the jargon? The glossary below explains every term you&apos;ll meet.
        </p>

        <div style={{ borderRadius: '20px', background: '#141414', border: '1px solid #2E2E2E', padding: '28px', marginBottom: '32px' }}>
          {!done ? (
            <>
              <p style={{ fontSize: '11px', color: '#606060', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-sans)', marginBottom: '10px' }}>
                Question {step + 1} of {QUESTIONS.length}
              </p>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#F5F5F5', fontFamily: 'var(--font-heading)', marginBottom: '20px' }}>
                {QUESTIONS[step].question}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {QUESTIONS[step].options.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => answer(QUESTIONS[step].key, opt.value)}
                    style={{
                      textAlign: 'left', padding: '14px 18px', borderRadius: '12px',
                      background: '#1E1E1E', border: '1px solid #2E2E2E',
                      color: '#F5F5F5', fontSize: '14px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#00BFA5'; e.currentTarget.style.background = 'rgba(0,191,165,0.06)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#2E2E2E'; e.currentTarget.style.background = '#1E1E1E' }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {step > 0 && (
                <button onClick={() => setStep(s => s - 1)}
                  style={{ marginTop: '16px', background: 'none', border: 'none', color: '#606060', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  ← Back
                </button>
              )}
            </>
          ) : recommendation && (
            <>
              <p style={{ fontSize: '11px', color: '#00BFA5', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-sans)', marginBottom: '14px', fontWeight: 700 }}>
                Our recommendation for you
              </p>
              <ProgrammeCard programme={recommendation} onStart={user ? handleStart : undefined} />
              {startError && <p style={{ color: '#C8102E', fontSize: '13px', fontFamily: 'var(--font-sans)', marginTop: '12px' }}>{startError}</p>}
              <div style={{ display: 'flex', gap: '12px', marginTop: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
                {user ? (
                  <button onClick={handleStart} disabled={starting}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', background: starting ? '#1A1A1A' : '#00BFA5', color: starting ? '#606060' : '#0D0D0D', fontWeight: 800, fontSize: '14px', border: 'none', cursor: starting ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                    {starting ? 'Starting…' : 'Start This Programme'} <ArrowRight size={15} />
                  </button>
                ) : (
                  <Link href="/login"
                    style={{ padding: '12px 24px', borderRadius: '12px', background: '#00BFA5', color: '#0D0D0D', fontWeight: 800, fontSize: '14px', fontFamily: 'var(--font-sans)', textDecoration: 'none' }}>
                    Sign Up to Start
                  </Link>
                )}
                <button onClick={() => { setStep(0); setAnswers({}) }}
                  style={{ background: 'none', border: 'none', color: '#606060', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  Retake quiz
                </button>
                <Link href="/" style={{ color: '#606060', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
                  Browse all programmes
                </Link>
              </div>
            </>
          )}
        </div>
        {/* Glossary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <BookOpen size={18} style={{ color: '#A78BFA' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#F5F5F5', fontFamily: 'var(--font-heading)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
            Training Glossary
          </h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {GLOSSARY.map(g => (
            <div key={g.term} style={{ borderRadius: '14px', background: '#141414', border: '1px solid #2E2E2E', padding: '16px 20px' }}>
              <p style={{ fontSize: '13px', fontWeight: 800, color: '#00BFA5', fontFamily: 'var(--font-sans)', margin: '0 0 4px' }}>{g.term}</p>
              <p style={{ fontSize: '13px', color: '#A0A0A0', lineHeight: 1.6, fontFamily: 'var(--font-sans)', margin: 0 }}>{g.def}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
