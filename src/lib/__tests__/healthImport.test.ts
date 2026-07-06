import { describe, it, expect } from 'vitest'
import { mapWorkout, parseDate, parseKm, parseElevationM, workoutToSession, AppleWorkout } from '../healthImport'

const base: AppleWorkout = {
  workoutActivityType: 'HKWorkoutActivityTypeRunning',
  startDate: '2026-03-30 07:00:00 +0800',
  endDate: '2026-03-30 07:45:00 +0800',
  duration: '45.3 min',
}

describe('parseDate', () => {
  it('extracts YYYY-MM-DD from Health Auto Export format', () => {
    expect(parseDate('2026-03-30 07:00:00 +0800')).toBe('2026-03-30')
  })
  it('falls back to first 10 chars for unexpected formats', () => {
    expect(parseDate('30/03/2026 07:00')).toBe('30/03/2026')
  })
})

describe('parseKm', () => {
  it('handles km units', () => {
    expect(parseKm({ ...base, totalDistance: { qty: 10.234, units: 'km' } })).toBe(10.23)
  })
  it('converts miles to km', () => {
    expect(parseKm({ ...base, totalDistance: { qty: 5, units: 'mi' } })).toBeCloseTo(8.05, 2)
  })
  it('converts metres to km', () => {
    expect(parseKm({ ...base, totalDistance: { qty: 5000, units: 'm' } })).toBe(5)
  })
  it('returns null when distance is missing or zero', () => {
    expect(parseKm(base)).toBeNull()
    expect(parseKm({ ...base, totalDistance: { qty: 0, units: 'km' } })).toBeNull()
  })
})

describe('parseElevationM', () => {
  it('converts feet to metres', () => {
    expect(parseElevationM({ ...base, elevation: { ascent: { qty: 1000, units: 'ft' } } })).toBe(305)
  })
  it('passes through metres', () => {
    expect(parseElevationM({ ...base, elevation: { ascent: { qty: 450, units: 'm' } } })).toBe(450)
  })
  it('returns null when absent', () => {
    expect(parseElevationM(base)).toBeNull()
  })
})

describe('mapWorkout', () => {
  it('maps running to run', () => {
    expect(mapWorkout(base)).toEqual({ type: 'run', name: 'Run' })
  })
  it('maps cycling to a distinct cycle type (not run)', () => {
    expect(mapWorkout({ ...base, workoutActivityType: 'HKWorkoutActivityTypeCycling' }).type).toBe('cycle')
  })
  it('maps swimming to a distinct swim type (not run)', () => {
    expect(mapWorkout({ ...base, workoutActivityType: 'HKWorkoutActivityTypeSwimming' }).type).toBe('swim')
  })
  it('falls back to hybrid for unknown types', () => {
    expect(mapWorkout({ ...base, workoutActivityType: 'HKWorkoutActivityTypeYoga' }).type).toBe('hybrid')
  })
})

describe('workoutToSession', () => {
  it('builds a run session with an ISO savedAt and a distance segment', () => {
    const s = workoutToSession({ ...base, totalDistance: { qty: 8, units: 'km' } })
    expect(s.type).toBe('run')
    expect(s.date).toBe('2026-03-30')
    expect(s.savedAt).toBe('2026-03-30T07:00:00+08:00')
    const run = s.run as { actualValue: string; id: string }[]
    expect(run).toHaveLength(1)
    expect(run[0].actualValue).toBe('8')
  })

  it('gives run segments unique ids across a batch', () => {
    const a = workoutToSession({ ...base, totalDistance: { qty: 5, units: 'km' } })
    const b = workoutToSession({ ...base, totalDistance: { qty: 5, units: 'km' } })
    const idA = (a.run as { id: string }[])[0].id
    const idB = (b.run as { id: string }[])[0].id
    expect(idA).not.toBe(idB)
  })

  it('stores hike distance and elevation on dedicated fields', () => {
    const s = workoutToSession({
      ...base,
      workoutActivityType: 'HKWorkoutActivityTypeHiking',
      totalDistance: { qty: 12, units: 'km' },
      elevation: { ascent: { qty: 600, units: 'm' } },
    })
    expect(s.type).toBe('hike')
    expect(s.hikeKm).toBe(12)
    expect(s.hikeElevationM).toBe(600)
    expect(s.run).toEqual([])
  })

  it('keeps cycle distance out of run segments', () => {
    const s = workoutToSession({
      ...base,
      workoutActivityType: 'HKWorkoutActivityTypeCycling',
      totalDistance: { qty: 40, units: 'km' },
    })
    expect(s.type).toBe('cycle')
    expect(s.run).toEqual([])
    expect(s.distanceKm).toBe(40)
  })
})
