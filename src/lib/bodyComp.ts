// Body-composition charts: Renpho readings → one comparable reading per day →
// week / month averages for long ranges.

import type { BodyReading } from './renpho'
import { weekStart, type BucketSize } from './nutrition'

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

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits

/**
 * One reading per day: the first of the day with composition data. Impedance
 * estimates move with food and water, so first-thing readings compare best;
 * taking them all would mix morning and evening values.
 */
export function dailyBody(readings: BodyReading[]): BodyDay[] {
  const first = new Map<string, BodyReading>()
  for (const r of readings) {
    if (r.body_fat_pct == null) continue
    const cur = first.get(r.date)
    if (!cur || r.measured_at < cur.measured_at) first.set(r.date, r)
  }
  return [...first.values()]
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

/** Latest value in the range and its change from the first value in the range. */
export function metricChange(days: BodyDay[], key: BodyMetricKey): { latest: number; change: number | null } | null {
  const values = days.map(d => d[key]).filter((v): v is number => v != null)
  if (!values.length) return null
  const latest = values[values.length - 1]
  return { latest, change: values.length > 1 ? round(latest - values[0], 2) : null }
}
