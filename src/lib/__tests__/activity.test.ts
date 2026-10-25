import { describe, it, expect } from 'vitest'
import {
  weekStartOf, stepsSummary, stepsTotals, weeklySteps, monthlySteps, footKind, footKm, weeklyOnFoot, footRecords,
  footEfficiencyByMonth, hrLoad, weeklyHybridLoad, assessLoad, plausibleRecording, watchContextToPrompt, watchDefaults,
} from '../activity'
import type { SessionData } from '../computeStats'
import type { ZeppDay } from '../recovery'
import type { ZeppStats } from '../zeppImport'

function day(date: string, fields: Partial<ZeppDay> = {}): ZeppDay {
  return {
    date,
    readiness: null, hrv_readiness: null, rhr_readiness: null, physical_readiness: null, mental_readiness: null,
    sleep_hrv_ms: null, hrv_baseline_ms: null, sleep_rhr: null, rhr_baseline: null, resting_hr: null,
    sleep_min: null, sleep_score: null, deep_min: null, light_min: null, rem_min: null, awake_min: null,
    wake_count: null, nap_min: null, training_load: null, pai_daily: null, pai_total: null, steps: null,
    active_min: null, stress_avg: null, spo2_score: null, resp_rate: null, weight_kg: null,
    distance_m: null, active_calories: null, step_goal: null,
    ...fields,
  }
}

const zepp = (z: Partial<ZeppStats>): ZeppStats => z as ZeppStats
const sess = (s: Partial<SessionData>): SessionData => ({ type: 'hike', name: 'Walk', date: '2026-10-20', savedAt: s.date ?? 'x', ...s })

describe('weekStartOf', () => {
  it('returns the Monday of the week', () => {
    expect(weekStartOf('2026-10-25')).toBe('2026-10-19')  // Sunday
    expect(weekStartOf('2026-10-19')).toBe('2026-10-19')  // Monday
  })
})

describe('steps', () => {
  const rows = [
    day('2026-09-30', { steps: 8000, distance_m: 6000, step_goal: 10000 }),
    day('2026-10-01', { steps: 12000, distance_m: 9000, step_goal: 10000 }),
    day('2026-10-24', { steps: 22000, distance_m: 17000 }),
    day('2026-10-25', { steps: 10000, distance_m: 7500 }),
    day('2026-10-26', { steps: 0 }),
  ]
  it('summarises today, rolling and calendar averages, totals and goal hit rate', () => {
    expect(stepsSummary(rows, '2026-10-25')).toEqual({
      today: 10000, avg7: 16000, avg30: 13000, monthAvg: 14667, yearAvg: 13000,
      totalSteps: 52000, totalKm: 39.5, daysTracked: 4, goalHitPct: 75,
      best: { date: '2026-10-24', steps: 22000 },
    })
  })
  it('totals steps and km by period', () => {
    expect(stepsTotals(rows, '2026-10-25')).toEqual({
      steps: { today: 10000, week: 32000, d7: 32000, d30: 52000, month: 44000, year: 52000, all: 52000 },
      km: { today: 7.5, week: 24.5, d7: 24.5, d30: 39.5, month: 33.5, year: 39.5, all: 39.5 },
    })
  })
  it('groups by week and month', () => {
    expect(weeklySteps(rows, '2026-10-25', 2).map(w => [w.key, w.avg])).toEqual([['2026-10-19', 16000]])
    expect(monthlySteps(rows, '2026-10-25').map(m => [m.key, m.avg, m.km])).toEqual([['2026-09', 8000, 6], ['2026-10', 14667, 33.5]])
  })
})

describe('on foot', () => {
  const run = sess({ type: 'run', name: 'Run', date: '2026-10-20', run: [{ id: 'r', segmentType: 'run', metric: 'distance', plannedValue: '5', plannedPace: '', actualValue: '5', actualPace: '' }] })
  const hike = sess({ name: 'Outdoor Hike', date: '2026-10-25', hikeKm: 10.5, hikeElevationM: 296, zepp: zepp({ distanceKm: 10.5, durationMin: 159, movingMin: 158, avgHr: 103, avgCadenceSpm: 102, avgStrideCm: 64 }) })
  const walk = sess({ source: 'zepp', date: '2026-10-21', hikeKm: 3.2, hikeElevationM: 40, zepp: zepp({ distanceKm: 3.2, durationMin: 40, avgHr: 100, avgCadenceSpm: 110, avgStrideCm: 70 }) })
  const lift = sess({ type: 'lift', name: 'Weights', date: '2026-10-21' })

  it('classifies runs, hikes and short watch walks', () => {
    expect([run, hike, walk, lift].map(footKind)).toEqual(['run', 'hike', 'walk', null])
    expect(footKm(run)).toBe(5)
  })
  it('totals weekly km by kind with hours and climb', () => {
    const [w] = weeklyOnFoot([run, hike, walk, lift], '2026-10-25', 1)
    expect(w).toEqual({ week: '2026-10-19', run: 5, hike: 10.5, walk: 3.2, hours: 3.3, climb: 336 })
  })
  it('finds on-foot records', () => {
    expect(footRecords([run, hike, walk]).map(r => [r.label, r.value])).toEqual([
      ['Longest distance', '10.5 km'], ['Most climbing', '296 m'], ['Longest time', '2h 39m'], ['Fastest pace (5 km+)', '15:03 /km'],
    ])
  })
  it('computes duration-weighted monthly efficiency', () => {
    const [m] = footEfficiencyByMonth([hike, walk])
    expect(m).toMatchObject({ month: '2026-10', sessions: 2, avgHr: 102, cadence: 104, strideCm: 65 })
    expect(m.paceMinKm).toBe(14.5)
  })
})

describe('plausibleRecording', () => {
  it('rejects recordings left running, GPS jumps and stationary cadence', () => {
    const ok = sess({ source: 'zepp', hikeKm: 6, zepp: zepp({ distanceKm: 6, durationMin: 90, avgCadenceSpm: 100 }) })
    expect(plausibleRecording(ok)).toBe(true)
    expect(plausibleRecording(sess({ ...ok, zepp: zepp({ distanceKm: 5, durationMin: 954, avgCadenceSpm: 3 }) }))).toBe(false)  // left running
    expect(plausibleRecording(sess({ ...ok, zepp: zepp({ distanceKm: 6.1, durationMin: 81, movingMin: 35 }) }))).toBe(false)  // 5.7 min/km walking
    expect(plausibleRecording(sess({ type: 'lift', zepp: zepp({ durationMin: 66 }) }))).toBe(true)
  })
  it('excludes implausible recordings from time records and weekly hours', () => {
    const stuck = sess({ source: 'zepp', date: '2026-10-22', hikeKm: 5, zepp: zepp({ distanceKm: 5, durationMin: 954, avgCadenceSpm: 3 }) })
    expect(footRecords([stuck]).map(r => r.label)).toEqual(['Longest distance'])
    expect(weeklyOnFoot([stuck], '2026-10-25', 1)[0]).toMatchObject({ hike: 5, hours: 0 })
  })
})

describe('hybrid load', () => {
  const lift = sess({ type: 'lift', date: '2026-10-21', zepp: zepp({ durationMin: 20, hrZones: [{ upperBpm: 120, seconds: 600 }, { upperBpm: 134, seconds: 600 }] }) })
  const hike = sess({ date: '2026-10-25', zepp: zepp({ durationMin: 60, hrZones: [{ upperBpm: 120, seconds: 3600 }] }) })
  it('weights zone minutes by zone', () => {
    expect(hrLoad(lift)).toBe(30)   // 10 min × 1 + 10 min × 2
    expect(hrLoad(sess({}))).toBeNull()
  })
  it('splits weekly load into strength and cardio', () => {
    expect(weeklyHybridLoad([lift, hike], '2026-10-25', 1)).toEqual([{ week: '2026-10-19', strength: 30, cardio: 60 }])
  })
})

describe('assessLoad', () => {
  const prior = Array.from({ length: 28 }, (_, i) => day(new Date(Date.UTC(2026, 8, 21 + i)).toISOString().slice(0, 10), { readiness: 78, training_load: 500 }))
  const week = (fields: Partial<ZeppDay>) => Array.from({ length: 7 }, (_, i) => day(new Date(Date.UTC(2026, 9, 19 + i)).toISOString().slice(0, 10), fields))

  it('warns only when load rises while recovery falls', () => {
    expect(assessLoad([...prior, ...week({ readiness: 60, training_load: 700 })], '2026-10-25', false))
      .toMatchObject({ kind: 'warn', reason: expect.stringContaining('watch load +40%') })
  })
  it('reassures when load is up but recovery holds', () => {
    expect(assessLoad([...prior, ...week({ readiness: 79, training_load: 500 })], '2026-10-25', true))
      .toMatchObject({ kind: 'coping', reason: expect.stringContaining('lifting volume >30% up') })
  })
  it('flags falling recovery without a load spike', () => {
    expect(assessLoad([...prior, ...week({ readiness: 65, training_load: 500 })], '2026-10-25', false)).toMatchObject({ kind: 'recovery-low' })
  })
  it('returns null without recent watch data', () => {
    expect(assessLoad(prior, '2026-10-25', true)).toBeNull()
  })
})

describe('watchContextToPrompt', () => {
  it('summarises 4 weeks of recovery, steps, on-foot volume and weight', () => {
    const rows = [
      day('2026-10-20', { readiness: 70, sleep_hrv_ms: 36, hrv_baseline_ms: 37, sleep_rhr: 58, rhr_baseline: 57, sleep_min: 420, steps: 15000 }),
      day('2026-10-24', { readiness: 66, sleep_hrv_ms: 32, hrv_baseline_ms: 37, sleep_rhr: 60, rhr_baseline: 57, sleep_min: 390, steps: 13000, weight_kg: 95.9 }),
    ]
    const hike = sess({ name: 'Outdoor Hike', date: '2026-10-25', hikeKm: 10.5, hikeElevationM: 296, zepp: zepp({ distanceKm: 10.5, durationMin: 159, avgCadenceSpm: 100 }) })
    const text = watchContextToPrompt(rows, [hike], '2026-10-25')
    expect(text).toContain('- Readiness avg 68/100; latest 66 (2026-10-24)')
    expect(text).toContain('- Overnight HRV avg 34 ms vs baseline 37 ms')
    expect(text).toContain('- Sleeping HR avg 59 bpm vs baseline 57')
    expect(text).toContain('- Sleep avg 6.8 h/night')
    expect(text).toContain('- Daily steps avg 14,000')
    expect(text).toContain('- On foot (hikes/walks/runs): avg 2.6 km, 0.7 h and 74 m climb per week')
    expect(text).toContain('- Bodyweight (smart scale): 95.9 kg on 2026-10-24')
  })
  it('is empty without watch data', () => {
    expect(watchContextToPrompt([], [], '2026-10-25')).toBe('')
  })
})

describe('watchDefaults', () => {
  it('derives resting HR, scale weight and activity level', () => {
    const rows = [
      day('2026-10-10', { steps: 9000, weight_kg: 96.4 }),
      day('2026-10-22', { resting_hr: 54, steps: 16000 }),
      day('2026-10-24', { sleep_rhr: 58, steps: 17000, weight_kg: 95.9 }),
    ]
    expect(watchDefaults(rows, '2026-10-25')).toEqual({ restingHr: 56, bodyweightKg: 95.9, activity: 'moderate', avgSteps: 14000 })
  })
  it('returns nulls without data', () => {
    expect(watchDefaults([], '2026-10-25')).toEqual({ restingHr: null, bodyweightKg: null, activity: null, avgSteps: null })
  })
})
