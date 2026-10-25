import { describe, it, expect } from 'vitest'
import { defaultVolumeMultiplier, resolveVolumeMultiplier, exerciseVolume } from '../exerciseLoad'
import { bestLoggedE1RMs, pctOfBest } from '../trainingMaxes'
import { computeStats } from '../computeStats'

describe('defaultVolumeMultiplier', () => {
  it('doubles two-dumbbell lifts (category given or from the library)', () => {
    expect(defaultVolumeMultiplier('Dumbbell Shoulder Press', 'dumbbell')).toBe(2)
    expect(defaultVolumeMultiplier('Dumbbell Bench Press')).toBe(2)
  })
  it('doubles single-leg / single-arm work (reps per side)', () => {
    expect(defaultVolumeMultiplier('Single Leg Press', 'machine')).toBe(2)
    expect(defaultVolumeMultiplier('Single-Arm Cable Row', 'cable')).toBe(2)
  })
  it('quadruples single-leg work holding dumbbells', () => {
    expect(defaultVolumeMultiplier('Step downs', 'dumbbell')).toBe(4)
  })
  it('leaves barbell and machine bilateral lifts alone', () => {
    expect(defaultVolumeMultiplier('Sumo Deadlift', 'barbell')).toBe(1)
    expect(defaultVolumeMultiplier('Leg Press', 'machine')).toBe(1)
  })
})

describe('resolveVolumeMultiplier / exerciseVolume', () => {
  it('a user override wins, matched case-insensitively', () => {
    expect(resolveVolumeMultiplier('Step downs', 'dumbbell', { 'step downs': 2 })).toBe(2)
  })
  it('multiplies weight × reps', () => {
    const sets = [{ weight: '27.5', reps: '10' }, { weight: '', reps: '10' }]
    expect(exerciseVolume('Dumbbell Shoulder Press', sets, {}, 'dumbbell')).toBe(550)
    expect(exerciseVolume('Dumbbell Shoulder Press', sets, { 'dumbbell shoulder press': 1 }, 'dumbbell')).toBe(275)
  })
})

describe('bestLoggedE1RMs / pctOfBest', () => {
  const sessions = [
    { exercises: [{ exerciseName: 'Sumo Deadlift', actualSets: [{ weight: '150', reps: '6' }, { weight: '100', reps: '15' }] }] },
    { exercises: [{ exerciseName: 'sumo deadlift', actualSets: [{ weight: '140', reps: '8' }] }] },
  ]
  it('keeps the best Epley e1RM per exercise, ignoring sets over 10 reps', () => {
    // 150×6 → 180, 140×8 → 177; 100×15 (→150) is excluded anyway
    expect(bestLoggedE1RMs(sessions).get('sumo deadlift')).toBe(180)
  })
  it('expresses planned weight as % of best', () => {
    expect(pctOfBest('135', 180)).toBe(75)
    expect(pctOfBest('', 180)).toBeNull()
    expect(pctOfBest('100', undefined)).toBeNull()
  })
})

describe('computeStats volume multipliers', () => {
  it('applies multipliers to weekly volume', () => {
    const s = {
      type: 'lift', name: 'W', date: '2026-10-19', savedAt: '2026-10-19T10:00:00Z',
      exercises: [{ id: 'e', exerciseName: 'Dumbbell Bench Press', plannedSets: [], actualSets: [{ reps: '10', weight: '30', rpe: '' }] }],
    }
    expect(computeStats([s], '2026-10-25').overview.volumeThisWeek).toBe(600)
    expect(computeStats([s], '2026-10-25', { 'dumbbell bench press': 1 }).overview.volumeThisWeek).toBe(300)
  })
})
