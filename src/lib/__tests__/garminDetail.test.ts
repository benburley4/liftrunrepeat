import { describe, it, expect } from 'vitest'
import { semicirclesToDeg, fitSamples, fitRoutePoints, fitHrZones, fitKmSplits, garminDailyRows, type FitRecord } from '../garminDetail'

const t0 = Date.parse('2024-05-01T06:00:00Z')
const at = (s: number) => new Date(t0 + s * 1000)

describe('positions and samples', () => {
  it('converts semicircles to degrees', () => {
    expect(semicirclesToDeg(2 ** 30)).toBe(90)
    expect(semicirclesToDeg(-(2 ** 31))).toBe(-180)
  })
  it('prefers enhanced altitude/speed and drops records without GPS from the route', () => {
    const recs: FitRecord[] = [
      { timestamp: at(0), heartRate: 120, altitude: 10, enhancedAltitude: 11, speed: 2, positionLat: 2 ** 29, positionLong: 2 ** 29 },
      { timestamp: at(1), heartRate: 121, speed: 2.5 },
    ]
    expect(fitSamples(recs)[0]).toEqual({ timestamp: at(0).toISOString(), heartRate: 120, altitude: 11, speed: 2 })
    expect(fitSamples(recs)[1].altitude).toBeNull()
    expect(fitRoutePoints(recs)).toEqual([{ latitude: 45, longitude: 45 }])
  })
})

describe('fitHrZones', () => {
  it("uses Garmin's session time-in-zone, folding the top bin into zone six", () => {
    const zones = fitHrZones([
      { referenceMesg: 'lap', timeInHrZone: [1, 1, 1, 1, 1, 1, 1], hrZoneHighBoundary: [1, 2, 3, 4, 5, 6] },
      { referenceMesg: 'session', timeInHrZone: [10, 20, 30, 40, 50, 60.4, 5], hrZoneHighBoundary: [90, 108, 126, 144, 162, 180] },
    ], [], [])
    expect(zones).toEqual([
      { upperBpm: 90, seconds: 10 }, { upperBpm: 108, seconds: 20 }, { upperBpm: 126, seconds: 30 },
      { upperBpm: 144, seconds: 40 }, { upperBpm: 162, seconds: 50 }, { upperBpm: 180, seconds: 65 },
    ])
  })
  it('falls back to counting record time against the given boundaries, capping gaps', () => {
    const recs: FitRecord[] = [
      { timestamp: at(0), heartRate: 100 }, { timestamp: at(5), heartRate: 150 },
      { timestamp: at(10), heartRate: 150 }, { timestamp: at(100), heartRate: 200 }, { timestamp: at(101) },
    ]
    const zones = fitHrZones([], recs, [90, 139, 156, 166, 173, 185])!
    expect(zones.map(z => z.seconds)).toEqual([0, 5, 15, 0, 0, 1])
  })
  it('returns null without heart rate', () => {
    expect(fitHrZones([], [{ timestamp: at(0) }, { timestamp: at(1) }], [90, 139, 156, 166, 173, 185])).toBeNull()
  })
})

describe('fitKmSplits', () => {
  it('splits by whole km with a partial last split', () => {
    // 2.5 km at 4 m/s, sampled every 10 s; climbs 1 m per sample in the second km.
    const recs: FitRecord[] = Array.from({ length: 64 }, (_, i) => ({
      timestamp: at(i * 10), distance: i * 40, heartRate: 140 + (i < 25 ? 0 : 10),
      altitude: i >= 25 && i < 50 ? 100 + (i - 25) : i < 25 ? 100 : 125,
    }))
    const s = fitKmSplits(recs)!
    expect(s.map(x => x.km)).toEqual([1, 2, 3])
    expect(s[0]).toMatchObject({ distanceM: 1000, seconds: 250, avgHr: 140 })
    expect(s[1].distanceM).toBe(1000)
    expect(s[1].elevationGainM).toBeGreaterThanOrEqual(20)
    expect(s[2].distanceM).toBe(520)
  })
  it('returns null under 1 km', () => {
    expect(fitKmSplits([{ timestamp: at(0), distance: 0 }, { timestamp: at(60), distance: 600 }])).toBeNull()
  })
})

describe('garminDailyRows', () => {
  it('merges steps, sleep and the morning readiness score by date', () => {
    const rows = garminDailyRows(
      [{ calendarDate: '2025-12-24', totalSteps: 2639, dailyStepGoal: 8000, totalDistanceMeters: 1769, activeKilocalories: 151, activeSeconds: 3000, highlyActiveSeconds: 120, restingHeartRate: 57,
        allDayStress: { aggregatorList: [{ type: 'ASLEEP', averageStressLevel: 20 }, { type: 'TOTAL', averageStressLevel: 45 }] } }],
      [{ calendarDate: '2025-12-24', deepSleepSeconds: 3660, lightSleepSeconds: 20820, remSleepSeconds: 3660, awakeSleepSeconds: 360, awakeCount: 1, averageRespiration: 13.72, sleepScores: { overallScore: 51 } },
       { calendarDate: '2025-12-20', deepSleepSeconds: 0, lightSleepSeconds: 0, remSleepSeconds: 0 }],
      [{ calendarDate: '2025-12-24', score: 40, inputContext: 'UPDATE', timestamp: '2025-12-24T12:00:00.0' },
       { calendarDate: '2025-12-24', score: 68, inputContext: 'AFTER_WAKEUP_RESET', timestamp: '2025-12-23T22:10:00.0' }],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      date: '2025-12-24', steps: 2639, step_goal: 8000, distance_m: 1769, active_calories: 151, active_min: 52, resting_hr: 57, stress_avg: 45,
      sleep_min: 469, deep_min: 61, light_min: 347, rem_min: 61, awake_min: 6, wake_count: 1, sleep_score: 51, resp_rate: 13.72, readiness: 68,
    })
  })
})
