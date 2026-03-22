'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Watch } from 'lucide-react'
import QuickLogFAB from '@/components/log/QuickLogFAB'

function parseTimeToSeconds(t: string): number | null {
  const parts = t.split(':').map(Number)
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return parts[0] * 60 + parts[1]
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return null
}

function secondsToTime(s: number, includeHours = false): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.round(s % 60)
  if (includeHours || h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const commonDistances = [
  { label: '5K', miles: 3.1, km: 5 },
  { label: '10K', miles: 6.2, km: 10 },
  { label: 'Half', miles: 13.1, km: 21.1 },
  { label: 'Marathon', miles: 26.2, km: 42.2 },
]

const vdotTrainingPaces = (vdot: number) => {
  const toKm = (secPerMile: number) => Math.round(secPerMile / 1.60934)
  return {
    easy: secondsToTime(toKm(Math.round(700 - (vdot - 30) * 8))),
    marathon: secondsToTime(toKm(Math.round(600 - (vdot - 30) * 7))),
    threshold: secondsToTime(toKm(Math.round(560 - (vdot - 30) * 6.5))),
    interval: secondsToTime(toKm(Math.round(500 - (vdot - 30) * 6))),
    rep: secondsToTime(toKm(Math.round(450 - (vdot - 30) * 5.5))),
  }
}

const runTypes = [
  {
    id: 'easy',
    name: 'Easy Run',
    zone: 'Zone 2 (60-70%)',
    intensity: 1,
    duration: '30-90 min',
    color: '#4CAF50',
    purpose: 'Aerobic base building, fat oxidation, active recovery. The foundation of all running fitness.',
    cues: 'Should be able to hold a full conversation. If unsure, go slower.',
  },
  {
    id: 'long',
    name: 'Long Run',
    zone: 'Zone 2 (easy)',
    intensity: 2,
    duration: '60-180 min',
    color: '#00BFA5',
    purpose: 'Endurance development, glycogen depletion adaptation, mental toughness. The weekly cornerstone.',
    cues: 'Truly easy the whole way. Distance is the stimulus, not pace.',
  },
  {
    id: 'tempo',
    name: 'Tempo Run',
    zone: 'Zone 3-4 (80-88%)',
    intensity: 3,
    duration: '20-40 min',
    color: '#F59E0B',
    purpose: 'Raises lactate threshold. The most effective run type for improving race pace sustainability.',
    cues: '3-4 word sentences max. Should be uncomfortable but maintainable for 20-40 min.',
  },
  {
    id: 'vo2max',
    name: 'VO2max Intervals',
    zone: 'Zone 5 (95%+ HRmax)',
    intensity: 5,
    duration: '30-45 min total',
    color: '#EF4444',
    purpose: 'Maximizes aerobic capacity ceiling. Hard 3-5min efforts with equal recovery.',
    cues: '5K effort or slightly faster. 4-6 reps. Require full recovery between intervals.',
  },
  {
    id: 'hills',
    name: 'Hill Repeats',
    zone: 'Zone 4-5',
    intensity: 4,
    duration: '35-50 min',
    color: '#C8102E',
    purpose: 'Strength + power without pounding. Great for hybrid athletes — less eccentric stress than flat sprints.',
    cues: 'Run uphill hard, jog down for full recovery. 6-10 reps of 30-90 seconds.',
  },
  {
    id: 'strides',
    name: 'Strides',
    zone: 'Zone 4 (90-95%)',
    intensity: 3,
    duration: '10-15 min add-on',
    color: '#A78BFA',
    purpose: 'Neuromuscular activation, running economy, leg turnover. Added after easy runs.',
    cues: '4-8 reps of 80-100m. Accelerate to 90-95%, hold, decelerate. Full recovery.',
  },
  {
    id: 'recovery',
    name: 'Recovery Jog',
    zone: 'Zone 1 (under 60%)',
    intensity: 1,
    duration: '20-30 min',
    color: '#606060',
    purpose: 'Blood flow and nutrient delivery without stress. Speeds recovery between hard sessions.',
    cues: 'Ridiculously easy. Slower than you think. Talking is easy.',
  },
]

const starterPlans = [
  {
    name: 'Couch to 5K Hybrid',
    duration: '9 weeks',
    summary: '3× run/walk + 3× full body lifts per week. No previous experience needed.',
    weeks: ['Walk/run 20min × 3', 'Run 25min × 3', 'Run 30min × 3'],
  },
  {
    name: '10K Base + Strength',
    duration: '12 weeks',
    summary: '4× structured runs + 3× strength per week. 5K fitness required.',
    weeks: ['40-48 km/wk easy', '1× tempo added', '2× quality sessions'],
  },
  {
    name: 'Half Marathon + Lifts',
    duration: '16 weeks',
    summary: '5× runs + 2-3× lifts. Build to 65+ km/week while maintaining strength.',
    weeks: ['56-61 km/wk', 'Long runs to 22km', 'Taper to race day'],
  },
]

export default function RunningPage() {
  const [paceUnit, setPaceUnit] = useState<'mi' | 'km'>('km')
  const [paceDistance, setPaceDistance] = useState('')
  const [paceTime, setPaceTime] = useState('')
  const [pacePace, setPacePace] = useState('')

  const [vdotDistance, setVdotDistance] = useState('10K')
  const [vdotTime, setVdotTime] = useState('')
  const [expandedRun, setExpandedRun] = useState<string | null>(null)

  // Pace calculator logic
  const distMi = paceUnit === 'km'
    ? parseFloat(paceDistance) / 1.60934
    : parseFloat(paceDistance)

  const timeVal = parseTimeToSeconds(paceTime)
  const paceVal = parseTimeToSeconds(pacePace)

  let calcPace = ''
  let calcTime = ''
  let calcDist = ''

  if (!isNaN(distMi) && distMi > 0 && timeVal !== null) {
    const secPerMile = timeVal / distMi
    const secPerUnit = paceUnit === 'km' ? secPerMile / 1.60934 : secPerMile
    calcPace = secondsToTime(Math.round(secPerUnit))
  }
  if (!isNaN(distMi) && distMi > 0 && paceVal !== null) {
    const totalSec = distMi * paceVal * (paceUnit === 'km' ? 1.60934 : 1)
    calcTime = secondsToTime(Math.round(totalSec), true)
  }

  // Generate splits
  const generateSplits = () => {
    if (!timeVal || isNaN(distMi) || distMi <= 0) return []
    const pacePerUnit = paceUnit === 'km'
      ? timeVal / (distMi * 1.60934)
      : timeVal / distMi
    const totalUnits = paceUnit === 'km' ? distMi * 1.60934 : distMi
    const splits = []
    let cumTime = 0
    for (let i = 1; i <= Math.floor(totalUnits); i++) {
      cumTime += pacePerUnit
      splits.push({ unit: i, split: secondsToTime(Math.round(pacePerUnit)), cumulative: secondsToTime(Math.round(cumTime)) })
    }
    return splits
  }

  const splits = generateSplits()

  // VDOT calculator
  const vdotDistMiles: Record<string, number> = { '5K': 3.1, '10K': 6.2, 'Half': 13.1, 'Marathon': 26.2 }
  const distM = (vdotDistMiles[vdotDistance] || 6.2) * 1609.34
  const vdotTimeSec = parseTimeToSeconds(vdotTime) || (parseTimeToSeconds(vdotTime.includes(':') ? vdotTime : '') || null)
  let calcVdot: number | null = null
  let trainingPaces = null

  if (vdotTimeSec && vdotTimeSec > 0) {
    const vel = distM / vdotTimeSec
    const pct = 0.8 + 0.1894393 * Math.exp(-0.012778 * vdotTimeSec / 60) + 0.2989558 * Math.exp(-0.1932605 * vdotTimeSec / 60)
    const vo2 = -4.60 + 0.182258 * vel * 60 + 0.000104 * Math.pow(vel * 60, 2)
    calcVdot = Math.round(vo2 / pct * 10) / 10
    if (calcVdot > 20) trainingPaces = vdotTrainingPaces(calcVdot)
  }

  return (
    <div style={{ background: '#0D0D0D', minHeight: '100vh' }}>
      <QuickLogFAB />

      {/* Hero */}
      <div
        className="pt-16 pb-12"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,107,53,0.08) 0%, transparent 70%)',
          borderBottom: '1px solid #1A1A1A',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10">
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#C8102E' }}>Running Hub</p>
          <h1
            className="text-6xl font-black uppercase mb-3"
            style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}
          >
            YOUR RUNNING HQ
          </h1>
          <p className="text-lg" style={{ color: '#A0A0A0' }}>
            Structured running paired with serious iron.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-10">

        {/* Quick tools grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Pace Calculator', color: '#C8102E', href: '#pace-calc' },
            { label: 'VDOT Estimator', color: '#00BFA5', href: '#vdot' },
            { label: 'Race Predictor', color: '#A78BFA', href: '#vdot' },
            { label: 'Run Type Guide', color: '#4CAF50', href: '#run-types' },
          ].map(({ label, color, href }) => (
            <a
              key={label}
              href={href}
              className="rounded-xl p-4 text-center transition-all"
              style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#2E2E2E')}
            >
              <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ background: color }} />
              <span className="text-sm font-semibold" style={{ color: '#F5F5F5', fontFamily: 'Inter, sans-serif' }}>{label}</span>
            </a>
          ))}
        </div>

        {/* PACE CALCULATOR */}
        <div id="pace-calc" className="rounded-xl p-6" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
              Pace Calculator
            </h2>
            <div className="flex rounded overflow-hidden" style={{ border: '1px solid #2E2E2E' }}>
              {(['mi', 'km'] as const).map(u => (
                <button
                  key={u}
                  onClick={() => setPaceUnit(u)}
                  className="px-3 py-1.5 text-xs font-semibold"
                  style={{
                    background: paceUnit === u ? '#C8102E' : '#242424',
                    color: paceUnit === u ? '#0D0D0D' : '#A0A0A0',
                  }}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#606060' }}>
                Distance ({paceUnit})
              </label>
              <input
                type="number"
                step="0.1"
                value={paceDistance}
                onChange={e => setPaceDistance(e.target.value)}
                placeholder={paceUnit === 'km' ? '10' : '6.2'}
                className="w-full px-3 py-3 rounded outline-none text-center"
                style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #2E2E2E', fontFamily: 'JetBrains Mono, monospace' }}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#606060' }}>
                Time (h:mm:ss or mm:ss)
              </label>
              <input
                type="text"
                value={paceTime}
                onChange={e => setPaceTime(e.target.value)}
                placeholder="55:20"
                className="w-full px-3 py-3 rounded outline-none text-center"
                style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #2E2E2E', fontFamily: 'JetBrains Mono, monospace' }}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#606060' }}>
                Pace (min/{paceUnit})
              </label>
              <input
                type="text"
                value={pacePace}
                onChange={e => setPacePace(e.target.value)}
                placeholder="8:55"
                className="w-full px-3 py-3 rounded outline-none text-center"
                style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #2E2E2E', fontFamily: 'JetBrains Mono, monospace' }}
              />
            </div>
          </div>

          {calcPace && (
            <div className="rounded-lg p-4 mb-4" style={{ background: '#242424', border: '1px solid #2E2E2E' }}>
              <p className="text-xs mb-1" style={{ color: '#606060' }}>Calculated Pace</p>
              <p className="text-3xl font-bold" style={{ color: '#C8102E', fontFamily: 'JetBrains Mono, monospace' }}>
                {calcPace} <span className="text-base" style={{ color: '#606060' }}>/{paceUnit}</span>
              </p>
            </div>
          )}

          {splits.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-3" style={{ color: '#606060' }}>{paceUnit.toUpperCase()}</th>
                    <th className="text-right py-2 px-3" style={{ color: '#606060' }}>Split</th>
                    <th className="text-right py-2 px-3" style={{ color: '#606060' }}>Cumulative</th>
                  </tr>
                </thead>
                <tbody>
                  {splits.map(s => (
                    <tr key={s.unit} style={{ borderBottom: '1px solid #1A1A1A' }}>
                      <td className="py-2 px-3 font-bold" style={{ color: '#F5F5F5', fontFamily: 'JetBrains Mono, monospace' }}>{s.unit}</td>
                      <td className="py-2 px-3 text-right" style={{ color: '#C8102E', fontFamily: 'JetBrains Mono, monospace' }}>{s.split}</td>
                      <td className="py-2 px-3 text-right" style={{ color: '#A0A0A0', fontFamily: 'JetBrains Mono, monospace' }}>{s.cumulative}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* VDOT TOOL */}
        <div id="vdot" className="rounded-xl p-6" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
          <h2 className="text-3xl font-black uppercase mb-6" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
            VDOT Estimator & Training Paces
          </h2>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#606060' }}>Race Distance</label>
              <div className="flex gap-2 flex-wrap">
                {commonDistances.map(d => (
                  <button
                    key={d.label}
                    onClick={() => setVdotDistance(d.label)}
                    className="px-3 py-2 rounded text-sm font-medium"
                    style={{
                      background: vdotDistance === d.label ? 'rgba(0,229,200,0.12)' : '#242424',
                      color: vdotDistance === d.label ? '#00BFA5' : '#A0A0A0',
                      border: vdotDistance === d.label ? '1px solid rgba(0,229,200,0.3)' : '1px solid #2E2E2E',
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#606060' }}>Finish Time</label>
              <input
                type="text"
                value={vdotTime}
                onChange={e => setVdotTime(e.target.value)}
                placeholder="45:00 or 1:45:00"
                className="w-full px-3 py-3 rounded outline-none"
                style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #2E2E2E', fontFamily: 'JetBrains Mono, monospace' }}
              />
            </div>
          </div>

          {calcVdot && calcVdot > 20 && trainingPaces && (
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="text-5xl font-black" style={{ color: '#00BFA5', fontFamily: 'JetBrains Mono, monospace' }}>
                  {calcVdot}
                </div>
                <div>
                  <p className="text-xs" style={{ color: '#606060' }}>VDOT Score</p>
                  <p className="text-sm font-semibold" style={{ color: '#A0A0A0' }}>
                    {calcVdot >= 55 ? 'Elite / Sub-elite' : calcVdot >= 50 ? 'Advanced' : calcVdot >= 45 ? 'Solid Intermediate' : calcVdot >= 38 ? 'Intermediate' : 'Developing'}
                  </p>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2E2E2E' }}>
                <div className="px-4 py-3" style={{ background: '#242424', borderBottom: '1px solid #2E2E2E' }}>
                  <p className="text-xs uppercase tracking-wider" style={{ color: '#606060' }}>Training Paces (per km)</p>
                </div>
                {[
                  { name: 'Easy', pace: trainingPaces.easy, color: '#4CAF50', desc: 'Daily aerobic runs' },
                  { name: 'Marathon', pace: trainingPaces.marathon, color: '#00BFA5', desc: 'Marathon race pace' },
                  { name: 'Threshold', pace: trainingPaces.threshold, color: '#F59E0B', desc: 'Tempo runs' },
                  { name: 'Interval', pace: trainingPaces.interval, color: '#C8102E', desc: 'VO2max work' },
                  { name: 'Rep', pace: trainingPaces.rep, color: '#EF4444', desc: 'Fast reps' },
                ].map(({ name, pace, color, desc }) => (
                  <div
                    key={name}
                    className="px-4 py-3 flex items-center justify-between"
                    style={{ borderBottom: '1px solid #1A1A1A' }}
                  >
                    <div>
                      <span className="text-sm font-semibold" style={{ color: '#F5F5F5' }}>{name}</span>
                      <span className="text-xs ml-2" style={{ color: '#606060' }}>{desc}</span>
                    </div>
                    <span className="text-base font-bold" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>
                      {pace}/km
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RUN TYPE LIBRARY */}
        <div id="run-types">
          <h2 className="text-3xl font-black uppercase mb-4" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
            Run Type Library
          </h2>
          <div className="space-y-2">
            {runTypes.map(rt => (
              <div
                key={rt.id}
                className="rounded-xl overflow-hidden"
                style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}
              >
                <button
                  className="w-full px-5 py-4 flex items-center justify-between text-left"
                  onClick={() => setExpandedRun(expandedRun === rt.id ? null : rt.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-1 h-8 rounded-full" style={{ background: rt.color }} />
                    <div>
                      <h3 className="text-base font-bold" style={{ color: '#F5F5F5', fontFamily: 'Montserrat, sans-serif', fontSize: '17px' }}>
                        {rt.name.toUpperCase()}
                      </h3>
                      <div className="flex gap-3 mt-0.5">
                        <span className="text-xs" style={{ color: rt.color }}>{rt.zone}</span>
                        <span className="text-xs" style={{ color: '#606060' }}>{rt.duration}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Intensity dots */}
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(d => (
                        <div
                          key={d}
                          className="w-2 h-2 rounded-full"
                          style={{ background: d <= rt.intensity ? rt.color : '#2E2E2E' }}
                        />
                      ))}
                    </div>
                    {expandedRun === rt.id ? <ChevronUp size={16} style={{ color: '#606060' }} /> : <ChevronDown size={16} style={{ color: '#606060' }} />}
                  </div>
                </button>
                {expandedRun === rt.id && (
                  <div className="px-5 pb-5" style={{ borderTop: '1px solid #2E2E2E' }}>
                    <p className="text-sm mt-4 mb-3 leading-relaxed" style={{ color: '#A0A0A0' }}>{rt.purpose}</p>
                    <div className="rounded p-3 text-xs" style={{ background: '#242424', color: '#A0A0A0', fontStyle: 'italic' }}>
                      Coach tip: {rt.cues}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* STARTER PLANS */}
        <div>
          <h2 className="text-3xl font-black uppercase mb-4" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
            Starter Plans
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {starterPlans.map(plan => (
              <div
                key={plan.name}
                className="rounded-xl p-5"
                style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}
              >
                <h3 className="text-xl font-black uppercase mb-1" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
                  {plan.name}
                </h3>
                <p className="text-xs mb-3" style={{ color: '#C8102E', fontFamily: 'JetBrains Mono, monospace' }}>{plan.duration}</p>
                <p className="text-sm mb-4 leading-relaxed" style={{ color: '#A0A0A0' }}>{plan.summary}</p>
                <div className="space-y-1.5 mb-4">
                  {plan.weeks.map((w, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: '#606060' }}>Phase {i+1}:</span>
                      <span className="text-xs" style={{ color: '#A0A0A0' }}>{w}</span>
                    </div>
                  ))}
                </div>
                <button
                  className="w-full py-2.5 rounded-lg text-sm font-semibold"
                  style={{ background: '#C8102E', color: '#0D0D0D', fontFamily: 'Inter, sans-serif' }}
                >
                  View Full Plan
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ARTICLES */}
        <div>
          <h2 className="text-3xl font-black uppercase mb-4" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
            From the Blog
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                title: "How to Run Without Killing Your Squat",
                category: 'Interference',
                catColor: '#C8102E',
                excerpt: 'The research on concurrent training interference is clear: you can run and lift heavy, but timing and intensity matter. Here\'s what the science says.',
                readTime: '6 min read',
              },
              {
                title: "Periodizing Running Around Lifting",
                category: 'Programming',
                catColor: '#00BFA5',
                excerpt: 'Block periodization isn\'t just for strength athletes. Learn how to phase your running goals with your strength cycles for maximum adaptation.',
                readTime: '8 min read',
              },
              {
                title: "Zone 2: The Hybrid Athlete's Secret Weapon",
                category: 'Physiology',
                catColor: '#4CAF50',
                excerpt: 'Most hybrid athletes run too fast on easy days and too slow on hard days. Zone 2 training fixes your aerobic engine without compromising strength.',
                readTime: '5 min read',
              },
            ].map(article => (
              <div
                key={article.title}
                className="rounded-xl p-5 flex flex-col"
                style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}
              >
                <span
                  className="text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded w-fit mb-3"
                  style={{ background: `${article.catColor}15`, color: article.catColor }}
                >
                  {article.category}
                </span>
                <h3 className="text-lg font-black mb-2" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5', lineHeight: 1.2 }}>
                  {article.title}
                </h3>
                <p className="text-sm leading-relaxed flex-1" style={{ color: '#A0A0A0' }}>{article.excerpt}</p>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs" style={{ color: '#606060' }}>{article.readTime}</span>
                  <button className="text-xs font-semibold" style={{ color: '#00BFA5' }}>Read →</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* WEARABLE SYNC */}
        <div>
          <h2 className="text-3xl font-black uppercase mb-4" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
            Connect Your Wearable
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {['Garmin Connect', 'Strava'].map(service => (
              <div
                key={service}
                className="rounded-xl p-5 flex items-center justify-between"
                style={{ background: '#1A1A1A', border: '1px solid #2E2E2E', opacity: 0.6 }}
              >
                <div className="flex items-center gap-3">
                  <Watch size={24} style={{ color: '#606060' }} />
                  <div>
                    <h4 className="text-sm font-semibold" style={{ color: '#A0A0A0' }}>{service}</h4>
                    <p className="text-xs" style={{ color: '#606060' }}>Auto-sync workouts and metrics</p>
                  </div>
                </div>
                <span
                  className="px-2 py-1 rounded text-xs font-semibold"
                  style={{ background: '#242424', color: '#606060', border: '1px solid #2E2E2E' }}
                >
                  Coming Soon
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
