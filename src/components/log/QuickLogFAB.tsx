'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'

export default function QuickLogFAB() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'run' | 'lift'>('run')
  const [saved, setSaved] = useState(false)

  // Run fields
  const [distance, setDistance] = useState('')
  const [time, setTime] = useState('')
  const [runType, setRunType] = useState('Easy')

  // Lift fields
  const [exercise, setExercise] = useState('')
  const [sets, setSets] = useState('')
  const [reps, setReps] = useState('')
  const [weight, setWeight] = useState('')

  const handleSave = () => {
    const entry = mode === 'run'
      ? { type: 'run', distance, time, runType, savedAt: new Date().toISOString() }
      : { type: 'lift', exercise, sets, reps, weight, savedAt: new Date().toISOString() }

    const existing = JSON.parse(localStorage.getItem('quickLogs') || '[]')
    localStorage.setItem('quickLogs', JSON.stringify([entry, ...existing]))

    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setOpen(false)
      setDistance(''); setTime(''); setExercise(''); setSets(''); setReps(''); setWeight('')
    }, 1200)
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
        style={{ background: 'linear-gradient(135deg, #00BFA5, #C8102E)' }}
        aria-label="Quick log"
      >
        <Plus size={24} color="#0D0D0D" strokeWidth={2.5} />
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6"
            style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2
                className="text-xl font-black uppercase"
                style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}
              >
                Quick Log
              </h2>
              <button onClick={() => setOpen(false)}>
                <X size={20} style={{ color: '#606060' }} />
              </button>
            </div>

            {/* Mode toggle */}
            <div
              className="flex rounded-lg overflow-hidden mb-5"
              style={{ background: '#0D0D0D', border: '1px solid #2E2E2E' }}
            >
              <button
                onClick={() => setMode('run')}
                className="flex-1 py-2.5 text-sm font-semibold transition-all"
                style={{
                  background: mode === 'run' ? '#C8102E' : 'transparent',
                  color: mode === 'run' ? '#0D0D0D' : '#A0A0A0',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Run
              </button>
              <button
                onClick={() => setMode('lift')}
                className="flex-1 py-2.5 text-sm font-semibold transition-all"
                style={{
                  background: mode === 'lift' ? '#00BFA5' : 'transparent',
                  color: mode === 'lift' ? '#0D0D0D' : '#A0A0A0',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Lift
              </button>
            </div>

            {mode === 'run' ? (
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {['Easy', 'Tempo', 'Long', 'Intervals'].map(rt => (
                    <button
                      key={rt}
                      onClick={() => setRunType(rt)}
                      className="px-3 py-1.5 rounded text-xs font-medium"
                      style={{
                        background: runType === rt ? 'rgba(255,107,53,0.15)' : '#242424',
                        color: runType === rt ? '#C8102E' : '#A0A0A0',
                        border: runType === rt ? '1px solid rgba(255,107,53,0.3)' : '1px solid #2E2E2E',
                      }}
                    >
                      {rt}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: '#606060' }}>Distance (km)</label>
                    <input
                      type="number"
                      value={distance}
                      onChange={e => setDistance(e.target.value)}
                      placeholder="10"
                      className="w-full px-3 py-2 rounded text-sm outline-none text-center"
                      style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #2E2E2E', fontFamily: 'JetBrains Mono, monospace' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: '#606060' }}>Time (mm:ss)</label>
                    <input
                      type="text"
                      value={time}
                      onChange={e => setTime(e.target.value)}
                      placeholder="55:20"
                      className="w-full px-3 py-2 rounded text-sm outline-none text-center"
                      style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #2E2E2E', fontFamily: 'JetBrains Mono, monospace' }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: '#606060' }}>Exercise</label>
                  <input
                    type="text"
                    value={exercise}
                    onChange={e => setExercise(e.target.value)}
                    placeholder="Back Squat"
                    className="w-full px-3 py-2 rounded text-sm outline-none"
                    style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #2E2E2E', fontFamily: 'Inter, sans-serif' }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Sets', value: sets, setter: setSets, placeholder: '3' },
                    { label: 'Reps', value: reps, setter: setReps, placeholder: '5' },
                    { label: 'Weight (kg)', value: weight, setter: setWeight, placeholder: '100' },
                  ].map(({ label, value, setter, placeholder }) => (
                    <div key={label}>
                      <label className="text-xs mb-1 block" style={{ color: '#606060' }}>{label}</label>
                      <input
                        type="number"
                        value={value}
                        onChange={e => setter(e.target.value)}
                        placeholder={placeholder}
                        className="w-full px-2 py-2 rounded text-sm outline-none text-center"
                        style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #2E2E2E', fontFamily: 'JetBrains Mono, monospace' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleSave}
              className="mt-5 w-full py-3 rounded-xl text-sm font-bold transition-all"
              style={{
                background: saved ? '#1A1A1A' : (mode === 'run' ? '#C8102E' : '#00BFA5'),
                color: saved ? '#00BFA5' : '#0D0D0D',
                border: saved ? '1px solid #00BFA5' : 'none',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {saved ? '✓ Saved!' : 'Save Quick Log'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
