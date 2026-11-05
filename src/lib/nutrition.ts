// Nutrition: meal logging (photo / description / repeat), portion scaling,
// calories-burned estimate from the watch, and the daily energy balance.
// Pure logic — storage lives in nutritionStore.ts, AI in server/mealEstimate.ts.

import type { ZeppDailyRow } from './zeppDaily'

// ─── Meals ────────────────────────────────────────────────────────────────────

export type PortionSize = 'S' | 'M' | 'L'
/** M = the AI's (or your) estimate; S / L scale it. */
export const PORTION_FACTOR: Record<PortionSize, number> = { S: 0.7, M: 1, L: 1.3 }

export interface MealItem {
  name: string
  grams: number              // current grams for the whole dish (before sharing)
  base: number               // grams at size M
  size: PortionSize
  kcal_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
}

export type MealSource = 'photo' | 'text' | 'repeat' | 'drink'

export interface Meal {
  id: string
  date: string               // YYYY-MM-DD local day it counts towards
  at: string                 // ISO time logged
  title: string
  items: MealItem[]          // the whole dish
  share: number              // people sharing it — your intake = items ÷ share
  source: MealSource
  kind?: 'meal' | 'drink'    // drinks count towards fluids (item grams ≈ ml); default meal
  note?: string
  thumb?: string             // small JPEG data URL (photo meals only)
}

export interface Macros { kcal: number; protein: number; carbs: number; fat: number }
export const ZERO_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

export function itemMacros(it: MealItem): Macros {
  const g = it.grams / 100
  return { kcal: g * it.kcal_per_100g, protein: g * it.protein_per_100g, carbs: g * it.carbs_per_100g, fat: g * it.fat_per_100g }
}

export function addMacros(a: Macros, b: Macros): Macros {
  return { kcal: a.kcal + b.kcal, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat }
}

const scale = (m: Macros, k: number): Macros => ({ kcal: m.kcal * k, protein: m.protein * k, carbs: m.carbs * k, fat: m.fat * k })

/** What you ate from this meal (whole dish ÷ people sharing). */
export function mealMacros(meal: Pick<Meal, 'items' | 'share'>): Macros {
  const whole = meal.items.reduce((a, it) => addMacros(a, itemMacros(it)), ZERO_MACROS)
  return scale(whole, 1 / Math.max(1, meal.share || 1))
}

/** Share of calories from each macro (4 / 4 / 9 kcal per g), whole percents. Null when nothing eaten. */
export function macroSplit(m: Macros): { protein: number; carbs: number; fat: number } | null {
  const p = m.protein * 4, c = m.carbs * 4, f = m.fat * 9
  const total = p + c + f
  if (total <= 0) return null
  return { protein: Math.round((p / total) * 100), carbs: Math.round((c / total) * 100), fat: Math.round((f / total) * 100) }
}

/** Daily protein target for a hybrid (strength + endurance) athlete: ~1.8 g/kg (range 1.6–2.2). */
export const PROTEIN_G_PER_KG = 1.8
export function proteinTarget(weightKg: number | null): number | null {
  return weightKg ? Math.round(weightKg * PROTEIN_G_PER_KG) : null
}

export function setItemSize(it: MealItem, size: PortionSize): MealItem {
  return { ...it, size, grams: Math.round(it.base * PORTION_FACTOR[size]) }
}

/** Typing grams makes that the new M. */
export function setItemGrams(it: MealItem, grams: number): MealItem {
  const g = Math.max(0, Math.round(Number.isFinite(grams) ? grams : 0))
  return { ...it, grams: g, base: g, size: 'M' }
}

export function mealsOnDate(meals: Meal[], date: string): Meal[] {
  return meals.filter(m => m.date === date).sort((a, b) => a.at.localeCompare(b.at))
}

export function intakeByDate(meals: Meal[]): Map<string, Macros> {
  const out = new Map<string, Macros>()
  for (const m of meals) out.set(m.date, addMacros(out.get(m.date) ?? ZERO_MACROS, mealMacros(m)))
  return out
}

// ─── Drinks ──────────────────────────────────────────────────────────────────

export interface DrinkPreset {
  id: string
  name: string
  ml: number                 // regular serving
  kcal: number               // per serving
  protein: number
  carbs: number
  fat: number
}

/** Typical UK servings; values per serving (generic, not brand-specific). */
export const DRINKS: DrinkPreset[] = [
  { id: 'water', name: 'Water', ml: 250, kcal: 0, protein: 0, carbs: 0, fat: 0 },
  { id: 'coffee', name: 'Black coffee', ml: 250, kcal: 2, protein: 0.3, carbs: 0, fat: 0 },
  { id: 'flatwhite', name: 'Flat white', ml: 220, kcal: 110, protein: 6, carbs: 9, fat: 6 },
  { id: 'latte', name: 'Latte', ml: 350, kcal: 150, protein: 10, carbs: 15, fat: 5 },
  { id: 'tea', name: 'Tea with milk', ml: 250, kcal: 20, protein: 1, carbs: 2, fat: 1 },
  { id: 'shake', name: 'Protein shake (water)', ml: 300, kcal: 120, protein: 24, carbs: 3, fat: 1.5 },
  { id: 'milk', name: 'Milk (semi-skimmed)', ml: 250, kcal: 125, protein: 9, carbs: 12, fat: 4.5 },
  { id: 'oj', name: 'Orange juice', ml: 250, kcal: 112, protein: 2, carbs: 26, fat: 0 },
  { id: 'cola', name: 'Cola', ml: 330, kcal: 139, protein: 0, carbs: 35, fat: 0 },
  { id: 'zero', name: 'Diet / zero cola', ml: 330, kcal: 1, protein: 0, carbs: 0, fat: 0 },
  { id: 'sports', name: 'Sports drink', ml: 500, kcal: 125, protein: 0, carbs: 30, fat: 0 },
  { id: 'beer', name: 'Beer (pint)', ml: 568, kcal: 215, protein: 2, carbs: 18, fat: 0 },
  { id: 'wine', name: 'Wine (175 ml)', ml: 175, kcal: 160, protein: 0, carbs: 4, fat: 0 },
  { id: 'gt', name: 'Gin & tonic', ml: 250, kcal: 125, protein: 0, carbs: 14, fat: 0 },
]

/** A drink as a one-item meal (grams = ml) at the chosen size. */
export function drinkMeal(p: DrinkPreset, size: PortionSize, date: string, id: string, at: string): Meal {
  const per100 = (v: number) => Math.round((v * 100 / p.ml) * 100) / 100
  const item: MealItem = {
    name: p.name, grams: p.ml, base: p.ml, size: 'M',
    kcal_per_100g: per100(p.kcal), protein_per_100g: per100(p.protein), carbs_per_100g: per100(p.carbs), fat_per_100g: per100(p.fat),
  }
  const sized = setItemSize(item, size)
  const title = size === 'M' ? p.name : `${size === 'S' ? 'Small' : 'Large'} ${p.name.toLowerCase()}`
  return { id, date, at, title, items: [sized], share: 1, source: 'drink', kind: 'drink' }
}

/** Fluid intake (ml) for a list of meals — drinks only. */
export function fluidsMl(meals: Meal[]): number {
  return Math.round(meals.filter(m => m.kind === 'drink')
    .reduce((a, m) => a + m.items.reduce((s, it) => s + it.grams, 0) / Math.max(1, m.share || 1), 0))
}

/** Copy a past meal / favourite as a new meal for `date` — no photo or AI call. */
export function repeatMeal(src: Pick<Meal, 'title' | 'items' | 'share' | 'thumb'>, date: string, id: string, at: string): Meal {
  return {
    id, date, at, title: src.title, share: src.share || 1, source: 'repeat', thumb: src.thumb,
    items: src.items.map(it => ({ ...it })),
  }
}

/** Recent distinct meals (by title), newest first — the "log again" list. */
export function recentDistinctMeals(meals: Meal[], limit = 8): Meal[] {
  const seen = new Set<string>()
  const out: Meal[] = []
  for (const m of [...meals].sort((a, b) => b.at.localeCompare(a.at))) {
    const key = m.title.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(m)
    if (out.length >= limit) break
  }
  return out
}

// ─── AI estimate validation ──────────────────────────────────────────────────

const num = (v: unknown, max: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0
}

export interface MealEstimate { title: string; items: MealItem[]; comment: string; confidence: 'low' | 'medium' | 'high' }

/** Clamp and shape the model's JSON into MealItems (size M = its estimate). */
export function validateMealEstimate(raw: unknown): MealEstimate {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const items = (Array.isArray(r.items) ? r.items : []).slice(0, 30).map((x): MealItem => {
    const it = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>
    const grams = Math.round(num(it.grams, 5000))
    return {
      name: String(it.name ?? 'Item').slice(0, 80),
      grams, base: grams, size: 'M',
      kcal_per_100g: num(it.kcal_per_100g, 900),
      protein_per_100g: num(it.protein_per_100g, 100),
      carbs_per_100g: num(it.carbs_per_100g, 100),
      fat_per_100g: num(it.fat_per_100g, 100),
    }
  }).filter(it => it.grams > 0)
  const conf = r.confidence === 'high' || r.confidence === 'medium' ? r.confidence : 'low'
  const title = String(r.title ?? '').trim().slice(0, 60) || items.map(i => i.name).slice(0, 2).join(' & ') || 'Meal'
  return { title, items, comment: String(r.comment ?? '').slice(0, 300), confidence: conf }
}

// ─── Calories burned ─────────────────────────────────────────────────────────

export interface BodyStats { weightKg: number | null; heightCm: number | null; age: number | null; sex: 'male' | 'female' | null }

export function parseSex(s: string | undefined): BodyStats['sex'] {
  const v = (s ?? '').trim().toLowerCase()
  if (v.startsWith('m')) return 'male'
  if (v.startsWith('f') || v.startsWith('w')) return 'female'
  return null
}

/** Mifflin–St Jeor resting energy, kcal/day. Null when any input is missing. */
export function bmrMifflin({ weightKg, heightCm, age, sex }: BodyStats): number | null {
  if (!weightKg || !heightCm || age == null || !sex) return null
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161))
}

/** Zepp sometimes syncs 0 / single-digit active calories on full days — treat as missing. */
export const MIN_PLAUSIBLE_ACTIVE_KCAL = 100
/** Walking cost ≈ 0.04 kcal per step at 70 kg, scaled by bodyweight. */
export const KCAL_PER_STEP_70KG = 0.04

export type ActiveSource = 'watch' | 'steps' | 'none'

export interface BurnEstimate { bmr: number; active: number; total: number; activeSource: ActiveSource }

export function burnForDay(row: ZeppDailyRow | undefined, bmr: number, weightKg: number): BurnEstimate {
  const watch = row?.active_calories
  if (watch != null && watch >= MIN_PLAUSIBLE_ACTIVE_KCAL) {
    return { bmr, active: Math.round(watch), total: Math.round(bmr + watch), activeSource: 'watch' }
  }
  if (row?.steps && row.steps > 0) {
    const active = Math.round(row.steps * KCAL_PER_STEP_70KG * (weightKg / 70))
    return { bmr, active, total: bmr + active, activeSource: 'steps' }
  }
  return { bmr, active: 0, total: bmr, activeSource: 'none' }
}

/** Latest scale reading on or before `date`, else the fallback. */
export function weightOn(rows: ZeppDailyRow[], date: string, fallback: number | null): number | null {
  let best: ZeppDailyRow | undefined
  for (const r of rows) if (r.weight_kg != null && r.date <= date && (!best || r.date > best.date)) best = r
  return best?.weight_kg ?? fallback
}

// ─── Daily energy balance ────────────────────────────────────────────────────

export function shiftDay(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export interface BalanceDay {
  date: string
  eaten: number | null          // null = nothing logged that day
  burned: number | null         // null = no body stats for BMR; = resting + active
  resting: number | null        // BMR (Mifflin–St Jeor)
  active: number | null         // watch active calories (or steps estimate)
  deficit: number | null        // burned − eaten (positive = deficit); only when both known
  activeSource: ActiveSource
  weightKg: number | null       // scale reading that day (not carried forward)
  protein: number | null        // grams; null = nothing logged
  carbs: number | null
  fat: number | null
}

export function energyBalance(
  meals: Meal[], rows: ZeppDailyRow[], body: Omit<BodyStats, 'weightKg'>, fallbackWeight: number | null,
  today: string, days: number,
): BalanceDay[] {
  const intake = intakeByDate(meals)
  const byDate = new Map(rows.map(r => [r.date, r]))
  const out: BalanceDay[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = shiftDay(today, -i)
    const w = weightOn(rows, date, fallbackWeight)
    const bmr = bmrMifflin({ ...body, weightKg: w })
    const burn = bmr != null && w != null ? burnForDay(byDate.get(date), bmr, w) : null
    const m = intake.get(date)
    const eaten = m ? Math.round(m.kcal) : null
    out.push({
      date, eaten,
      burned: burn?.total ?? null,
      resting: burn?.bmr ?? null,
      active: burn?.active ?? null,
      deficit: burn && eaten != null ? burn.total - eaten : null,
      activeSource: burn?.activeSource ?? 'none',
      weightKg: byDate.get(date)?.weight_kg ?? null,
      protein: m ? Math.round(m.protein) : null,
      carbs: m ? Math.round(m.carbs) : null,
      fat: m ? Math.round(m.fat) : null,
    })
  }
  return out
}

/**
 * Bodyweight trend: for each day with a scale reading, the mean of all readings
 * in the `window` days ending that day. Smooths day-to-day water swings.
 */
export function weightTrend(days: Pick<BalanceDay, 'date' | 'weightKg'>[], window = 7): { date: string; weightKg: number; trendKg: number }[] {
  const readings = days.filter(d => d.weightKg != null) as { date: string; weightKg: number }[]
  return readings.map(r => {
    const from = shiftDay(r.date, -(window - 1))
    const inWin = readings.filter(x => x.date >= from && x.date <= r.date)
    const mean = inWin.reduce((a, x) => a + x.weightKg, 0) / inWin.length
    return { date: r.date, weightKg: r.weightKg, trendKg: Math.round(mean * 10) / 10 }
  })
}

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null)

// ─── Period buckets (week / month averages for long ranges) ──────────────────

export type BucketSize = 'day' | 'week' | 'month'

/** Monday of the ISO week containing `date`. */
export function weekStart(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay() // 0 = Sun
  return shiftDay(date, -((dow + 6) % 7))
}

/** Daily bars up to a month, weekly up to a year, monthly beyond. */
export function bucketSizeFor(dayCount: number): BucketSize {
  return dayCount <= 31 ? 'day' : dayCount <= 366 ? 'week' : 'month'
}

export interface BalanceBucket {
  start: string                 // first day of the bucket
  eaten: number | null          // averages per day, over days that have the value
  burned: number | null
  resting: number | null
  active: number | null
  deficit: number | null
}

export function bucketBalance(days: BalanceDay[], size: BucketSize): BalanceBucket[] {
  const keyOf = (d: string) => (size === 'day' ? d : size === 'week' ? weekStart(d) : `${d.slice(0, 7)}-01`)
  const groups = new Map<string, BalanceDay[]>()
  for (const d of days) {
    const k = keyOf(d.date)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(d)
  }
  const pick = (g: BalanceDay[], k: 'eaten' | 'burned' | 'resting' | 'active' | 'deficit') =>
    avg(g.map(d => d[k]).filter((v): v is number => v != null))
  return [...groups.entries()].map(([start, g]) => ({
    start, eaten: pick(g, 'eaten'), burned: pick(g, 'burned'), resting: pick(g, 'resting'), active: pick(g, 'active'), deficit: pick(g, 'deficit'),
  }))
}

/** ~7700 kcal per kg of body fat. */
export const KCAL_PER_KG = 7700

export interface BalanceSummary {
  loggedDays: number
  avgEaten: number | null
  avgBurned: number | null
  avgResting: number | null
  avgActive: number | null
  avgDeficit: number | null
  avgProtein: number | null
  avgCarbs: number | null
  avgFat: number | null
  totalDeficit: number            // over logged days (excluding today, which is incomplete)
  expectedChangeKg: number | null // from the logged deficit
  actualChangeKg: number | null   // scale: mean of first 3 vs last 3 readings in the range
}

export function summarizeBalance(days: BalanceDay[], today: string): BalanceSummary {
  const done = days.filter(d => d.date < today && d.deficit != null)
  // Macros don't need a burn estimate — average every completed day with meals logged.
  const eatenDays = days.filter(d => d.date < today && d.eaten != null)
  const total = done.reduce((a, d) => a + d.deficit!, 0)
  const weights = days.filter(d => d.weightKg != null).map(d => d.weightKg!)
  let actual: number | null = null
  if (weights.length >= 2) {
    const n = Math.min(3, Math.floor(weights.length / 2))
    const m = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    actual = Math.round((m(weights.slice(-n)) - m(weights.slice(0, n))) * 10) / 10
  }
  return {
    loggedDays: eatenDays.length,
    avgEaten: avg(eatenDays.map(d => d.eaten!)),
    avgBurned: avg(done.map(d => d.burned!)),
    avgResting: avg(done.map(d => d.resting ?? 0)),
    avgActive: avg(done.map(d => d.active ?? 0)),
    avgDeficit: avg(done.map(d => d.deficit!)),
    avgProtein: avg(eatenDays.map(d => d.protein ?? 0)),
    avgCarbs: avg(eatenDays.map(d => d.carbs ?? 0)),
    avgFat: avg(eatenDays.map(d => d.fat ?? 0)),
    totalDeficit: Math.round(total),
    expectedChangeKg: done.length ? Math.round((-total / KCAL_PER_KG) * 10) / 10 : null,
    actualChangeKg: actual,
  }
}
