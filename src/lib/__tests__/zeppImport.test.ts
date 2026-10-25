import { describe, it, expect } from 'vitest'
import { mapZeppType, localDate, zeppKm, planZeppImport, ZeppWorkout, ExistingSession } from '../zeppImport'

const walk: ZeppWorkout = {
  workoutId: '100',
  workoutType: 'walking',
  startTime: '2026-10-25T04:37:45+00:00',
  endTime: '2026-10-25T07:16:45+00:00',
  distanceM: 10480,
  elevationGainM: 296,
  avgHr: 103,
  maxHr: 140,
  calories: 800,
}

const manualHike: ExistingSession = {
  savedAt: '2026-10-25T07:09:11.32+00:00',
  data: { type: 'hike', name: 'Outdoor Hike', date: '2026-10-25', savedAt: '2026-10-25T07:09:11.320Z', hikeKm: 10.5, hikeElevationM: 286, run: [], exercises: [] },
}

describe('mapZeppType', () => {
  it('maps walks and treadmill to hike, runs to run', () => {
    expect(mapZeppType('walking')).toEqual({ type: 'hike', name: 'Walk' })
    expect(mapZeppType('treadmill').type).toBe('hike')
    expect(mapZeppType('run').type).toBe('run')
  })
  it('falls back to hybrid with a readable name', () => {
    expect(mapZeppType('rowing_machine')).toEqual({ type: 'hybrid', name: 'Rowing Machine' })
  })
})

describe('localDate', () => {
  it('uses the local calendar day, not the UTC one', () => {
    expect(localDate('2026-10-22T22:44:49+00:00')).toBe('2026-10-23')
  })
})

describe('zeppKm', () => {
  it('converts metres and treats zero as missing', () => {
    expect(zeppKm(walk)).toBe(10.48)
    expect(zeppKm({ ...walk, distanceM: 0 })).toBeNull()
  })
})

describe('planZeppImport', () => {
  it('creates a new session when nothing was logged that day', () => {
    const [row] = planZeppImport([walk], [])
    expect(row.action).toBe('new')
    expect(row.savedAt).toBe(walk.startTime)
    expect(row.data).toMatchObject({ type: 'hike', name: 'Walk', date: '2026-10-25', source: 'zepp', hikeKm: 10.48, hikeElevationM: 296 })
    expect(row.data.zepp).toMatchObject({ workoutId: '100', durationMin: 159, avgHr: 103 })
  })

  it('enriches a manual hike on the same day and keeps the originals', () => {
    const [row] = planZeppImport([walk], [manualHike])
    expect(row.action).toBe('enrich')
    expect(row.savedAt).toBe(manualHike.savedAt)
    expect(row.data).toMatchObject({ name: 'Outdoor Hike', hikeKm: 10.48, hikeElevationM: 296 })
    expect(row.data.manualOriginal).toEqual({ hikeKm: 10.5, hikeElevationM: 286, distanceKm: null })
    expect(row.data.source).toBeUndefined()
  })

  it('is idempotent: a linked workout updates its row instead of matching again', () => {
    const [first] = planZeppImport([walk], [manualHike])
    const rows = planZeppImport([walk], [{ savedAt: first.savedAt, data: first.data }])
    expect(rows).toHaveLength(1)
    expect(rows[0].action).toBe('update')
    expect(rows[0].data.manualOriginal).toEqual({ hikeKm: 10.5, hikeElevationM: 286, distanceKm: null })
  })

  it('matches the closest-km workout and imports the others as numbered walks', () => {
    const short: ZeppWorkout = { ...walk, workoutId: '101', startTime: '2026-10-25T01:00:00+00:00', endTime: '2026-10-25T01:40:00+00:00', distanceM: 3900 }
    const shorter: ZeppWorkout = { ...walk, workoutId: '102', startTime: '2026-10-25T09:00:00+00:00', endTime: '2026-10-25T09:20:00+00:00', distanceM: 1200 }
    const rows = planZeppImport([short, walk, shorter], [manualHike])
    expect(rows.find(r => r.action === 'enrich')!.data.zepp).toMatchObject({ workoutId: '100' })
    const added = rows.filter(r => r.action === 'new').map(r => r.data.name)
    expect(added).toEqual(['Walk', 'Walk (2)'])
  })

  it('keeps a manual treadmill incline when the watch has no elevation', () => {
    const tread: ZeppWorkout = { ...walk, workoutType: 'treadmill', distanceM: 3600, elevationGainM: null }
    const manual: ExistingSession = { savedAt: 'x', data: { type: 'hike', name: 'Treadmill Hike', date: '2026-10-25', hikeKm: 3.6, hikeElevationM: 326 } }
    const [row] = planZeppImport([tread], [manual])
    expect(row.data).toMatchObject({ hikeKm: 3.6, hikeElevationM: 326 })
  })

  it('never matches a different session type (e.g. a lifting day)', () => {
    const lift: ExistingSession = { savedAt: 'y', data: { type: 'hybrid', name: 'Hybrid Session', date: '2026-10-25' } }
    const [row] = planZeppImport([walk], [lift])
    expect(row.action).toBe('new')
  })

  it('attaches a strength workout to a lifting day without touching the sets', () => {
    const strength: ZeppWorkout = { ...walk, workoutType: 'strength', distanceM: null, elevationGainM: null }
    const exercises = [{ id: 'ex-1', exerciseName: 'Sumo Deadlift', plannedSets: [], actualSets: [{ reps: '5', weight: '155', rpe: '' }] }]
    const hybrid: ExistingSession = { savedAt: 'h', data: { type: 'hybrid', name: 'Hybrid Session', date: '2026-10-25', exercises } }
    const [row] = planZeppImport([strength], [hybrid])
    expect(row.action).toBe('enrich')
    expect(row.data.exercises).toEqual(exercises)
    expect(row.data.hikeKm).toBeUndefined()
    expect(row.data.zepp).toMatchObject({ workoutType: 'strength', durationMin: 159, avgHr: 103 })
  })

  it('keeps the logged km when the watch only caught part of the outing', () => {
    const partial: ZeppWorkout = { ...walk, distanceM: 6560 }
    const manual: ExistingSession = { savedAt: 'p', data: { type: 'hike', name: 'Outdoor Hike', date: '2026-10-25', hikeKm: 12, hikeElevationM: 50 } }
    const [row] = planZeppImport([partial], [manual])
    expect(row.action).toBe('enrich')
    expect(row.data).toMatchObject({ hikeKm: 12, hikeElevationM: 50 })
    expect(row.data.manualOriginal).toBeUndefined()
    expect(row.data.zepp).toMatchObject({ distanceKm: 6.56, distanceMismatch: true, avgHr: 103 })
    // …and stays stats-only on re-runs.
    const [again] = planZeppImport([partial], [{ savedAt: 'p', data: row.data }])
    expect(again.data).toMatchObject({ hikeKm: 12, zepp: { distanceMismatch: true } })
  })

  it('treats a tiny walk on a hike day as a separate walk', () => {
    const tiny: ZeppWorkout = { ...walk, distanceM: 450 }
    const manual: ExistingSession = { savedAt: 't', data: { type: 'hike', name: 'Outdoor Hike', date: '2026-10-25', hikeKm: 4 } }
    const [row] = planZeppImport([tiny], [manual])
    expect(row.action).toBe('new')
  })

  it('skips auto-detected activity blocks', () => {
    const blip: ZeppWorkout = { ...walk, workoutType: 'activity', distanceM: 0 }
    expect(planZeppImport([blip], [])).toEqual([])
  })

  it('does not enrich sessions imported from another source', () => {
    const apple: ExistingSession = { savedAt: 'z', data: { type: 'hike', name: 'Hike', date: '2026-10-25', source: 'apple_health' } }
    const rows = planZeppImport([walk], [apple])
    expect(rows[0].action).toBe('new')
    expect(rows[0].data.name).toBe('Walk')
  })
})
