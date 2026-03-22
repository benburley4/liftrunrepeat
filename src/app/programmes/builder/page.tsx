'use client'

import { useState } from 'react'
import { ChevronRight, Check, AlertTriangle, AlertCircle } from 'lucide-react'
import QuickLogFAB from '@/components/log/QuickLogFAB'
import { upsertProgramme } from '@/lib/db'

const liftSplits = [
  { id: 'upper-lower', name: 'Upper / Lower', days: '4-Day', schedule: ['Upper', 'Lower', 'Rest', 'Upper', 'Lower', 'Rest', 'Rest'], color: '#00BFA5' },
  { id: 'ppl', name: 'Push / Pull / Legs', days: '6-Day', schedule: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', 'Rest'], color: '#00BFA5' },
  { id: 'full-body', name: 'Full Body 3×', days: '3-Day', schedule: ['Full', 'Rest', 'Full', 'Rest', 'Full', 'Rest', 'Rest'], color: '#00BFA5' },
  { id: '531', name: '5/3/1', days: '4-Day', schedule: ['Squat', 'Bench', 'Rest', 'Dead', 'OHP', 'Rest', 'Rest'], color: '#00BFA5' },
  { id: 'custom', name: 'Custom', days: 'Flexible', schedule: ['?', '?', '?', '?', '?', '?', '?'], color: '#A0A0A0' },
]

const runStructures = [
  { id: '3x-easy', name: '3× Easy', label: 'Base Building', schedule: ['Easy', null, 'Easy', null, 'Easy', null, null], color: '#C8102E' },
  { id: '2easy-1tempo', name: '2× Easy + 1 Tempo', label: 'Threshold Focus', schedule: ['Easy', null, 'Tempo', null, 'Easy', null, null], color: '#C8102E' },
  { id: '4x-mixed', name: '4× Mixed', label: 'Balanced', schedule: ['Easy', null, 'Tempo', 'Easy', null, 'Long', null], color: '#C8102E' },
  { id: 'marathon-base', name: 'Marathon Base', label: 'Race Prep', schedule: ['Easy', 'Easy', 'Tempo', 'Easy', 'Rest', 'Long', 'Easy'], color: '#C8102E' },
]

const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type ConflictLevel = 'ok' | 'risky' | 'conflict'

function getConflict(lift: string | null, run: string | null): ConflictLevel {
  if (!lift || !run) return 'ok'
  if ((lift === 'Legs' || lift === 'Lower' || lift === 'Squat' || lift === 'Dead') && (run === 'Long' || run === 'Tempo')) return 'conflict'
  if ((lift === 'Legs' || lift === 'Lower' || lift === 'Squat' || lift === 'Dead') && run === 'Easy') return 'risky'
  return 'ok'
}

const conflictColors: Record<ConflictLevel, string> = {
  ok: '#00BFA5',
  risky: '#F59E0B',
  conflict: '#EF4444',
}

const conflictIcons: Record<ConflictLevel, React.ReactNode> = {
  ok: <Check size={10} />,
  risky: <AlertTriangle size={10} />,
  conflict: <AlertCircle size={10} />,
}

export default function BuilderPage() {
  const [step, setStep] = useState(1)
  const [selectedLift, setSelectedLift] = useState<string | null>(null)
  const [selectedRun, setSelectedRun] = useState<string | null>(null)
  const [programmeName, setProgrammeName] = useState('')
  const [saved, setSaved] = useState(false)

  const liftSplit = liftSplits.find(s => s.id === selectedLift)
  const runStructure = runStructures.find(s => s.id === selectedRun)

  const conflicts = dayNames.map((_, i) => {
    const liftDay = liftSplit?.schedule[i] || null
    const runDay = runStructure?.schedule[i] || null
    const isLift = liftDay && liftDay !== 'Rest'
    const isRun = runDay && runDay !== null
    return getConflict(isLift ? liftDay : null, isRun ? runDay : null)
  })

  const handleSave = () => {
    const id = `builder-${Date.now()}`
    const programme = {
      id,
      name: programmeName || 'My Hybrid Programme',
      liftSplit: selectedLift,
      runStructure: selectedRun,
      savedAt: new Date().toISOString(),
    }
    upsertProgramme(id, programme).catch(console.error)
    setSaved(true)
  }

  const totalHours = (liftSplit ? liftSplits.findIndex(s => s.id === selectedLift) * 0.5 + 3.5 : 0)
    + (runStructure ? runStructures.findIndex(s => s.id === selectedRun) * 0.75 + 2.5 : 0)

  return (
    <div style={{ background: '#0D0D0D', minHeight: '100vh' }}>
      <QuickLogFAB />

      {/* Header */}
      <div className="pt-16 pb-8" style={{ background: '#0A0A0A', borderBottom: '1px solid #1A1A1A' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#00BFA5' }}>Programme Builder</p>
          <h1 className="text-5xl font-black uppercase mb-2" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
            Build Your Hybrid Plan
          </h1>

          {/* Step progress */}
          <div className="flex items-center gap-3 mt-6">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center gap-3">
                <button
                  onClick={() => s <= step && setStep(s)}
                  className="flex items-center gap-2"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                    style={{
                      background: step > s ? '#00BFA5' : step === s ? 'rgba(0,229,200,0.15)' : '#1A1A1A',
                      color: step > s ? '#0D0D0D' : step === s ? '#00BFA5' : '#606060',
                      border: step === s ? '2px solid #00BFA5' : '2px solid #2E2E2E',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    {step > s ? <Check size={14} /> : s}
                  </div>
                  <span
                    className="text-xs hidden sm:block"
                    style={{ color: step === s ? '#F5F5F5' : '#606060', fontFamily: 'Inter, sans-serif' }}
                  >
                    {['Lift Split', 'Run Structure', 'Conflict Check', 'Review & Save'][s - 1]}
                  </span>
                </button>
                {s < 4 && <ChevronRight size={14} style={{ color: '#2E2E2E' }} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">

        {/* STEP 1: LIFT SPLIT */}
        {step === 1 && (
          <div>
            <h2 className="text-3xl font-black uppercase mb-2" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
              Choose Your Lift Split
            </h2>
            <p className="text-sm mb-8" style={{ color: '#A0A0A0' }}>Select a training split that matches your schedule and goals.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {liftSplits.map(split => (
                <button
                  key={split.id}
                  onClick={() => setSelectedLift(split.id)}
                  className="text-left rounded-xl p-5 transition-all"
                  style={{
                    background: selectedLift === split.id ? 'rgba(0,229,200,0.08)' : '#1A1A1A',
                    border: selectedLift === split.id ? '2px solid #00BFA5' : '1px solid #2E2E2E',
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
                        {split.name}
                      </h3>
                      <span className="text-xs" style={{ color: '#00BFA5', fontFamily: 'JetBrains Mono, monospace' }}>
                        {split.days}
                      </span>
                    </div>
                    {selectedLift === split.id && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#00BFA5' }}>
                        <Check size={14} color="#0D0D0D" />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {split.schedule.map((day, i) => (
                      <div
                        key={i}
                        className="flex-1 py-1.5 rounded text-center"
                        style={{
                          background: day === 'Rest' ? '#242424' : 'rgba(0,229,200,0.12)',
                          fontSize: '8px',
                          color: day === 'Rest' ? '#606060' : '#00BFA5',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 700,
                        }}
                      >
                        {day === 'Rest' ? '·' : day.slice(0, 2).toUpperCase()}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {dayNames.map((d, i) => (
                      <div key={i} className="flex-1 text-center" style={{ fontSize: '8px', color: '#606060' }}>{d.slice(0,1)}</div>
                    ))}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={() => selectedLift && setStep(2)}
                className="px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-opacity"
                style={{
                  background: selectedLift ? '#00BFA5' : '#2E2E2E',
                  color: selectedLift ? '#0D0D0D' : '#606060',
                  fontFamily: 'Inter, sans-serif',
                  opacity: selectedLift ? 1 : 0.6,
                }}
              >
                Next: Run Structure <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: RUN STRUCTURE */}
        {step === 2 && (
          <div>
            <h2 className="text-3xl font-black uppercase mb-2" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
              Choose Run Structure
            </h2>
            <p className="text-sm mb-8" style={{ color: '#A0A0A0' }}>How many runs per week and what types?</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {runStructures.map(run => (
                <button
                  key={run.id}
                  onClick={() => setSelectedRun(run.id)}
                  className="text-left rounded-xl p-5 transition-all"
                  style={{
                    background: selectedRun === run.id ? 'rgba(255,107,53,0.08)' : '#1A1A1A',
                    border: selectedRun === run.id ? '2px solid #C8102E' : '1px solid #2E2E2E',
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
                        {run.name}
                      </h3>
                      <span className="text-xs" style={{ color: '#C8102E', fontFamily: 'JetBrains Mono, monospace' }}>
                        {run.label}
                      </span>
                    </div>
                    {selectedRun === run.id && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#C8102E' }}>
                        <Check size={14} color="#0D0D0D" />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {run.schedule.map((day, i) => (
                      <div
                        key={i}
                        className="flex-1 py-1.5 rounded text-center"
                        style={{
                          background: !day ? '#242424' : day === 'Long' ? 'rgba(255,107,53,0.2)' : day === 'Tempo' ? 'rgba(255,107,53,0.15)' : 'rgba(255,107,53,0.1)',
                          fontSize: '8px',
                          color: !day ? '#606060' : '#C8102E',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 700,
                        }}
                      >
                        {!day ? '·' : day.slice(0, 2).toUpperCase()}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {dayNames.map((d, i) => (
                      <div key={i} className="flex-1 text-center" style={{ fontSize: '8px', color: '#606060' }}>{d.slice(0,1)}</div>
                    ))}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-8 flex justify-between">
              <button onClick={() => setStep(1)} className="px-6 py-3 rounded-xl text-sm font-semibold" style={{ background: '#1A1A1A', color: '#A0A0A0', border: '1px solid #2E2E2E' }}>
                Back
              </button>
              <button
                onClick={() => selectedRun && setStep(3)}
                className="px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2"
                style={{
                  background: selectedRun ? '#00BFA5' : '#2E2E2E',
                  color: selectedRun ? '#0D0D0D' : '#606060',
                  fontFamily: 'Inter, sans-serif',
                  opacity: selectedRun ? 1 : 0.6,
                }}
              >
                Next: Check Conflicts <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CONFLICT CHECK */}
        {step === 3 && (
          <div>
            <h2 className="text-3xl font-black uppercase mb-2" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
              Conflict Check
            </h2>
            <p className="text-sm mb-8" style={{ color: '#A0A0A0' }}>
              Combined weekly view. We flag risky pairings that can cause interference.
            </p>

            <div
              className="rounded-xl p-5 mb-6"
              style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}
            >
              <div className="grid grid-cols-7 gap-2">
                {dayNames.map((day, i) => {
                  const liftDay = liftSplit?.schedule[i]
                  const runDay = runStructure?.schedule[i]
                  const conflict = conflicts[i]
                  const hasLift = liftDay && liftDay !== 'Rest' && liftDay !== '?'
                  const hasRun = runDay !== null && runDay !== undefined

                  return (
                    <div key={i} className="flex flex-col gap-1.5">
                      <div className="text-center text-xs font-bold" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
                        {day}
                      </div>

                      {hasLift && (
                        <div
                          className="rounded py-2 text-center"
                          style={{ background: 'rgba(0,229,200,0.12)', fontSize: '9px', color: '#00BFA5', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}
                        >
                          {liftDay}
                        </div>
                      )}

                      {hasRun && (
                        <div
                          className="rounded py-2 text-center"
                          style={{ background: 'rgba(255,107,53,0.12)', fontSize: '9px', color: '#C8102E', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}
                        >
                          {runDay?.slice(0,3).toUpperCase()}
                        </div>
                      )}

                      {!hasLift && !hasRun && (
                        <div
                          className="rounded py-2 text-center"
                          style={{ background: '#242424', fontSize: '9px', color: '#606060' }}
                        >
                          REST
                        </div>
                      )}

                      {/* Conflict indicator */}
                      {(hasLift && hasRun) && (
                        <div
                          className="rounded py-1 flex items-center justify-center gap-1 text-xs"
                          style={{
                            background: `${conflictColors[conflict]}15`,
                            color: conflictColors[conflict],
                            border: `1px solid ${conflictColors[conflict]}33`,
                            fontSize: '9px',
                          }}
                        >
                          {conflictIcons[conflict]}
                          {conflict}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mb-6">
              {[
                { level: 'ok', label: 'No conflict', color: '#00BFA5' },
                { level: 'risky', label: 'Risky pairing', color: '#F59E0B' },
                { level: 'conflict', label: 'High interference', color: '#EF4444' },
              ].map(({ level, label, color }) => (
                <div key={level} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                  <span className="text-xs" style={{ color: '#A0A0A0' }}>{label}</span>
                </div>
              ))}
            </div>

            {/* Suggestions */}
            {conflicts.some(c => c === 'conflict' || c === 'risky') && (
              <div
                className="rounded-xl p-5 mb-6"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}
              >
                <h4 className="text-sm font-bold mb-2" style={{ color: '#F59E0B' }}>Recovery Suggestions</h4>
                <ul className="space-y-1.5">
                  <li className="text-xs" style={{ color: '#A0A0A0' }}>• Avoid heavy lower body lifts the day before long runs</li>
                  <li className="text-xs" style={{ color: '#A0A0A0' }}>• Place tempo runs on upper body days or rest days</li>
                  <li className="text-xs" style={{ color: '#A0A0A0' }}>• Ensure 24-48hr between heavy leg sessions and quality runs</li>
                </ul>
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="px-6 py-3 rounded-xl text-sm font-semibold" style={{ background: '#1A1A1A', color: '#A0A0A0', border: '1px solid #2E2E2E' }}>
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                className="px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2"
                style={{ background: '#00BFA5', color: '#0D0D0D', fontFamily: 'Inter, sans-serif' }}
              >
                Next: Review <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: REVIEW & SAVE */}
        {step === 4 && (
          <div>
            <h2 className="text-3xl font-black uppercase mb-2" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
              Review & Save
            </h2>
            <p className="text-sm mb-8" style={{ color: '#A0A0A0' }}>Name your programme and save it to your library.</p>

            <div className="space-y-5">
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#606060' }}>
                  Programme Name
                </label>
                <input
                  type="text"
                  value={programmeName}
                  onChange={e => setProgrammeName(e.target.value)}
                  placeholder="My Hybrid Programme"
                  className="w-full px-4 py-3 rounded-xl text-base outline-none"
                  style={{ background: '#1A1A1A', color: '#F5F5F5', border: '1px solid #2E2E2E', fontFamily: 'Inter, sans-serif' }}
                />
              </div>

              <div
                className="rounded-xl p-5 space-y-3"
                style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}
              >
                <h4 className="text-sm font-bold uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>Summary</h4>
                <div className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #2E2E2E' }}>
                  <span className="text-sm" style={{ color: '#A0A0A0' }}>Lift Split</span>
                  <span className="text-sm font-semibold" style={{ color: '#00BFA5', fontFamily: 'JetBrains Mono, monospace' }}>
                    {liftSplit?.name || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #2E2E2E' }}>
                  <span className="text-sm" style={{ color: '#A0A0A0' }}>Run Structure</span>
                  <span className="text-sm font-semibold" style={{ color: '#C8102E', fontFamily: 'JetBrains Mono, monospace' }}>
                    {runStructure?.name || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #2E2E2E' }}>
                  <span className="text-sm" style={{ color: '#A0A0A0' }}>Conflicts</span>
                  <span className="text-sm font-semibold" style={{ color: conflicts.some(c => c === 'conflict') ? '#EF4444' : conflicts.some(c => c === 'risky') ? '#F59E0B' : '#00BFA5', fontFamily: 'JetBrains Mono, monospace' }}>
                    {conflicts.filter(c => c === 'conflict').length} high, {conflicts.filter(c => c === 'risky').length} risky
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm" style={{ color: '#A0A0A0' }}>Est. Weekly Time</span>
                  <span className="text-sm font-semibold" style={{ color: '#F5F5F5', fontFamily: 'JetBrains Mono, monospace' }}>
                    ~{totalHours.toFixed(1)} hrs/week
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  className="flex-1 py-3 rounded-xl text-sm font-bold transition-all"
                  style={{
                    background: saved ? '#1A1A1A' : '#00BFA5',
                    color: saved ? '#00BFA5' : '#0D0D0D',
                    border: saved ? '1px solid #00BFA5' : 'none',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {saved ? '✓ Saved to Library!' : 'Save Programme'}
                </button>
                <button
                  className="flex-1 py-3 rounded-xl text-sm font-bold"
                  style={{ background: '#1A1A1A', color: '#A0A0A0', border: '1px solid #2E2E2E', fontFamily: 'Inter, sans-serif' }}
                >
                  Download as PDF (soon)
                </button>
              </div>
            </div>

            <div className="mt-4">
              <button onClick={() => setStep(3)} className="text-sm" style={{ color: '#606060' }}>← Back</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
