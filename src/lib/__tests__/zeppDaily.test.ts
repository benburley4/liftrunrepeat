import { describe, it, expect } from 'vitest'
import { buildZeppDaily, pickSleep, scaleBodyweight, SleepRow } from '../zeppDaily'

const night: SleepRow = {
  startTime: '2026-10-23T15:20:00+00:00', // 23:20 HKT
  endTime: '2026-10-23T22:57:00+00:00',   // 06:57 HKT on the 24th
  score: 73, durationMin: 457, deepMin: 31, lightMin: 317, remMin: 96, awakeMin: 13, wakeCount: 9,
}

describe('pickSleep', () => {
  it('files a night under the local wake-up date', () => {
    expect([...pickSleep([night]).keys()]).toEqual(['2026-10-24'])
  })
  it('prefers the full-night record over an identical duplicate without wake count', () => {
    const dup = { ...night, wakeCount: null }
    expect(pickSleep([dup, night]).get('2026-10-24')!.main).toBe(night)
  })
  it('counts non-overlapping shorter sleeps as naps', () => {
    const nap: SleepRow = { ...night, startTime: '2026-10-24T06:00:00+00:00', endTime: '2026-10-24T06:40:00+00:00', durationMin: 40, wakeCount: null }
    expect(pickSleep([night, nap]).get('2026-10-24')!.napMin).toBe(40)
  })
})

describe('scaleBodyweight', () => {
  it('takes the 7-day median up to the latest reading', () => {
    const w = [
      { timestamp: '2026-10-01T00:00:00+00:00', kg: 99 },   // outside the window
      { timestamp: '2026-10-18T00:00:00+00:00', kg: 95.2 },
      { timestamp: '2026-10-20T00:00:00+00:00', kg: 96.0 },
      { timestamp: '2026-10-23T00:00:00+00:00', kg: 95.6 },
    ]
    expect(scaleBodyweight(w)).toEqual({ kg: 95.6, asOf: '2026-10-23T00:00:00+00:00' })
  })
  it('returns null without readings', () => {
    expect(scaleBodyweight([])).toBeNull()
  })
})

describe('buildZeppDaily', () => {
  it('pivots metrics, sleep and weight into one row per date', () => {
    const rows = buildZeppDaily(
      [
        { date: '2026-10-24', metric: 'readiness', value: 81 },
        { date: '2026-10-24', metric: 'sleep_hrv', value: 38.46 },
        { date: '2026-10-24', metric: 'device_resting_hr', value: 56 },
        { date: '2026-10-24', metric: 'steps', value: 12000 },
        { date: '2026-10-25', metric: 'readiness', value: 64 },
      ],
      [night],
      [{ timestamp: '2026-10-24T00:05:00+00:00', kg: 95.55 }],
    )
    expect(rows.map(r => r.date)).toEqual(['2026-10-24', '2026-10-25'])
    expect(rows[0]).toMatchObject({
      readiness: 81, sleep_hrv_ms: 38.5, resting_hr: 56, steps: 12000,
      sleep_min: 457, sleep_score: 73, deep_min: 31, wake_count: 9, nap_min: 0, weight_kg: 95.6,
    })
    expect(rows[1]).toMatchObject({ readiness: 64, sleep_min: null, weight_kg: null })
  })
  it('prefers resting_hr over the device fallback when both exist', () => {
    const [row] = buildZeppDaily(
      [{ date: '2026-10-24', metric: 'device_resting_hr', value: 59 }, { date: '2026-10-24', metric: 'resting_hr', value: 55 }],
      [], [],
    )
    expect(row.resting_hr).toBe(55)
  })
})
