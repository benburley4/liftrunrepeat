'use client'

import { useState, useEffect } from 'react'
import QuickLogFAB from '@/components/log/QuickLogFAB'
import { exercises } from '@/lib/mockData'
import { formatTimeInput } from '@/lib/utils'

type TabId = '1rm' | 'wilks' | 'vo2' | 'macro' | '531'

// Wilks coefficient calculation
function wilksScore(total: number, bodyweight: number, isMale: boolean): number {
  const a = isMale
    ? [-216.0475144, 16.2606339, -0.002388645, -0.00113732, 7.01863e-6, -1.291e-8]
    : [594.31747775582, -27.23842536447, 0.82112226871, -0.00930733913, 4.731582e-5, -9.054e-8]

  const coeff = 500 / (a[0] + a[1]*bodyweight + a[2]*bodyweight**2 + a[3]*bodyweight**3 + a[4]*bodyweight**4 + a[5]*bodyweight**5)
  return Math.round(total * coeff * 100) / 100
}

// Cooper test VO2max
function vo2maxCooper(distance1500m: number): number {
  return Math.round((distance1500m - 504.9) / 44.73 * 10) / 10
}

// 1.5 mile time VO2max
function vo2maxMileTime(timeMinutes: number): number {
  return Math.round((483 / timeMinutes + 3.5) * 10) / 10
}

// Resting HR VO2max (Karvonen method estimate)
function vo2maxHR(restingHR: number): number {
  return Math.round((15 * (220 / restingHR)) * 10) / 10
}

function fitCategory(vo2: number, isMale: boolean): { category: string; color: string } {
  if (isMale) {
    if (vo2 >= 60) return { category: 'Elite', color: '#00BFA5' }
    if (vo2 >= 52) return { category: 'Excellent', color: '#4CAF50' }
    if (vo2 >= 47) return { category: 'Good', color: '#8BC34A' }
    if (vo2 >= 42) return { category: 'Average', color: '#F59E0B' }
    if (vo2 >= 37) return { category: 'Below Average', color: '#FF9800' }
    return { category: 'Poor', color: '#EF4444' }
  } else {
    if (vo2 >= 53) return { category: 'Elite', color: '#00BFA5' }
    if (vo2 >= 45) return { category: 'Excellent', color: '#4CAF50' }
    if (vo2 >= 40) return { category: 'Good', color: '#8BC34A' }
    if (vo2 >= 35) return { category: 'Average', color: '#F59E0B' }
    if (vo2 >= 30) return { category: 'Below Average', color: '#FF9800' }
    return { category: 'Poor', color: '#EF4444' }
  }
}

// OHP valid increments: 10, 13, 15, 18, 20, 23, 25, 28, 30, ...
function roundToOHPSequence(kg: number): number {
  const offsets = [0, 3, 5, 8]
  const base = Math.floor(kg / 10) * 10
  const candidates: number[] = []
  for (let b = base - 10; b <= base + 10; b += 10) {
    for (const o of offsets) {
      const v = b + o
      if (v >= 10) candidates.push(v)
    }
  }
  return candidates.reduce((best, v) => Math.abs(v - kg) < Math.abs(best - kg) ? v : best, candidates[0])
}

const epley1RM = (w: number, r: number) => w * (1 + r / 30)
const brzycki1RM = (w: number, r: number) => w * (36 / (37 - r))
const lombardi1RM = (w: number, r: number) => w * Math.pow(r, 0.1)

const TOOLS_STORAGE_KEY = 'thhl_tools_state'

export default function ToolsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('1rm')

  // 1RM state
  const [rmWeight, setRmWeight] = useState('')
  const [rmReps, setRmReps] = useState('')

  // Wilks state
  const [wilksBodyweight, setWilksBodyweight] = useState('')
  const [wilksSquat, setWilksSquat] = useState('')
  const [wilksBench, setWilksBench] = useState('')
  const [wilksDead, setWilksDead] = useState('')
  const [wilksMale, setWilksMale] = useState(true)

  // VO2max state
  const [vo2Method, setVo2Method] = useState<'cooper' | 'mile' | 'hr'>('cooper')
  const [cooperDist, setCooperDist] = useState('')
  const [mileTime, setMileTime] = useState('')
  const [restingHR, setRestingHR] = useState('')
  const [vo2Male, setVo2Male] = useState(true)

  // Macro state
  const [macroWeight, setMacroWeight] = useState('')
  const [macroGoal, setMacroGoal] = useState<'bulk' | 'maintain' | 'cut'>('maintain')
  const [macroActivity, setMacroActivity] = useState<'light' | 'moderate' | 'heavy'>('moderate')
  const [macroUnit, setMacroUnit] = useState<'lbs' | 'kg'>('kg')

  // 5/3/1 state
  const [lift531Squat, setLift531Squat] = useState('')
  const [lift531Bench, setLift531Bench] = useState('')
  const [lift531Dead, setLift531Dead] = useState('')
  const [lift531OHP, setLift531OHP] = useState('')
  const [use531TM, setUse531TM] = useState(false)
  const [tm531Pct, setTm531Pct] = useState('90')
  const [lift531Names, setLift531Names] = useState({ squat: 'Back Squat', bench: 'Bench Press', dead: 'Deadlift', ohp: 'Overhead Press' })
  const [editingLiftKey, setEditingLiftKey] = useState<string | null>(null)
  const [liftSearch, setLiftSearch] = useState('')

  // Load persisted state on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(TOOLS_STORAGE_KEY) || '{}')
      if (saved.activeTab) setActiveTab(saved.activeTab)
      if (saved.rmWeight !== undefined) setRmWeight(saved.rmWeight)
      if (saved.rmReps !== undefined) setRmReps(saved.rmReps)
      if (saved.wilksBodyweight !== undefined) setWilksBodyweight(saved.wilksBodyweight)
      if (saved.wilksSquat !== undefined) setWilksSquat(saved.wilksSquat)
      if (saved.wilksBench !== undefined) setWilksBench(saved.wilksBench)
      if (saved.wilksDead !== undefined) setWilksDead(saved.wilksDead)
      if (saved.wilksMale !== undefined) setWilksMale(saved.wilksMale)
      if (saved.vo2Method) setVo2Method(saved.vo2Method)
      if (saved.cooperDist !== undefined) setCooperDist(saved.cooperDist)
      if (saved.mileTime !== undefined) setMileTime(saved.mileTime)
      if (saved.restingHR !== undefined) setRestingHR(saved.restingHR)
      if (saved.vo2Male !== undefined) setVo2Male(saved.vo2Male)
      if (saved.macroWeight !== undefined) setMacroWeight(saved.macroWeight)
      if (saved.macroGoal) setMacroGoal(saved.macroGoal)
      if (saved.macroActivity) setMacroActivity(saved.macroActivity)
      if (saved.macroUnit) setMacroUnit(saved.macroUnit)
      if (saved.lift531Squat !== undefined) setLift531Squat(saved.lift531Squat)
      if (saved.lift531Bench !== undefined) setLift531Bench(saved.lift531Bench)
      if (saved.lift531Dead !== undefined) setLift531Dead(saved.lift531Dead)
      if (saved.lift531OHP !== undefined) setLift531OHP(saved.lift531OHP)
      if (saved.use531TM !== undefined) setUse531TM(saved.use531TM)
      if (saved.tm531Pct !== undefined) setTm531Pct(saved.tm531Pct)
      if (saved.lift531Names) setLift531Names(saved.lift531Names)
    } catch { /* ignore */ }
  }, [])

  // Persist state on every change
  useEffect(() => {
    try {
      localStorage.setItem(TOOLS_STORAGE_KEY, JSON.stringify({
        activeTab, rmWeight, rmReps,
        wilksBodyweight, wilksSquat, wilksBench, wilksDead, wilksMale,
        vo2Method, cooperDist, mileTime, restingHR, vo2Male,
        macroWeight, macroGoal, macroActivity, macroUnit,
        lift531Squat, lift531Bench, lift531Dead, lift531OHP,
        use531TM, tm531Pct, lift531Names,
      }))
    } catch { /* ignore */ }
  }, [
    activeTab, rmWeight, rmReps,
    wilksBodyweight, wilksSquat, wilksBench, wilksDead, wilksMale,
    vo2Method, cooperDist, mileTime, restingHR, vo2Male,
    macroWeight, macroGoal, macroActivity, macroUnit,
    lift531Squat, lift531Bench, lift531Dead, lift531OHP,
    use531TM, tm531Pct, lift531Names,
  ])

  const tabs: { id: TabId; label: string }[] = [
    { id: '1rm', label: '1RM Calculator' },
    { id: '531', label: '5/3/1 Calculator' },
    { id: 'wilks', label: 'Wilks Score' },
    { id: 'vo2', label: 'VO2max Estimator' },
    { id: 'macro', label: 'Macro Calculator' },
  ]

  // 1RM calculations
  const w = parseFloat(rmWeight)
  const r = parseInt(rmReps)
  const oneRMs = (!isNaN(w) && !isNaN(r) && r > 0 && w > 0)
    ? {
        epley: Math.round(epley1RM(w, r)),
        brzycki: r < 37 ? Math.round(brzycki1RM(w, r)) : null,
        lombardi: Math.round(lombardi1RM(w, r)),
      }
    : null

  // Wilks
  const bw = parseFloat(wilksBodyweight)
  const total = (parseFloat(wilksSquat) || 0) + (parseFloat(wilksBench) || 0) + (parseFloat(wilksDead) || 0)
  const wilks = (!isNaN(bw) && bw > 0 && total > 0) ? wilksScore(total, bw, wilksMale) : null

  // VO2max
  let calculatedVo2: number | null = null
  if (vo2Method === 'cooper' && cooperDist) {
    calculatedVo2 = vo2maxCooper(parseFloat(cooperDist))
  } else if (vo2Method === 'mile' && mileTime) {
    const parts = mileTime.split(':').map(Number)
    const mins = parts.length === 2 ? parts[0] + parts[1] / 60 : parseFloat(mileTime)
    if (!isNaN(mins)) calculatedVo2 = vo2maxMileTime(mins)
  } else if (vo2Method === 'hr' && restingHR) {
    calculatedVo2 = vo2maxHR(parseInt(restingHR))
  }
  const vo2Cat = calculatedVo2 ? fitCategory(calculatedVo2, vo2Male) : null

  // Macros
  const weightKg = macroUnit === 'lbs'
    ? parseFloat(macroWeight) * 0.453592
    : parseFloat(macroWeight)

  let macros = null
  if (!isNaN(weightKg) && weightKg > 0) {
    const activityMult = { light: 1.375, moderate: 1.55, heavy: 1.725 }[macroActivity]
    const goalAdj = { bulk: 400, maintain: 0, cut: -400 }[macroGoal]
    const bmr = 88.36 + 13.4 * weightKg + 4.8 * 170 - 5.7 * 30 // generic
    const tdee = Math.round(bmr * activityMult * 1.05) // hybrid athlete +5%
    const calories = tdee + goalAdj
    const protein = Math.round(weightKg * (macroGoal === 'cut' ? 2.4 : 2.0))
    const fat = Math.round(weightKg * 1.0)
    const carbs = Math.round((calories - protein * 4 - fat * 9) / 4)
    macros = { calories, protein, fat, carbs, tdee }
  }

  const inputStyle = {
    background: '#242424',
    color: '#F5F5F5',
    border: '1px solid #2E2E2E',
    fontFamily: 'JetBrains Mono, monospace',
  }

  return (
    <div style={{ background: '#0D0D0D', minHeight: '100vh' }}>
      <QuickLogFAB />

      <div className="pt-16 pb-6" style={{ background: '#0A0A0A', borderBottom: '1px solid #1A1A1A' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#00BFA5' }}>Calculators</p>
          <h1 className="text-5xl font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
            Tools
          </h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-16 z-30" style={{ background: 'rgba(13,13,13,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1A1A1A' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-4 py-4 text-sm font-medium whitespace-nowrap relative"
                style={{ color: activeTab === tab.id ? '#F5F5F5' : '#606060', fontFamily: 'Inter, sans-serif' }}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: '#00BFA5' }} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">

        {/* 1RM CALCULATOR */}
        {activeTab === '1rm' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-black uppercase mb-2" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
                1 Rep Max Calculator
              </h2>
              <p className="text-sm" style={{ color: '#A0A0A0' }}>
                Enter your working weight and reps to estimate your 1RM using three formulas.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#606060' }}>Weight (kg)</label>
                <input
                  type="number"
                  value={rmWeight}
                  onChange={e => setRmWeight(e.target.value)}
                  placeholder="100"
                  className="w-full px-4 py-3 rounded-xl outline-none text-center text-lg"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#606060' }}>Reps</label>
                <input
                  type="number"
                  value={rmReps}
                  onChange={e => setRmReps(e.target.value)}
                  placeholder="5"
                  className="w-full px-4 py-3 rounded-xl outline-none text-center text-lg"
                  style={inputStyle}
                />
              </div>
            </div>

            {oneRMs && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { name: 'Epley', value: oneRMs.epley, desc: 'Most popular formula', color: '#00BFA5' },
                  { name: 'Brzycki', value: oneRMs.brzycki, desc: 'More conservative', color: '#C8102E' },
                  { name: 'Lombardi', value: oneRMs.lombardi, desc: 'Power athletes', color: '#A78BFA' },
                ].map(({ name, value, desc, color }) => (
                  <div
                    key={name}
                    className="rounded-xl p-5 text-center"
                    style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}
                  >
                    <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#606060' }}>{name}</p>
                    <p className="text-4xl font-black" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>
                      {value ?? '—'}
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#606060' }}>{value ? 'kg' : 'Reps too high'}</p>
                    <p className="text-xs mt-2" style={{ color: '#A0A0A0' }}>{desc}</p>
                  </div>
                ))}
              </div>
            )}

            {oneRMs && (
              <div
                className="rounded-xl p-4"
                style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}
              >
                <p className="text-xs uppercase tracking-wider mb-3" style={{ color: '#606060' }}>Percentage Chart</p>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                  {[100, 95, 90, 85, 80, 75, 70, 65, 60, 55].map(pct => (
                    <div key={pct} className="text-center rounded p-2" style={{ background: '#242424' }}>
                      <p className="text-xs" style={{ color: '#606060' }}>{pct}%</p>
                      <p className="text-xs font-bold mt-0.5" style={{ color: '#F5F5F5', fontFamily: 'JetBrains Mono, monospace' }}>
                        {Math.round(oneRMs.epley * pct / 100)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {oneRMs && (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2E2E2E' }}>
                <div className="px-4 py-3" style={{ background: '#1A1A1A', borderBottom: '1px solid #2E2E2E' }}>
                  <p className="text-xs uppercase tracking-wider" style={{ color: '#606060' }}>Calculated Weight by Reps (Epley)</p>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: '#141414' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #2E2E2E' }}>
                      <th className="text-left px-4 py-2 text-xs uppercase tracking-wider" style={{ color: '#606060', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Reps</th>
                      <th className="text-right px-4 py-2 text-xs uppercase tracking-wider" style={{ color: '#606060', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Weight (kg)</th>
                      <th className="text-right px-4 py-2 text-xs uppercase tracking-wider" style={{ color: '#606060', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>% of 1RM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(reps => {
                      const weight = reps === 1 ? oneRMs.epley : Math.round(oneRMs.epley / (1 + reps / 30))
                      const pct = Math.round((weight / oneRMs.epley) * 100)
                      const isInput = reps === r
                      return (
                        <tr key={reps} style={{ borderBottom: '1px solid #1E1E1E', background: isInput ? '#00BFA510' : 'transparent' }}>
                          <td className="px-4 py-2.5 text-sm font-semibold" style={{ color: isInput ? '#00BFA5' : '#A0A0A0', fontFamily: 'Inter, sans-serif' }}>
                            {reps} {reps === 1 ? 'rep' : 'reps'}{isInput ? ' ←' : ''}
                          </td>
                          <td className="px-4 py-2.5 text-right text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'JetBrains Mono, monospace' }}>
                            {weight} kg
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs" style={{ color: '#606060', fontFamily: 'JetBrains Mono, monospace' }}>
                            {pct}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* WILKS CALCULATOR */}
        {activeTab === 'wilks' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-black uppercase mb-2" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
                Wilks Calculator
              </h2>
              <p className="text-sm" style={{ color: '#A0A0A0' }}>
                Compare strength across different body weights. Used in powerlifting to determine best lifter.
              </p>
            </div>

            {/* Gender toggle */}
            <div className="flex rounded-lg overflow-hidden w-fit" style={{ border: '1px solid #2E2E2E' }}>
              {[{ label: 'Male', value: true }, { label: 'Female', value: false }].map(({ label, value }) => (
                <button
                  key={label}
                  onClick={() => setWilksMale(value)}
                  className="px-5 py-2.5 text-sm font-semibold"
                  style={{
                    background: wilksMale === value ? '#00BFA5' : '#1A1A1A',
                    color: wilksMale === value ? '#0D0D0D' : '#A0A0A0',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#606060' }}>Bodyweight (kg)</label>
                <input type="number" value={wilksBodyweight} onChange={e => setWilksBodyweight(e.target.value)} placeholder="80" className="w-full px-4 py-3 rounded-xl outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#606060' }}>Squat (kg)</label>
                <input type="number" value={wilksSquat} onChange={e => setWilksSquat(e.target.value)} placeholder="140" className="w-full px-4 py-3 rounded-xl outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#606060' }}>Bench Press (kg)</label>
                <input type="number" value={wilksBench} onChange={e => setWilksBench(e.target.value)} placeholder="100" className="w-full px-4 py-3 rounded-xl outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#606060' }}>Deadlift (kg)</label>
                <input type="number" value={wilksDead} onChange={e => setWilksDead(e.target.value)} placeholder="180" className="w-full px-4 py-3 rounded-xl outline-none" style={inputStyle} />
              </div>
            </div>

            {wilks !== null && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1 rounded-xl p-6 text-center" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                  <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#606060' }}>Wilks Score</p>
                  <p className="text-5xl font-black" style={{ color: '#00BFA5', fontFamily: 'JetBrains Mono, monospace' }}>
                    {wilks}
                  </p>
                  <p className="text-xs mt-2" style={{ color: '#A0A0A0' }}>
                    {wilks >= 500 ? 'Elite' : wilks >= 400 ? 'Advanced' : wilks >= 300 ? 'Intermediate' : 'Beginner'}
                  </p>
                </div>
                <div className="sm:col-span-2 rounded-xl p-5" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                  <p className="text-xs uppercase tracking-wider mb-3" style={{ color: '#606060' }}>Score Benchmarks ({wilksMale ? 'Male' : 'Female'})</p>
                  {[
                    { label: 'World class', range: '600+', color: '#00BFA5' },
                    { label: 'Elite', range: '500–600', color: '#4CAF50' },
                    { label: 'Advanced', range: '400–500', color: '#F59E0B' },
                    { label: 'Intermediate', range: '300–400', color: '#FF9800' },
                    { label: 'Beginner', range: '<300', color: '#606060' },
                  ].map(({ label, range, color }) => (
                    <div key={label} className="flex justify-between py-1.5" style={{ borderBottom: '1px solid #1A1A1A' }}>
                      <span className="text-xs" style={{ color }}>{label}</span>
                      <span className="text-xs font-bold" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>{range}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VO2MAX ESTIMATOR */}
        {activeTab === 'vo2' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-black uppercase mb-2" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
                VO2max Estimator
              </h2>
              <p className="text-sm" style={{ color: '#A0A0A0' }}>
                Estimate your aerobic capacity using three different methods.
              </p>
            </div>

            {/* Gender toggle */}
            <div className="flex rounded-lg overflow-hidden w-fit" style={{ border: '1px solid #2E2E2E' }}>
              {[{ label: 'Male', value: true }, { label: 'Female', value: false }].map(({ label, value }) => (
                <button key={label} onClick={() => setVo2Male(value)} className="px-5 py-2.5 text-sm font-semibold" style={{ background: vo2Male === value ? '#C8102E' : '#1A1A1A', color: vo2Male === value ? '#0D0D0D' : '#A0A0A0' }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Method selector */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'cooper' as const, label: 'Cooper Test', desc: '12-min run distance' },
                { id: 'mile' as const, label: '1.5 Mile Time', desc: 'Timed run test' },
                { id: 'hr' as const, label: 'Resting Heart Rate', desc: 'Estimate from HRrest' },
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setVo2Method(m.id)}
                  className="p-4 rounded-xl text-left"
                  style={{
                    background: vo2Method === m.id ? 'rgba(255,107,53,0.08)' : '#1A1A1A',
                    border: vo2Method === m.id ? '2px solid #C8102E' : '1px solid #2E2E2E',
                  }}
                >
                  <p className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'Montserrat, sans-serif', fontSize: '15px' }}>
                    {m.label.toUpperCase()}
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#606060' }}>{m.desc}</p>
                </button>
              ))}
            </div>

            {vo2Method === 'cooper' && (
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#606060' }}>Distance in 12 minutes (meters)</label>
                <input type="number" value={cooperDist} onChange={e => setCooperDist(e.target.value)} placeholder="2400" className="w-full max-w-xs px-4 py-3 rounded-xl outline-none" style={inputStyle} />
              </div>
            )}
            {vo2Method === 'mile' && (
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#606060' }}>1.5 Mile Time (mm:ss)</label>
                <input type="text" value={mileTime} onChange={e => setMileTime(formatTimeInput(e.target.value))} placeholder="12:00" className="w-full max-w-xs px-4 py-3 rounded-xl outline-none" style={inputStyle} />
              </div>
            )}
            {vo2Method === 'hr' && (
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#606060' }}>Resting Heart Rate (bpm)</label>
                <input type="number" value={restingHR} onChange={e => setRestingHR(e.target.value)} placeholder="52" className="w-full max-w-xs px-4 py-3 rounded-xl outline-none" style={inputStyle} />
              </div>
            )}

            {calculatedVo2 && calculatedVo2 > 0 && vo2Cat && (
              <div className="rounded-xl p-6" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                <div className="flex items-center gap-6 mb-5">
                  <div>
                    <p className="text-xs uppercase tracking-wider" style={{ color: '#606060' }}>VO2max Estimate</p>
                    <p className="text-5xl font-black" style={{ color: vo2Cat.color, fontFamily: 'JetBrains Mono, monospace' }}>
                      {calculatedVo2}
                    </p>
                    <p className="text-sm" style={{ color: '#A0A0A0' }}>mL/kg/min</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#606060' }}>Fitness Category</p>
                    <div
                      className="px-4 py-2 rounded-lg text-sm font-bold"
                      style={{ background: `${vo2Cat.color}18`, color: vo2Cat.color, border: `1px solid ${vo2Cat.color}33` }}
                    >
                      {vo2Cat.category}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Easy Pace', pace: `${Math.round((12 - (calculatedVo2 - 30) * 0.1) / 1.60934 * 10) / 10} min/km`, color: '#4CAF50' },
                    { label: 'Tempo Pace', pace: `${Math.round((12 - (calculatedVo2 - 30) * 0.1 - 1.5) / 1.60934 * 10) / 10} min/km`, color: '#F59E0B' },
                    { label: '5K Race Pace', pace: `${Math.round((12 - (calculatedVo2 - 30) * 0.1 - 2.5) / 1.60934 * 10) / 10} min/km`, color: '#EF4444' },
                  ].map(({ label, pace, color }) => (
                    <div key={label} className="rounded-lg p-3 text-center" style={{ background: '#242424' }}>
                      <p className="text-xs" style={{ color: '#606060' }}>{label}</p>
                      <p className="text-sm font-bold mt-1" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>{pace}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* MACRO CALCULATOR */}
        {activeTab === 'macro' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-black uppercase mb-2" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
                Macro Calculator
              </h2>
              <p className="text-sm" style={{ color: '#A0A0A0' }}>
                Optimized for hybrid athletes with a +5% TDEE multiplier for concurrent training demands.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#606060' }}>Bodyweight</label>
                <div className="flex">
                  <input
                    type="number"
                    value={macroWeight}
                    onChange={e => setMacroWeight(e.target.value)}
                    placeholder={macroUnit === 'lbs' ? '185' : '84'}
                    className="flex-1 px-4 py-3 rounded-l-xl outline-none"
                    style={{ ...inputStyle, borderRight: 'none' }}
                  />
                  <div className="flex flex-col" style={{ border: '1px solid #2E2E2E', borderLeft: 'none' }}>
                    {(['lbs', 'kg'] as const).map(u => (
                      <button
                        key={u}
                        onClick={() => setMacroUnit(u)}
                        className="flex-1 px-3 text-xs font-semibold rounded-r-none"
                        style={{
                          background: macroUnit === u ? '#00BFA5' : '#242424',
                          color: macroUnit === u ? '#0D0D0D' : '#A0A0A0',
                          borderRadius: u === 'lbs' ? '0 8px 0 0' : '0 0 8px 0',
                        }}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#606060' }}>Goal</label>
                <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid #2E2E2E' }}>
                  {([
                    { v: 'bulk' as const, label: 'Bulk', color: '#00BFA5' },
                    { v: 'maintain' as const, label: 'Maintain', color: '#A78BFA' },
                    { v: 'cut' as const, label: 'Cut', color: '#C8102E' },
                  ]).map(({ v, label, color }) => (
                    <button
                      key={v}
                      onClick={() => setMacroGoal(v)}
                      className="flex-1 py-3 text-sm font-semibold"
                      style={{
                        background: macroGoal === v ? color : '#1A1A1A',
                        color: macroGoal === v ? '#0D0D0D' : '#A0A0A0',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#606060' }}>Activity Level</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { v: 'light' as const, label: 'Light', desc: '1-3 sessions/wk' },
                  { v: 'moderate' as const, label: 'Moderate', desc: '4-5 sessions/wk' },
                  { v: 'heavy' as const, label: 'Heavy', desc: '6+ sessions/wk' },
                ].map(({ v, label, desc }) => (
                  <button
                    key={v}
                    onClick={() => setMacroActivity(v)}
                    className="p-3 rounded-xl text-left"
                    style={{
                      background: macroActivity === v ? 'rgba(0,229,200,0.08)' : '#1A1A1A',
                      border: macroActivity === v ? '2px solid #00BFA5' : '1px solid #2E2E2E',
                    }}
                  >
                    <p className="text-sm font-bold" style={{ color: macroActivity === v ? '#00BFA5' : '#F5F5F5' }}>{label}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#606060' }}>{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {macros && (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2E2E2E' }}>
                <div className="px-5 py-4 flex items-center justify-between" style={{ background: '#242424', borderBottom: '1px solid #2E2E2E' }}>
                  <div>
                    <p className="text-xs uppercase tracking-wider" style={{ color: '#606060' }}>Daily Targets</p>
                    <p className="text-xs mt-0.5" style={{ color: '#A0A0A0' }}>
                      Base TDEE: {macros.tdee - ({ bulk: 400, maintain: 0, cut: -400 }[macroGoal])} kcal · +5% hybrid multiplier applied
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black" style={{ color: '#F5F5F5', fontFamily: 'JetBrains Mono, monospace' }}>{macros.calories}</p>
                    <p className="text-xs" style={{ color: '#606060' }}>kcal/day</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 divide-x" style={{ borderColor: '#2E2E2E' }}>
                  {[
                    { label: 'Protein', value: macros.protein, unit: 'g', color: '#00BFA5', tip: `${Math.round(macros.protein / (!isNaN(weightKg) ? weightKg : 1) * 10)/10}g/kg` },
                    { label: 'Carbs', value: macros.carbs, unit: 'g', color: '#C8102E', tip: `${macros.carbs * 4} kcal` },
                    { label: 'Fat', value: macros.fat, unit: 'g', color: '#A78BFA', tip: `${macros.fat * 9} kcal` },
                  ].map(({ label, value, unit, color, tip }) => (
                    <div key={label} className="p-4 text-center" style={{ borderColor: '#2E2E2E' }}>
                      <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#606060' }}>{label}</p>
                      <p className="text-3xl font-black" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>{value > 0 ? value : 0}</p>
                      <p className="text-xs" style={{ color: '#606060' }}>{unit}</p>
                      <p className="text-xs mt-1" style={{ color: '#A0A0A0' }}>{tip}</p>
                    </div>
                  ))}
                </div>

                <div className="px-5 py-3" style={{ background: '#0D0D0D', borderTop: '1px solid #2E2E2E' }}>
                  <p className="text-xs" style={{ color: '#606060' }}>
                    Note: Hybrid athlete calorie needs are ~5-10% higher than standard due to concurrent training demands. Adjust based on body composition response.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        {/* 5/3/1 CALCULATOR */}
        {activeTab === '531' && (() => {
          const lifts = [
            { key: 'squat', label: lift531Names.squat, value: lift531Squat, set: setLift531Squat, round: 5 },
            { key: 'bench', label: lift531Names.bench, value: lift531Bench, set: setLift531Bench, round: 5 },
            { key: 'dead',  label: lift531Names.dead,  value: lift531Dead,  set: setLift531Dead,  round: 5 },
            { key: 'ohp',   label: lift531Names.ohp,   value: lift531OHP,   set: setLift531OHP,   round: 3 },
          ]

          const filteredLibrary = exercises.filter(ex =>
            ex.name.toLowerCase().includes(liftSearch.toLowerCase())
          )

          const weeks = [
            { label: 'Week 1 — 5s',    sets: [{ pct: 0.65, reps: '5' }, { pct: 0.75, reps: '5' }, { pct: 0.85, reps: '5+' }] },
            { label: 'Week 2 — 3s',    sets: [{ pct: 0.70, reps: '3' }, { pct: 0.80, reps: '3' }, { pct: 0.90, reps: '3+' }] },
            { label: 'Week 3 — 5/3/1', sets: [{ pct: 0.75, reps: '5' }, { pct: 0.85, reps: '3' }, { pct: 0.95, reps: '1+' }] },
            { label: 'Week 4 — Deload', sets: [{ pct: 0.40, reps: '5' }, { pct: 0.50, reps: '5' }, { pct: 0.60, reps: '5' }] },
          ]

          function tm(input: string): number | null {
            const v = parseFloat(input)
            if (isNaN(v) || v <= 0) return null
            const pct = Math.min(Math.max(parseFloat(tm531Pct) || 90, 1), 100) / 100
            return use531TM ? v : Math.round(v * pct)
          }

          const anyFilled = lifts.some(l => parseFloat(l.value) > 0)

          return (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-black uppercase mb-2" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>5/3/1 Calculator</h2>
                <p className="text-sm" style={{ color: '#A0A0A0' }}>
                  Jim Wendler&apos;s 5/3/1 programme. Enter your 1RM for each lift and set your training max percentage.
                </p>
              </div>

              {/* TM toggle + percentage input */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setUse531TM(!use531TM)}
                    style={{ width: '40px', height: '22px', borderRadius: '11px', border: 'none', cursor: 'pointer', position: 'relative', background: use531TM ? '#00BFA5' : '#2E2E2E', transition: 'background 0.2s' }}
                  >
                    <span style={{ position: 'absolute', top: '3px', left: use531TM ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                  </button>
                  <span className="text-sm" style={{ color: '#A0A0A0', fontFamily: 'Inter, sans-serif' }}>
                    {use531TM ? 'Input is training max' : 'Input is 1RM'}
                  </span>
                </div>
                {!use531TM && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Training max =</span>
                    <input
                      type="number" value={tm531Pct} onChange={e => setTm531Pct(e.target.value)}
                      min="1" max="100"
                      className="px-3 py-1.5 rounded-lg outline-none text-center text-sm"
                      style={{ ...inputStyle, width: '64px' }}
                    />
                    <span className="text-sm" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>%</span>
                  </div>
                )}
              </div>

              {/* Inputs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {lifts.map(l => (
                  <div key={l.key} style={{ position: 'relative' }}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs uppercase tracking-wider" style={{ color: '#606060', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{l.label}</label>
                      <button
                        onClick={() => { setEditingLiftKey(editingLiftKey === l.key ? null : l.key); setLiftSearch('') }}
                        style={{ fontSize: '10px', color: '#00BFA5', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
                        title="Change exercise"
                      >✎</button>
                    </div>
                    <input
                      type="number" value={l.value} onChange={e => l.set(e.target.value)} placeholder="kg"
                      className="w-full px-3 py-3 rounded-xl outline-none text-center text-sm"
                      style={{ ...inputStyle }}
                    />
                    {tm(l.value) && (
                      <p className="text-xs text-center mt-1" style={{ color: '#606060', fontFamily: 'JetBrains Mono, monospace' }}>
                        TM: {tm(l.value)} kg
                      </p>
                    )}
                    {/* Exercise picker dropdown */}
                    {editingLiftKey === l.key && (
                      <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setEditingLiftKey(null)} />
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: '4px', borderRadius: '12px', background: '#1A1A1A', border: '1px solid #2E2E2E', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                          <div style={{ padding: '8px' }}>
                            <input
                              autoFocus
                              type="text" value={liftSearch} onChange={e => setLiftSearch(e.target.value)}
                              placeholder="Search exercises…"
                              style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', background: '#242424', border: '1px solid #2E2E2E', color: '#F5F5F5', fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {filteredLibrary.slice(0, 30).map(ex => (
                              <button key={ex.id}
                                onClick={() => {
                                  setLift531Names(prev => ({ ...prev, [l.key]: ex.name }))
                                  setEditingLiftKey(null)
                                }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: '#A0A0A0', fontSize: '12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#2E2E2E'; e.currentTarget.style.color = '#F5F5F5' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#A0A0A0' }}
                              >
                                {ex.name}
                              </button>
                            ))}
                            {filteredLibrary.length === 0 && (
                              <p style={{ padding: '12px', fontSize: '12px', color: '#606060', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>No exercises found</p>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Weekly tables */}
              {anyFilled && weeks.map(week => (
                <div key={week.label} className="rounded-xl overflow-hidden" style={{ border: '1px solid #2E2E2E' }}>
                  <div className="px-4 py-3" style={{ background: '#1A1A1A', borderBottom: '1px solid #2E2E2E' }}>
                    <p className="text-xs uppercase tracking-wider font-bold" style={{ color: week.label.includes('Deload') ? '#606060' : '#00BFA5', fontFamily: 'Inter, sans-serif' }}>{week.label}</p>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', background: '#141414' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #2E2E2E' }}>
                        <th className="text-left px-4 py-2 text-xs uppercase tracking-wider" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Lift</th>
                        {week.sets.map((s, i) => (
                          <th key={i} className="text-right px-4 py-2 text-xs uppercase tracking-wider" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
                            Set {i + 1} · {s.reps} reps
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lifts.map((l, li) => {
                        const trainingMax = tm(l.value)
                        if (!trainingMax) return null
                        return (
                          <tr key={l.key} style={{ borderBottom: li < lifts.length - 1 ? '1px solid #1E1E1E' : 'none' }}>
                            <td className="px-4 py-2.5 text-sm font-semibold" style={{ color: '#A0A0A0', fontFamily: 'Inter, sans-serif' }}>{l.label}</td>
                            {week.sets.map((s, i) => {
                              const kg = l.key === 'ohp'
                                ? roundToOHPSequence(trainingMax * s.pct)
                                : Math.round(trainingMax * s.pct / l.round) * l.round
                              const isAmrap = s.reps.includes('+')
                              return (
                                <td key={i} className="px-4 py-2.5 text-right" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                                  <span className="text-sm font-bold" style={{ color: isAmrap ? '#00BFA5' : '#F5F5F5' }}>{kg} kg</span>
                                  <span className="text-xs ml-1" style={{ color: '#606060' }}>{Math.round(s.pct * 100)}%</span>
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ))}

              {!anyFilled && (
                <div className="rounded-xl p-10 text-center" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                  <p className="text-sm" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Enter at least one lift to generate your programme.</p>
                </div>
              )}
            </div>
          )
        })()}

      </div>
    </div>
  )
}
