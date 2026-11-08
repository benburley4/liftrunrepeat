import { describe, expect, it } from 'vitest'
import { parsePlan, planActiveOn, planActuals, planEndDate, planIssue, planNumbers, planProgress, planSchedule, planWeight, recentBurn, trendOn, weekBudget, type WeightPlan } from '../weightPlan'
import type { BalanceDay } from '../nutrition'

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
    expect(planIssue(96, 97, 12)).toMatch(/below your starting 96.0/)
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

describe('planActiveOn', () => {
  it('covers the start date up to, not including, the end date', () => {
    expect(planActiveOn(plan, '2026-11-01')).toBe(false)
    expect(planActiveOn(plan, '2026-11-02')).toBe(true)
    expect(planActiveOn(plan, '2027-01-24')).toBe(true)
    expect(planActiveOn(plan, '2027-01-25')).toBe(false)
  })
})

describe('recentBurn', () => {
  const day = (date: string, burned: number | null) => ({ date, burned }) as BalanceDay

  it('averages finished days only', () => {
    expect(recentBurn([day('2026-11-05', 2800), day('2026-11-06', 2600), day('2026-11-07', 900)], '2026-11-07')).toBe(2700)
  })

  it('uses the most recent days, skipping gaps', () => {
    expect(recentBurn([day('2026-11-04', 9000), day('2026-11-05', 2800), day('2026-11-06', null)], '2026-11-07', 2)).toBe(2800)
  })

  it('is null with no burn data', () => {
    expect(recentBurn([], '2026-11-07')).toBeNull()
  })
})

describe('weekBudget', () => {
  // 2 Nov 2026 is a Monday and the plan's first day.
  const eaten = (entries: [string, number][]) => new Map(entries.map(([d, kcal]) => [d, { kcal }]))

  it('balances finished logged days and spreads it over the days left', () => {
    const w = weekBudget(plan, eaten([['2026-11-02', 2000], ['2026-11-03', 2100], ['2026-11-04', 1900]]), '2026-11-05', '2026-11-05', 2200, 1800)
    expect(w).toEqual({ loggedDays: 3, unloggedDays: 0, balanceKcal: 600, restDays: 4, restPerDay: 2350, atFloor: false })
  })

  it('reads overeating as a smaller allowance', () => {
    const w = weekBudget(plan, eaten([['2026-11-02', 3000]]), '2026-11-03', '2026-11-03', 2200, 1800)
    expect(w).toMatchObject({ balanceKcal: -800, restDays: 6, restPerDay: 2070 })
  })

  it("doesn't treat an unlogged day as eating nothing", () => {
    const w = weekBudget(plan, eaten([['2026-11-02', 2200]]), '2026-11-04', '2026-11-04', 2200, 1800)
    expect(w).toMatchObject({ loggedDays: 1, unloggedDays: 1, balanceKcal: 0, restPerDay: 2200 })
  })

  it('leaves today out of the balance while it is in progress', () => {
    expect(weekBudget(plan, eaten([['2026-11-03', 5000]]), '2026-11-03', '2026-11-03', 2200, 1800).balanceKcal).toBe(0)
  })

  it('stops at resting burn', () => {
    const w = weekBudget(plan, eaten([['2026-11-07', 6000]]), '2026-11-08', '2026-11-08', 2200, 1800)
    expect(w).toMatchObject({ restDays: 1, restPerDay: 1800, atFloor: true })
  })

  it('has no days left in a finished week', () => {
    const w = weekBudget(plan, eaten([['2026-11-02', 2000]]), '2026-11-03', '2026-11-20', 2200, 1800)
    expect(w).toMatchObject({ restDays: 0, restPerDay: null, unloggedDays: 6, balanceKcal: 200 })
  })

  it('counts only days inside the plan', () => {
    const late = { ...plan, startDate: '2026-11-05' }
    const w = weekBudget(late, eaten([['2026-11-02', 9000], ['2026-11-05', 2000]]), '2026-11-06', '2026-11-06', 2200, 1800)
    expect(w).toMatchObject({ loggedDays: 1, balanceKcal: 200, restDays: 3 })
  })
})

describe('plan start date', () => {
  it('allows a past start date but not a future or already-finished one', () => {
    expect(planIssue(96, 93, 5, '2026-11-02', '2026-11-08')).toBeNull()
    expect(planIssue(96, 93, 5, '2026-11-09', '2026-11-08')).toMatch(/future/)
    expect(planIssue(96, 93, 1, '2026-10-01', '2026-11-08')).toMatch(/already have finished/)
    expect(planIssue(96, 93, 5, '', '2026-11-08')).toMatch(/start date/)
  })

  it('takes the smoothed weight on the start date, or the first one after it', () => {
    const actual = [{ date: '2026-11-01', trendKg: 96.4 }, { date: '2026-11-03', trendKg: 96.1 }, { date: '2026-11-07', trendKg: 95.6 }]
    expect(trendOn(actual, '2026-11-02')?.trendKg).toBe(96.4)
    expect(trendOn(actual, '2026-11-03')?.trendKg).toBe(96.1)
    expect(trendOn(actual, '2026-10-20')?.trendKg).toBe(96.4)
    expect(trendOn([], '2026-11-02')).toBeNull()
  })
})

describe('planActuals', () => {
  const plan: WeightPlan = { startDate: '2026-11-02', startKg: 96, targetKg: 93, weeks: 5 }
  const day = (date: string, eaten: number | null, deficit: number | null, protein: number | null) =>
    ({ date, eaten, deficit, protein }) as BalanceDay

  it('averages loss since the start and food over finished logged plan days', () => {
    const balance = [
      day('2026-11-01', 3000, -500, 100), // before the plan
      day('2026-11-02', 2400, 700, 170),
      day('2026-11-03', null, null, null), // nothing logged
      day('2026-11-04', 2200, 900, 180),
      day('2026-11-08', 500, 2500, 30), // today, still in progress
    ]
    const a = planActuals(plan, { date: '2026-11-07', trendKg: 95.5 }, balance, '2026-11-08')
    expect(a).toMatchObject({ perWeekKg: 0.7, pace: 'steady', dailyDeficit: 800, eaten: 2300, protein: 175, loggedDays: 2 })
  })

  it('shows gaining, and nothing before there is data', () => {
    expect(planActuals(plan, { date: '2026-11-09', trendKg: 96.7 }, [], '2026-11-09').pace).toBe('gaining')
    expect(planActuals(plan, { date: '2026-11-02', trendKg: 96 }, [], '2026-11-02')).toMatchObject({ perWeekKg: null, pace: null, eaten: null, loggedDays: 0 })
  })
})
