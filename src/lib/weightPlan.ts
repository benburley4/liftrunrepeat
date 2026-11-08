// Weight-loss plan: a target weight over a number of weeks, turned into a weekly
// rate, a calorie target and a schedule. Saved in user_settings.weight_plan.

import { KCAL_PER_KG, shiftDay, weekStart, type BalanceDay } from './nutrition'

export const WEIGHT_PLAN_KEY = 'weight_plan'
export const MAX_PLAN_WEEKS = 104
const ON_TRACK_KG = 0.3

export interface WeightPlan {
  startDate: string
  startKg: number
  targetKg: number
  weeks: number
}

export function parsePlan(value: string | null): WeightPlan | null {
  if (!value) return null
  try {
    const p = JSON.parse(value) as Partial<WeightPlan>
    if (typeof p.startDate !== 'string' || !(Number(p.startKg) > 0) || !(Number(p.targetKg) > 0) || !(Number(p.weeks) > 0)) return null
    return { startDate: p.startDate, startKg: Number(p.startKg), targetKg: Number(p.targetKg), weeks: Number(p.weeks) }
  } catch { return null }
}

/** Why these inputs can't make a plan, or null if they can. */
export function planIssue(startKg: number | null, targetKg: number, weeks: number, startDate?: string, today?: string): string | null {
  if (startDate != null && today != null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return 'Pick a start date.'
    if (startDate > today) return 'The start date can’t be in the future.'
  }
  if (startKg == null) return 'A plan needs a scale reading to start from. Sync your scale first.'
  if (!(targetKg > 0)) return 'Enter your target weight.'
  if (targetKg >= startKg) return `Your target needs to be below your starting ${startKg.toFixed(1)} kg.`
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > MAX_PLAN_WEEKS) return `Enter a whole number of weeks, from 1 to ${MAX_PLAN_WEEKS}.`
  if (startDate != null && today != null && shiftDay(startDate, weeks * 7) <= today) return 'That plan would already have finished. Add weeks or pick a later start date.'
  return null
}

/** Smoothed weight on a date: the latest reading up to it, or the first one after if there's none before. */
export function trendOn<T extends { date: string }>(actual: T[], date: string): T | null {
  return actual.findLast(a => a.date <= date) ?? actual.find(a => a.date > date) ?? null
}

export type PlanPace = 'gentle' | 'steady' | 'fast'

/** Weekly loss as a % of starting weight -> pace band. */
export const paceFor = (pctPerWeek: number): PlanPace => (pctPerWeek <= 0.5 ? 'gentle' : pctPerWeek <= 1 ? 'steady' : 'fast')

export interface PlanNumbers {
  totalKg: number
  perWeekKg: number
  pctPerWeek: number             // weekly loss as a % of starting weight
  pace: PlanPace
  dailyDeficit: number
  calorieTarget: number | null   // null until burn is known; never below resting burn
  belowResting: boolean          // the plan's pace would need less than resting burn
  weeksAtResting: number | null  // shortest plan that stays at or above resting burn
}

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits

/** Rate and calories for a plan. burnKcal = recent average daily burn; bmrKcal = resting burn. */
export function planNumbers(plan: Pick<WeightPlan, 'startKg' | 'targetKg' | 'weeks'>, burnKcal: number | null, bmrKcal: number | null): PlanNumbers {
  const totalKg = plan.startKg - plan.targetKg
  const perWeekKg = totalKg / plan.weeks
  const pctPerWeek = perWeekKg / plan.startKg * 100
  const dailyDeficit = Math.round(perWeekKg * KCAL_PER_KG / 7 / 10) * 10
  const eat = burnKcal != null ? burnKcal - dailyDeficit : null
  const belowResting = eat != null && bmrKcal != null && eat < bmrKcal
  const room = burnKcal != null && bmrKcal != null ? burnKcal - bmrKcal : 0
  return {
    totalKg: round(totalKg, 1),
    perWeekKg: round(perWeekKg, 2),
    pctPerWeek: round(pctPerWeek, 2),
    pace: paceFor(pctPerWeek),
    dailyDeficit,
    calorieTarget: eat == null ? null : Math.round((belowResting ? bmrKcal! : eat) / 10) * 10,
    belowResting,
    weeksAtResting: belowResting && room > 0 ? Math.ceil(totalKg * KCAL_PER_KG / 7 / room) : null,
  }
}

export const planEndDate = (plan: WeightPlan) => shiftDay(plan.startDate, plan.weeks * 7)

/** True on the days the plan runs: from its start date up to, not including, its end date. */
export const planActiveOn = (plan: WeightPlan, date: string) => date >= plan.startDate && date < planEndDate(plan)

/** Average daily burn over recent completed days; today's is still in progress. */
export function recentBurn(balance: BalanceDay[], today: string, days = 28): number | null {
  const burned = balance.filter(d => d.date < today).slice(-days).flatMap(d => (d.burned != null ? [d.burned] : []))
  return burned.length ? Math.round(burned.reduce((a, b) => a + b, 0) / burned.length) : null
}

export interface WeekBudget {
  loggedDays: number          // finished plan days this week with meals logged
  unloggedDays: number        // finished plan days with nothing logged
  balanceKcal: number         // target − eaten across the logged days; positive = under
  restDays: number            // plan days left this week, including today
  restPerDay: number | null   // daily calories that would finish the week on target
  atFloor: boolean            // restPerDay stopped at resting burn
}

/**
 * The Monday-to-Sunday week containing `date`, counting plan days only. Days with
 * nothing logged are left out rather than treated as eating nothing, and today
 * stays out of the balance until it's over.
 */
export function weekBudget(
  plan: WeightPlan, intake: Map<string, { kcal: number }>, date: string, today: string, target: number, bmrKcal: number | null,
): WeekBudget {
  const monday = weekStart(date)
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(monday, i)).filter(d => planActiveOn(plan, d))
  const finished = days.filter(d => d < today)
  const logged = finished.filter(d => intake.has(d))
  const balanceKcal = Math.round(logged.reduce((a, d) => a + target - intake.get(d)!.kcal, 0))
  const restDays = days.length - finished.length
  const perDay = restDays ? target + balanceKcal / restDays : null
  const atFloor = perDay != null && bmrKcal != null && perDay < bmrKcal
  return {
    loggedDays: logged.length,
    unloggedDays: finished.length - logged.length,
    balanceKcal,
    restDays,
    restPerDay: perDay == null ? null : Math.round((atFloor ? bmrKcal! : perDay) / 10) * 10,
    atFloor,
  }
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

/** Where the plan says you should be on a date: a straight line, held at each end. */
export function planWeight(plan: WeightPlan, date: string): number {
  const total = plan.weeks * 7
  const day = Math.min(total, Math.max(0, daysBetween(plan.startDate, date)))
  return round(plan.startKg - (plan.startKg - plan.targetKg) * day / total, 1)
}

export interface TrendWeight { date: string; trendKg: number }

export interface PlanWeek { week: number; date: string; planKg: number; actualKg: number | null }

/** One row per week. Actual = the latest smoothed weight in the 7 days up to that date. */
export function planSchedule(plan: WeightPlan, actual: TrendWeight[], today: string): PlanWeek[] {
  return Array.from({ length: plan.weeks + 1 }, (_, week) => {
    const date = shiftDay(plan.startDate, week * 7)
    const from = shiftDay(date, -6)
    const hit = date > today ? undefined : actual.findLast(a => a.date >= from && a.date <= date)
    return { week, date, planKg: planWeight(plan, date), actualKg: hit?.trendKg ?? null }
  })
}

/** Days into the plan before loss per week is shown; earlier, water swings dominate. */
export const MIN_FIT_DAYS = 14
const MIN_FIT_READINGS = 7

/** Slope in kg per day of a least-squares line through dated readings. */
function slopePerDay(points: { date: string; kg: number }[]): number {
  const pts = points.map(p => ({ x: Date.parse(`${p.date}T00:00:00Z`) / 86_400_000, y: p.kg }))
  const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length
  return pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / pts.reduce((a, p) => a + (p.x - mx) ** 2, 0)
}

export interface PlanActuals {
  perWeekKg: number | null      // fitted loss per week since the start; negative = gaining; null before day 14
  pctPerWeek: number | null
  pace: PlanPace | 'gaining' | null
  dailyDeficit: number | null   // mean burned - eaten over logged plan days
  eaten: number | null          // mean kcal over logged plan days
  protein: number | null        // mean grams over logged plan days
  loggedDays: number            // finished plan days with meals logged
  planDay: number               // days since the plan started
}

/**
 * What has actually happened since the plan started, in the same terms as the
 * targets. Loss per week is the slope of a straight line through every daily
 * reading since the start (one per day, morning preferred), so no single heavy
 * or light morning sets it; it waits until day 14. Food averages use finished
 * plan days with meals logged; today is left out until it's over.
 */
export function planActuals(plan: WeightPlan, readings: { date: string; kg: number }[], balance: BalanceDay[], today: string): PlanActuals {
  const end = planEndDate(plan)
  const planDay = Math.max(0, daysBetween(plan.startDate, today))
  const since = readings.filter(r => r.date >= plan.startDate && r.date <= today && r.date < end)
  const fit = planDay >= MIN_FIT_DAYS && since.length >= MIN_FIT_READINGS
  const perWeekKg = fit ? round(-slopePerDay(since) * 7, 2) : null
  const pctPerWeek = perWeekKg != null ? round(perWeekKg / plan.startKg * 100, 2) : null
  const days = balance.filter(d => d.date >= plan.startDate && d.date < today && d.date < end && d.eaten != null)
  const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null)
  return {
    perWeekKg,
    pctPerWeek,
    pace: pctPerWeek == null ? null : pctPerWeek < 0 ? 'gaining' : paceFor(pctPerWeek),
    dailyDeficit: mean(days.flatMap(d => (d.deficit != null ? [d.deficit] : []))),
    eaten: mean(days.map(d => d.eaten!)),
    protein: mean(days.flatMap(d => (d.protein != null ? [d.protein] : []))),
    loggedDays: days.length,
    planDay,
  }
}

export interface PlanProgress {
  state: 'ahead' | 'on-track' | 'behind'
  expectedKg: number
  actualKg: number
  diffKg: number       // actual − expected; negative = ahead of the plan
  lostKg: number
  remainingKg: number
  daysLeft: number
}

/** How today compares with the plan, from the latest smoothed weight. */
export function planProgress(plan: WeightPlan, latest: TrendWeight | null, today: string): PlanProgress | null {
  if (!latest) return null
  const expectedKg = planWeight(plan, today)
  const diffKg = round(latest.trendKg - expectedKg, 1)
  return {
    state: Math.abs(diffKg) <= ON_TRACK_KG ? 'on-track' : diffKg < 0 ? 'ahead' : 'behind',
    expectedKg,
    actualKg: latest.trendKg,
    diffKg,
    lostKg: round(plan.startKg - latest.trendKg, 1),
    remainingKg: round(Math.max(0, latest.trendKg - plan.targetKg), 1),
    daysLeft: Math.max(0, daysBetween(today, planEndDate(plan))),
  }
}
