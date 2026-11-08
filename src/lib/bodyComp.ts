// Body-composition charts: Renpho readings → one comparable reading per day →
// week / month averages for long ranges.

import type { BodyReading } from './renpho'
import { shiftDay, weekStart, type BucketSize } from './nutrition'

export type BodyMetricKey =
  | 'body_fat_pct' | 'fat_mass_kg' | 'fat_free_kg' | 'lean_mass_kg' | 'muscle_pct' | 'visceral_fat'
  | 'subcutaneous_fat_pct' | 'water_pct' | 'protein_pct' | 'bone_kg' | 'bmr_kcal' | 'body_age' | 'bmi'

export type BodyDay = { date: string } & Record<BodyMetricKey, number | null>

export interface BodyMetric { key: BodyMetricKey; label: string; unit: string; digits: number; note: string }

/** Small-multiple charts, in reading order. fat_mass_kg is charted in the stacked split. */
export const BODY_METRICS: BodyMetric[] = [
  { key: 'body_fat_pct', label: 'Body fat', unit: '%', digits: 1, note: 'Share of your weight that is fat' },
  { key: 'fat_free_kg', label: 'Fat-free mass', unit: ' kg', digits: 1, note: 'Everything except fat' },
  { key: 'lean_mass_kg', label: 'Lean mass', unit: ' kg', digits: 1, note: 'Fat-free mass minus bone' },
  { key: 'muscle_pct', label: 'Muscle', unit: '%', digits: 1, note: 'Skeletal muscle as a share of weight' },
  { key: 'visceral_fat', label: 'Visceral fat', unit: '', digits: 1, note: 'Scale index for fat around the organs' },
  { key: 'subcutaneous_fat_pct', label: 'Subcutaneous fat', unit: '%', digits: 1, note: 'Fat under the skin' },
  { key: 'water_pct', label: 'Body water', unit: '%', digits: 1, note: 'Moves with hydration, food and training' },
  { key: 'protein_pct', label: 'Protein', unit: '%', digits: 1, note: 'Share of your weight that is protein' },
  { key: 'bone_kg', label: 'Bone mass', unit: ' kg', digits: 2, note: 'Estimated, so expect little change' },
  { key: 'bmr_kcal', label: 'BMR', unit: ' kcal', digits: 0, note: 'Resting burn, as the scale estimates it' },
  { key: 'body_age', label: 'Body age', unit: ' yrs', digits: 0, note: 'Scale estimate from your composition' },
  { key: 'bmi', label: 'BMI', unit: '', digits: 1, note: 'Weight for height; ignores muscle' },
]

/** Fitted change across a range smaller than this reads as "Steady": it's scale noise. */
export const TREND_FLAT: Record<BodyMetricKey, number> = {
  body_fat_pct: 0.2, fat_mass_kg: 0.3, fat_free_kg: 0.3, lean_mass_kg: 0.3, muscle_pct: 0.2, visceral_fat: 0.3,
  subcutaneous_fat_pct: 0.2, water_pct: 0.2, protein_pct: 0.1, bone_kg: 0.03, bmr_kcal: 10, body_age: 0.5, bmi: 0.1,
}
export const WEIGHT_FLAT_KG = 0.3

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits

/** Which reading stands for the day. */
export type DayPick = 'first' | 'lowest'

/**
 * One reading per day with composition data: by default the first of the day,
 * because impedance estimates move with food and water and first-thing readings
 * compare best. 'lowest' takes the lightest reading of the day instead.
 */
export function dailyBody(readings: BodyReading[], pick: DayPick = 'first'): BodyDay[] {
  const chosen = new Map<string, BodyReading>()
  for (const r of readings) {
    if (r.body_fat_pct == null) continue
    const cur = chosen.get(r.date)
    const earlier = !cur || r.measured_at < cur.measured_at
    const better = !cur || (pick === 'first' ? earlier
      : r.weight_kg < cur.weight_kg || (r.weight_kg === cur.weight_kg && earlier))
    if (better) chosen.set(r.date, r)
  }
  return [...chosen.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(r => ({
      date: r.date,
      body_fat_pct: r.body_fat_pct,
      fat_mass_kg: round(r.weight_kg * r.body_fat_pct! / 100, 1),
      fat_free_kg: r.fat_free_kg,
      lean_mass_kg: r.lean_mass_kg,
      muscle_pct: r.muscle_pct,
      visceral_fat: r.visceral_fat,
      subcutaneous_fat_pct: r.subcutaneous_fat_pct,
      water_pct: r.water_pct,
      protein_pct: r.protein_pct,
      bone_kg: r.bone_kg,
      bmr_kcal: r.bmr_kcal,
      body_age: r.body_age,
      bmi: r.bmi,
    }))
}

const KEYS: BodyMetricKey[] = ['fat_mass_kg', ...BODY_METRICS.map(m => m.key)]

/** Averages per week or month (each metric over the days that have it); days pass through. */
export function bucketBody(days: BodyDay[], size: BucketSize): BodyDay[] {
  if (size === 'day') return days
  const groups = new Map<string, BodyDay[]>()
  for (const d of days) {
    const start = size === 'week' ? weekStart(d.date) : `${d.date.slice(0, 7)}-01`
    if (!groups.has(start)) groups.set(start, [])
    groups.get(start)!.push(d)
  }
  return [...groups].map(([date, group]) => {
    const out = { date } as BodyDay
    for (const key of KEYS) {
      const values = group.map(d => d[key]).filter((v): v is number => v != null)
      out[key] = values.length ? round(values.reduce((a, b) => a + b, 0) / values.length, 2) : null
    }
    return out
  })
}

/** Lowest reading of each day, in the shape weightTrend takes. */
export function lowestWeights(readings: BodyReading[]): { date: string; weightKg: number; morningKg: number }[] {
  const lowest = new Map<string, number>()
  for (const r of readings) lowest.set(r.date, Math.min(lowest.get(r.date) ?? Infinity, r.weight_kg))
  return [...lowest]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, kg]) => ({ date, weightKg: kg, morningKg: kg }))
}

export interface TrendPoint { date: string; value: number | null }

export interface Trend {
  direction: 'up' | 'down' | 'flat'
  perWeek: number    // best-fit change per week
  total: number      // best-fit change from the first reading to the last
}

const MIN_TREND_POINTS = 3
const MIN_TREND_DAYS = 7
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000

/**
 * Least-squares line through the points. A straight fit rather than last minus
 * first, so one heavy or light morning at either end doesn't set the answer.
 * Null with too little data to call a direction.
 */
export function linearTrend(points: TrendPoint[], flatWithin: number): Trend | null {
  const pts = points.filter((p): p is { date: string; value: number } => p.value != null)
    .map(p => ({ x: dayNumber(p.date), y: p.value }))
  if (pts.length < MIN_TREND_POINTS) return null
  const span = pts[pts.length - 1].x - pts[0].x
  if (span < MIN_TREND_DAYS) return null
  const meanX = pts.reduce((a, p) => a + p.x, 0) / pts.length
  const meanY = pts.reduce((a, p) => a + p.y, 0) / pts.length
  const slope = pts.reduce((a, p) => a + (p.x - meanX) * (p.y - meanY), 0)
    / pts.reduce((a, p) => a + (p.x - meanX) ** 2, 0)
  const total = slope * span
  const direction = Math.abs(total) < flatWithin ? 'flat' : total > 0 ? 'up' : 'down'
  return { direction, perWeek: round(slope * 7, 2), total: round(total, 2) }
}

/**
 * Average weight per week or month and the change from the period before. Takes
 * all readings so the first period in a range still has one to compare with;
 * pass `from` to keep only periods starting on or after it.
 */
export function weightChanges(
  points: { date: string; weightKg: number }[], size: 'week' | 'month', from = '',
): { date: string; avgKg: number; changeKg: number }[] {
  const groups = new Map<string, number[]>()
  for (const p of points) {
    const start = size === 'week' ? weekStart(p.date) : `${p.date.slice(0, 7)}-01`
    if (!groups.has(start)) groups.set(start, [])
    groups.get(start)!.push(p.weightKg)
  }
  const periods = [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, kgs]) => ({ date, avgKg: kgs.reduce((a, b) => a + b, 0) / kgs.length }))
  return periods.slice(1)
    .map((p, i) => ({ date: p.date, avgKg: round(p.avgKg, 2), changeKg: round(p.avgKg - periods[i].avgKg, 2) }))
    .filter(p => p.date >= from)
}

export interface CompPoint { date: string; fatKg: number; fatFreeKg: number; bodyFatPct: number; weightKg: number }
export interface CompChange {
  from: CompPoint
  to: CompPoint
  fatKg: number          // to − from; negative = lost
  fatFreeKg: number
  bodyFatPct: number     // percentage points
  fatShare: number | null // % of the weight lost that was fat; null under 0.5 kg lost
}

/** Mean of the composition days in the week up to `date`, or the first day after it if none. */
function compAround(days: BodyDay[], date: string): CompPoint | null {
  const from = shiftDay(date, -6)
  const ok = (d: BodyDay) => d.fat_mass_kg != null && d.fat_free_kg != null && d.body_fat_pct != null
  let pick = days.filter(d => ok(d) && d.date >= from && d.date <= date)
  if (!pick.length) {
    const next = days.find(d => ok(d) && d.date > date)
    pick = next ? [next] : []
  }
  if (!pick.length) return null
  const avg = (f: (d: BodyDay) => number) => pick.reduce((a, d) => a + f(d), 0) / pick.length
  const fatKg = avg(d => d.fat_mass_kg!)
  const fatFreeKg = avg(d => d.fat_free_kg!)
  return {
    date: pick[pick.length - 1].date,
    fatKg: round(fatKg, 1),
    fatFreeKg: round(fatFreeKg, 1),
    bodyFatPct: round(avg(d => d.body_fat_pct!), 1),
    weightKg: round(fatKg + fatFreeKg, 1),
  }
}

/** Body composition now against the plan start, from weekly averages at each end. */
export function compChange(days: BodyDay[], start: string, today: string): CompChange | null {
  const a = compAround(days, start)
  const b = compAround(days, today)
  if (!a || !b || b.date <= a.date) return null
  const lost = a.weightKg - b.weightKg
  return {
    from: a,
    to: b,
    fatKg: round(b.fatKg - a.fatKg, 1),
    fatFreeKg: round(b.fatFreeKg - a.fatFreeKg, 1),
    bodyFatPct: round(b.bodyFatPct - a.bodyFatPct, 1),
    fatShare: lost >= 0.5 ? Math.round((a.fatKg - b.fatKg) / lost * 100) : null,
  }
}
