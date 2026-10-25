import { describe, it, expect } from 'vitest'
import { readinessLevel, latestReadiness, readinessDrivers, lastDays, withRollingMean, periodChange, ZeppDay } from '../recovery'

function day(date: string, fields: Partial<ZeppDay> = {}): ZeppDay {
  return {
    date,
    readiness: null, hrv_readiness: null, rhr_readiness: null, physical_readiness: null, mental_readiness: null,
    sleep_hrv_ms: null, hrv_baseline_ms: null, sleep_rhr: null, rhr_baseline: null, resting_hr: null,
    sleep_min: null, sleep_score: null, deep_min: null, light_min: null, rem_min: null, awake_min: null,
    wake_count: null, nap_min: null, training_load: null, pai_daily: null, pai_total: null, steps: null,
    active_min: null, stress_avg: null, spo2_score: null, resp_rate: null, weight_kg: null,
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
