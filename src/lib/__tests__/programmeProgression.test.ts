import { describe, it, expect } from 'vitest'
import { isLowerBody, progressTemplate, fillForwardCycles, loggedSetsFor } from '../programmeProgression'
import type { Programme, StoredTemplate } from '../programmeTypes'

const row = (exerciseId: string, exerciseName: string, category: string, weights: string[]) => ({
  id: `ex-${exerciseId}`, exerciseId, exerciseName, category,
  sets: weights.map((w, i) => ({ id: `s${i}`, reps: '10', weight: w })),
})

const weights1: StoredTemplate = {
  id: 'tpl-w1', name: 'Weights 1', type: 'lift',
  exerciseRows: [
    row('sumo-deadlift', 'Sumo Deadlift', 'barbell', ['100', '150']),
    row('db-shoulder-press', 'Dumbbell Shoulder Press', 'dumbbell', ['22.5', '27.5']),
    row('custom-1', 'Single Leg Press', 'machine', ['45']),
    row('pullup', 'Pull-up', 'bodyweight', ['', '20']),
  ],
}
const hike: StoredTemplate = { id: 'tpl-h', name: 'Outdoor Hike', type: 'hike', exerciseRows: [] }

function weightsOf(t: StoredTemplate) {
  return (t.exerciseRows ?? []).map(r => r.sets.map(s => s.weight))
}

describe('isLowerBody', () => {
  it('uses library primary muscles', () => {
    expect(isLowerBody('sumo-deadlift', 'Sumo Deadlift')).toBe(true)
    expect(isLowerBody('rdl', 'Romanian Deadlift')).toBe(true)
    expect(isLowerBody('db-bench', 'Dumbbell Bench Press')).toBe(false)
    expect(isLowerBody('pullup', 'Pull-up')).toBe(false)
  })
  it('falls back to the name for custom exercises', () => {
    expect(isLowerBody('custom-1', 'Single Leg Press')).toBe(true)
    expect(isLowerBody('custom-2', 'Step downs')).toBe(true)
    expect(isLowerBody('custom-3', 'Cable Face Pull')).toBe(false)
  })
})

describe('progressTemplate', () => {
  it('adds 5 kg per cycle to legs, 2.5 kg to arms, leaves blanks alone', () => {
    expect(weightsOf(progressTemplate(weights1, 1))).toEqual([['105', '155'], ['25', '30'], ['50'], ['', '22.5']])
    expect(weightsOf(progressTemplate(weights1, 2))).toEqual([['110', '160'], ['27.5', '32.5'], ['55'], ['', '25']])
  })
  it('goes by equipment first: barbell +5 even for upper body, dumbbell +2.5 even for legs', () => {
    const t: StoredTemplate = {
      id: 't', name: 'T', type: 'lift',
      exerciseRows: [
        row('bench', 'Bench Press', 'barbell', ['70']),
        row('custom-2', 'Step downs', 'dumbbell', ['10']),
      ],
    }
    expect(weightsOf(progressTemplate(t, 1))).toEqual([['75'], ['12.5']])
  })
  it('does not mutate the source', () => {
    progressTemplate(weights1, 1)
    expect(weights1.exerciseRows![0].sets[0].weight).toBe('100')
  })
})

describe('fillForwardCycles', () => {
  const prog: Programme = {
    id: 'p', name: 'P', weeks: 12, startDate: '2026-10-19',
    cells: {
      w0d0: { rpe: 0, template: weights1 }, w0d5: { rpe: 0, template: hike },
      w1d0: { rpe: 0, template: progressTemplate(weights1, 0) },
      w2d0: { rpe: 0, template: weights1 },
      w3d0: { rpe: 0, template: weights1 },
      w4d0: { rpe: 7, template: hike }, w4d3: { rpe: 0, template: hike },
    },
    deloads: { '3': { pct: 60, backup: {} }, '7': { pct: 60, backup: {} }, '11': { pct: 60, backup: {} } },
  }

  it('copies weeks 1-3 into 5-7 and 9-11 with one increment per cycle, skipping deloads', () => {
    const { cells, weeksFilled } = fillForwardCycles(prog)
    expect(weeksFilled).toEqual([4, 5, 6, 8, 9, 10])
    expect(weightsOf(cells.w4d0.template)[0]).toEqual(['105', '155'])
    expect(weightsOf(cells.w8d0.template)[0]).toEqual(['110', '160'])
    expect(cells.w4d5.template.name).toBe('Outdoor Hike')
    expect(cells.w3d0).toBe(prog.cells.w3d0) // deload week untouched
    expect(cells.w7d0).toBeUndefined()
  })

  it('replaces the target week rather than merging into it', () => {
    const { cells } = fillForwardCycles(prog)
    expect(cells.w4d3).toBeUndefined()
    expect(cells.w4d0.rpe).toBe(0)
  })
})

describe('loggedSetsFor', () => {
  const sessions = [
    { name: 'Weights 1', date: '2026-10-19', exercises: [{ exerciseName: 'Sumo Deadlift', actualSets: [{ reps: '6', weight: '150' }] }] },
    { name: 'Outdoor Hike', date: '2026-10-19' },
  ]
  it('matches on date and session name', () => {
    expect(loggedSetsFor(sessions, '2026-10-19', 'weights 1')?.get('sumo deadlift')).toEqual([{ reps: '6', weight: '150' }])
    expect(loggedSetsFor(sessions, '2026-10-20', 'Weights 1')).toBeNull()
  })
})
