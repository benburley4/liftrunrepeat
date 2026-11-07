import { describe, expect, it } from 'vitest'
import { parsePlan, planEndDate, planIssue, planNumbers, planProgress, planSchedule, planWeight, type WeightPlan } from '../weightPlan'

const plan: WeightPlan = { startDate: '2026-11-02', startKg: 96, targetKg: 90, weeks: 12 }

describe('parsePlan', () => {
  it('reads a saved plan', () => {
    expect(parsePlan(JSON.stringify(plan))).toEqual(plan)
  })

  it('ignores missing or damaged plans', () => {
    expect(parsePlan(null)).toBeNull()
    expect(parsePlan('not json')).toBeNull()
    expect(parsePlan(JSON.stringify({ ...plan, weeks: 0 }))).toBeNull()
  })
})

describe('planIssue', () => {
  it('accepts a target below current weight', () => {
    expect(planIssue(96, 90, 12)).toBeNull()
  })

  it('needs a starting weight, a lower target and sensible weeks', () => {
    expect(planIssue(null, 90, 12)).toMatch(/scale reading/)
    expect(planIssue(96, 0, 12)).toMatch(/target weight/)
    expect(planIssue(96, 97, 12)).toMatch(/below your current 96.0/)
    expect(planIssue(96, 90, 0)).toMatch(/whole number/)
    expect(planIssue(96, 90, 1.5)).toMatch(/whole number/)
    expect(planIssue(96, 90, 105)).toMatch(/whole number/)
  })
})

describe('planNumbers', () => {
  it('turns a target into a weekly rate and daily deficit', () => {
    expect(planNumbers(plan, 2800, 2000)).toMatchObject({
      totalKg: 6, perWeekKg: 0.5, pctPerWeek: 0.52, pace: 'steady', dailyDeficit: 550, calorieTarget: 2250, belowResting: false,
    })
  })

  it('grades the pace against bodyweight', () => {
    expect(planNumbers({ ...plan, weeks: 24 }, null, null).pace).toBe('gentle')
    expect(planNumbers({ ...plan, weeks: 4 }, null, null).pace).toBe('fast')
  })

  it('has no calorie target until burn is known', () => {
    expect(planNumbers(plan, null, 2000).calorieTarget).toBeNull()
  })

  it('never sets calories below resting burn, and says how long would work', () => {
    const n = planNumbers({ ...plan, weeks: 4 }, 2800, 2000)
    expect(n).toMatchObject({ calorieTarget: 2000, belowResting: true, weeksAtResting: 9 })
  })
})

describe('planWeight', () => {
  it('runs in a straight line and holds at each end', () => {
    expect(planEndDate(plan)).toBe('2027-01-25')
    expect(planWeight(plan, '2026-11-02')).toBe(96)
    expect(planWeight(plan, '2026-12-14')).toBe(93)
    expect(planWeight(plan, '2026-10-01')).toBe(96)
    expect(planWeight(plan, '2027-06-01')).toBe(90)
  })
})

describe('planSchedule', () => {
  it('lists every week, with actuals only up to today', () => {
    const rows = planSchedule(plan, [{ date: '2026-11-08', trendKg: 95.6 }], '2026-11-10')
    expect(rows).toHaveLength(13)
    expect(rows[1]).toEqual({ week: 1, date: '2026-11-09', planKg: 95.5, actualKg: 95.6 })
    expect(rows[2].actualKg).toBeNull()
  })

  it('leaves a week blank with no weigh-in near it', () => {
    expect(planSchedule(plan, [{ date: '2026-11-01', trendKg: 96 }], '2026-11-20')[2].actualKg).toBeNull()
  })
})

describe('planProgress', () => {
  it('compares the latest trend with where the plan says to be', () => {
    expect(planProgress(plan, { date: '2026-12-14', trendKg: 92 }, '2026-12-14')).toMatchObject({
      state: 'ahead', expectedKg: 93, diffKg: -1, lostKg: 4, remainingKg: 2, daysLeft: 42,
    })
    expect(planProgress(plan, { date: '2026-12-14', trendKg: 94 }, '2026-12-14')?.state).toBe('behind')
    expect(planProgress(plan, { date: '2026-12-14', trendKg: 93.2 }, '2026-12-14')?.state).toBe('on-track')
  })

  it('needs a weight to compare', () => {
    expect(planProgress(plan, null, '2026-12-14')).toBeNull()
  })
})
