import { describe, it, expect } from 'vitest'
import { readinessLevel, latestReadiness, readinessDrivers, lastDays, withRollingMean, periodChange, recoveryToPrompt, freshWatchReadiness, illnessSigns, currentIllnessSigns, weeklyLoadRecovery, ZeppDay } from '../recovery'

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

describe('readinessLevel', () => {
  it('applies the agreed thresholds', () => {
    expect(readinessLevel(75)).toBe('go')
    expect(readinessLevel(74)).toBe('planned')
    expect(readinessLevel(55)).toBe('planned')
    expect(readinessLevel(54)).toBe('easy')
    expect(readinessLevel(40)).toBe('easy')
    expect(readinessLevel(39)).toBe('rest')
  })
})

describe('latestReadiness', () => {
  it('falls back to the last scored day when today has no score yet', () => {
    const rows = [day('2026-10-23', { readiness: 50 }), day('2026-10-24', { readiness: 67 }), day('2026-10-25')]
    expect(latestReadiness(rows)?.date).toBe('2026-10-24')
  })
  it('returns null without any scores', () => {
    expect(latestReadiness([day('2026-10-25')])).toBeNull()
  })
})

describe('readinessDrivers', () => {
  it('rates HRV, resting HR and sleep against the athlete\'s own norms', () => {
    const rows = [
      day('2026-10-21', { sleep_min: 480 }),
      day('2026-10-22', { sleep_min: 420 }),
      day('2026-10-23', { sleep_hrv_ms: 25, hrv_baseline_ms: 37, sleep_rhr: 52, rhr_baseline: 56, sleep_min: 330, sleep_score: 76 }),
    ]
    const drivers = readinessDrivers(rows[2], rows)
    expect(drivers.map(d => [d.key, d.status])).toEqual([['hrv', 'poor'], ['rhr', 'good'], ['sleep', 'poor']])
    expect(drivers[0].detail).toBe('-32% vs baseline 37 ms')
    expect(drivers[1].detail).toBe('-4 bpm vs baseline 56')
    expect(drivers[2].value).toBe('5h 30m')
    expect(drivers[2].detail).toBe('−2h 00m vs 7-day avg · score 76')
  })
  it('skips drivers without data', () => {
    expect(readinessDrivers(day('2026-10-23'), [])).toEqual([])
  })
})

describe('trends', () => {
  const rows = [
    day('2026-10-20', { readiness: 60 }),
    day('2026-10-22', { readiness: 70 }),
    day('2026-10-24', { readiness: 80 }),
    day('2026-10-25', { readiness: null }),
  ]
  it('selects the last N calendar days', () => {
    expect(lastDays(rows, 4, '2026-10-25').map(r => r.date)).toEqual(['2026-10-22', '2026-10-24', '2026-10-25'])
    expect(lastDays(rows, null, '2026-10-25')).toHaveLength(4)
  })
  it('computes a trailing mean that ignores gaps', () => {
    expect(withRollingMean(rows, 'readiness', 2)).toEqual([60, 65, 75, 80])
  })
  it('compares the last period with the one before', () => {
    expect(periodChange(rows, 'readiness', 3, '2026-10-25')).toEqual({ current: 80, previous: 65, change: 15 })
  })
})

describe('recoveryToPrompt', () => {
  // Week ending Sun 2026-10-25 = 19–25 Oct; previous 4 weeks = 21 Sep – 18 Oct.
  const prior = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 21 + i)).toISOString().slice(0, 10)
    return day(d, { readiness: 78, sleep_min: 450, training_load: 500, sleep_hrv_ms: 38, hrv_baseline_ms: 37 })
  })
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 9, 19 + i)).toISOString().slice(0, 10)
    return day(d, {
      readiness: i === 4 ? 38 : 66, sleep_min: i < 2 ? 340 : 430, sleep_score: 72, training_load: 600,
      sleep_hrv_ms: 30, hrv_baseline_ms: 37, sleep_rhr: 61, rhr_baseline: 57, stress_avg: 33,
      weight_kg: i === 6 ? 97.6 : null,
    })
  })
  const rows = [...prior, ...week]

  it('summarises the week against the previous 4 weeks with warning flags', () => {
    const text = recoveryToPrompt(rows, '2026-10-25', [
      { date: '2026-10-21', type: 'lift', zepp: { durationMin: 60, avgHr: 120 } },
      { date: '2026-10-22', type: 'hybrid', zepp: { durationMin: 60, avgHr: 130 } },
      { date: '2026-10-24', type: 'hike', zepp: { durationMin: 90, avgHr: 105 } },
      { date: '2026-10-10', type: 'hike', zepp: { durationMin: 90, avgHr: 105 } },   // outside the week
    ])
    expect(text).toContain('Watch readiness (0–100): avg **62** (previous 4 weeks 78)')
    expect(text).toContain('0 go-hard (≥75), 6 as-planned, 0 keep-easy, 1 rest (<40); lowest 38 on 2026-10-23')
    expect(text).toContain('Overnight HRV: avg **30 ms** vs personal baseline 37 ms (-19%); 7 night(s)')
    expect(text).toContain('Sleeping heart rate: avg **61 bpm** vs baseline 57 bpm (+4)')
    expect(text).toContain('Sleep: avg **6.7 h/night** (previous 4 weeks 7.5 h); 2 night(s) under 6 h; avg sleep score 72')
    expect(text).toContain('Watch training load: avg 600 vs 500 previous 4 weeks (+20%)')
    expect(text).toContain('Bodyweight (scale): 97.6 kg')
    expect(text).toContain('Watch-recorded sessions: Strength/hybrid 2 session(s), 2 h, avg HR 125; Hikes/walks 1 session(s), 1.5 h, avg HR 105')
    expect(text).toContain('⚠ RECOVERY FLAGS: readiness falling while training load rises')
    expect(text).toContain('HRV suppressed on 7 of 7 nights; 2 short nights (<6 h); sleeping HR 4 bpm above baseline')
  })

  it('returns nothing without watch data for the week', () => {
    expect(recoveryToPrompt(prior, '2026-11-15')).toBe('')
  })
})

describe('freshWatchReadiness', () => {
  const rows = [
    day('2026-10-20', { readiness: 80 }), day('2026-10-21', { readiness: 78 }), day('2026-10-22', { readiness: 79 }),
    day('2026-10-24', { readiness: 67 }), day('2026-10-25'),
  ]
  it("uses yesterday's score when today's isn't in yet, with a trend vs the prior week", () => {
    expect(freshWatchReadiness(rows, '2026-10-25')).toMatchObject({ score: 67, level: 'planned', trend: '↓', day: { date: '2026-10-24' } })
  })
  it('is null when the latest score is older than yesterday', () => {
    expect(freshWatchReadiness(rows, '2026-10-26')).toBeNull()
  })
})

describe('illnessSigns', () => {
  const base = Array.from({ length: 14 }, (_, i) => day(new Date(Date.UTC(2026, 9, 10 + i)).toISOString().slice(0, 10), { resp_rate: 14 }))
  it('needs a breathing-rate rise plus another sign', () => {
    const sick = day('2026-10-24', { resp_rate: 15.6, sleep_rhr: 62, rhr_baseline: 57, sleep_hrv_ms: 30, hrv_baseline_ms: 37 })
    expect(illnessSigns([...base, sick], sick)).toEqual({
      date: '2026-10-24',
      signs: ['breathing rate 15.6/min vs 14 usual', 'sleeping HR +5 bpm', 'HRV 19% below baseline'],
    })
  })
  it('stays quiet on a breathing-rate rise alone, or without one', () => {
    expect(illnessSigns([...base], day('2026-10-24', { resp_rate: 15.6, sleep_rhr: 57, rhr_baseline: 57 }))).toBeNull()
    expect(illnessSigns([...base], day('2026-10-24', { resp_rate: 14.2, sleep_rhr: 65, rhr_baseline: 57 }))).toBeNull()
  })
})

describe('weeklyLoadRecovery', () => {
  it('averages load, readiness and HRV per Monday-start week', () => {
    const rows = [day('2026-10-19', { training_load: 600, readiness: 70, sleep_hrv_ms: 35 }), day('2026-10-25', { training_load: 700, readiness: 60, sleep_hrv_ms: 31 })]
    expect(weeklyLoadRecovery(rows, '2026-10-25', 1)).toEqual([{ week: '2026-10-19', load: 650, readiness: 65, hrv: 33 }])
  })
})

describe('currentIllnessSigns', () => {
  const base = Array.from({ length: 14 }, (_, i) => day(new Date(Date.UTC(2026, 9, 10 + i)).toISOString().slice(0, 10), { resp_rate: 14 }))
  const sick = day('2026-10-24', { resp_rate: 15.6, sleep_rhr: 62, rhr_baseline: 57 })
  it("checks last night's vitals", () => {
    expect(currentIllnessSigns([...base, sick], '2026-10-25')?.date).toBe('2026-10-24')
  })
  it('ignores older nights', () => {
    expect(currentIllnessSigns([...base, sick], '2026-10-27')).toBeNull()
  })
})
