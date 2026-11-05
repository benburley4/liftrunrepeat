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

export type MealSource = 'photo' | 'text' | 'repeat'

export interface Meal {
  id: string
  date: string               // YYYY-MM-DD local day it counts towards
  at: string                 // ISO time logged
  title: string
  items: MealItem[]          // the whole dish
  share: number              // people sharing it — your intake = items ÷ share
  source: MealSource
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
  burned: number | null         // null = no body stats for BMR
  deficit: number | null        // burned − eaten (positive = deficit); only when both known
  activeSource: ActiveSource
  weightKg: number | null       // scale reading that day (not carried forward)
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
    const eaten = intake.has(date) ? Math.round(intake.get(date)!.kcal) : null
    out.push({
      date, eaten,
      burned: burn?.total ?? null,
      deficit: burn && eaten != null ? burn.total - eaten : null,
      activeSource: burn?.activeSource ?? 'none',
      weightKg: byDate.get(date)?.weight_kg ?? null,
    })
  }
  return out
}

/** ~7700 kcal per kg of body fat. */
export const KCAL_PER_KG = 7700

export interface BalanceSummary {
  loggedDays: number
  avgEaten: number | null
  avgBurned: number | null
  avgDeficit: number | null
  totalDeficit: number            // over logged days (excluding today, which is incomplete)
  expectedChangeKg: number | null // from the logged deficit
  actualChangeKg: number | null   // scale: mean of first 3 vs last 3 readings in the range
}

export function summarizeBalance(days: BalanceDay[], today: string): BalanceSummary {
  const done = days.filter(d => d.date < today && d.deficit != null)
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null)
  const total = done.reduce((a, d) => a + d.deficit!, 0)
  const weights = days.filter(d => d.weightKg != null).map(d => d.weightKg!)
  let actual: number | null = null
  if (weights.length >= 2) {
    const n = Math.min(3, Math.floor(weights.length / 2))
    const m = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    actual = Math.round((m(weights.slice(-n)) - m(weights.slice(0, n))) * 10) / 10
  }
  return {
    loggedDays: done.length,
    avgEaten: avg(done.map(d => d.eaten!)),
    avgBurned: avg(done.map(d => d.burned!)),
    avgDeficit: avg(done.map(d => d.deficit!)),
    totalDeficit: Math.round(total),
    expectedChangeKg: done.length ? Math.round((-total / KCAL_PER_KG) * 10) / 10 : null,
    actualChangeKg: actual,
  }
}
