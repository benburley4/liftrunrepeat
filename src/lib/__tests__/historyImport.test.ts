import { describe, it, expect } from 'vitest'
import {
  garminToWorkout, garminOffsetMin, offsetZone, parseStrongCsv, strongSessionName, strongToSession, GarminActivity,
} from '../historyImport'
import { planZeppImport } from '../zeppImport'

const run: GarminActivity = {
  activityId: 17347847410, activityType: 'running',
  startTimeGmt: Date.UTC(2024, 9, 22, 10, 31, 9), startTimeLocal: Date.UTC(2024, 9, 22, 18, 31, 9),
  elapsedDuration: 3807125.9, movingDuration: 3802352.9, distance: 800610.0, elevationGain: 1583,
  avgHr: 149, maxHr: 157, calories: 2870.16, steps: 10420, avgDoubleCadence: 164.5, avgStrideLength: 77,
  aerobicTrainingEffect: 3.3, anaerobicTrainingEffect: 0, activityTrainingLoad: 99.9,
}

const CSV = `Date,Workout Name,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,RPE
23/11/2023 17:13,22-11-23 Wednesday,Romanian Deadlift (Barbell),1,150,8,0,0,
23/11/2023 17:13,22-11-23 Wednesday,Romanian Deadlift (Barbell),2,150,8,0,0,
23/11/2023 17:13,22-11-23 Wednesday,Pull Up,1,0,10,0,0,8
4/12/2023 7:00,XX Monday ,Squat (Barbell),1,110.5,5,0,0,`

describe('garminToWorkout', () => {
  it('converts export units (cm, ms, kJ) to the Zepp workout shape', () => {
    const w = garminToWorkout(run)
    expect(w.workoutId).toBe('garmin-17347847410')
    expect(w.workoutType).toBe('run')
    expect(w.startTime).toBe('2024-10-22T10:31:09+00:00')
    expect(w.endTime).toBe('2024-10-22T11:34:36+00:00')
    expect(w.distanceM).toBeCloseTo(8006.1)
    expect(w.elevationGainM).toBeCloseTo(15.83)
    expect(w.calories).toBe(686)
    expect(w.movingSeconds).toBe(3802)
    expect(w.anaerobicTrainingEffect).toBeNull()
    expect(w.avgCadenceSpm).toBe(164.5)
  })

  it('maps types and keeps unknown ones for the planner to name', () => {
    expect(garminToWorkout({ ...run, activityType: 'treadmill_running' }).workoutType).toBe('indoor_running')
    expect(garminToWorkout({ ...run, activityType: 'strength_training' }).workoutType).toBe('strength')
    expect(garminToWorkout({ ...run, activityType: 'indoor_rowing' }).workoutType).toBe('indoor_rowing')
  })

  it('derives the local offset', () => {
    expect(garminOffsetMin(run)).toBe(480)
    expect(offsetZone(480)).toBe('+08:00')
    expect(offsetZone(-330)).toBe('-05:30')
  })
})

describe('Strong CSV', () => {
  it('groups sets into sessions and maps exercise names', () => {
    const [a, b] = parseStrongCsv(CSV)
    expect(a.date).toBe('2023-11-23')
    expect(a.name).toBe('Wednesday')
    expect(a.exercises.map(e => e.exerciseName)).toEqual(['Romanian Deadlift', 'Pull-up'])
    expect(a.exercises[0].sets).toEqual([{ weight: '150', reps: '8', rpe: '' }, { weight: '150', reps: '8', rpe: '' }])
    expect(a.exercises[1].sets[0].rpe).toBe('8')
    expect(b.localStart).toBe('2023-12-04T07:00')
    expect(b.exercises[0]).toEqual({ exerciseName: 'Back Squat', sets: [{ weight: '110.5', reps: '5', rpe: '' }] })
  })

  it('strips date / XX prefixes from workout names', () => {
    expect(strongSessionName('22-11-23 Wednesday ')).toBe('Wednesday')
    expect(strongSessionName('XX Monday')).toBe('Monday')
    expect(strongSessionName('Wednesday (on a Monday)')).toBe('Wednesday (on a Monday)')
    expect(strongSessionName(' ')).toBe('Strength')
  })

  it('keeps Strong sets and attaches Garmin stats from the same day', () => {
    const strong = strongToSession(parseStrongCsv(CSV)[0], 480)
    expect(strong.savedAt).toBe('2023-11-23T09:13:00+00:00')
    const lift = garminToWorkout({ ...run, activityId: 1, activityType: 'strength_training', distance: 0,
      startTimeGmt: Date.UTC(2023, 10, 23, 10, 41), startTimeLocal: Date.UTC(2023, 10, 23, 18, 41) })
    const plan = planZeppImport([lift], [{ savedAt: strong.savedAt as string, data: strong }], { timeZone: '+08:00' })
    expect(plan).toHaveLength(1)
    expect(plan[0].action).toBe('enrich')
    expect(plan[0].data.exercises).toEqual(strong.exercises)
    expect((plan[0].data.zepp as { workoutId: string }).workoutId).toBe('garmin-1')
  })
})
