import { describe, it, expect } from 'vitest'
import {
  MealItem, Meal, itemMacros, mealMacros, setItemSize, setItemGrams, validateMealEstimate, bmrMifflin, burnForDay,
  weightOn, energyBalance, summarizeBalance, repeatMeal, recentDistinctMeals, parseSex, intakeByDate,
  macroSplit, proteinTarget, weightTrend,
} from '../nutrition'

describe('weightTrend', () => {
  it('averages readings in the trailing 7-day window', () => {
    const t = weightTrend([
      { date: '2026-11-01', weightKg: 98 },
      { date: '2026-11-02', weightKg: null },
      { date: '2026-11-03', weightKg: 96 },
      { date: '2026-11-08', weightKg: 94 }, // window 11-02..11-08 → 96, 94
      { date: '2026-11-15', weightKg: 93 }, // window 11-09..11-15 → 93 only
    ])
    expect(t.map(x => x.trendKg)).toEqual([98, 97, 95, 93])
    expect(t.map(x => x.date)).toEqual(['2026-11-01', '2026-11-03', '2026-11-08', '2026-11-15'])
  })
})

describe('macros', () => {
  it('splits calories by macro', () => {
    // 50 g P = 200, 100 g C = 400, 20 g F = 180 → 780 kcal
    expect(macroSplit({ kcal: 780, protein: 50, carbs: 100, fat: 20 })).toEqual({ protein: 26, carbs: 51, fat: 23 })
    expect(macroSplit({ kcal: 0, protein: 0, carbs: 0, fat: 0 })).toBeNull()
  })

  it('sets protein target from bodyweight', () => {
    expect(proteinTarget(96)).toBe(173)
    expect(proteinTarget(null)).toBeNull()
  })
})
import type { ZeppDailyRow } from '../zeppDaily'

const item = (over: Partial<MealItem> = {}): MealItem => ({
  name: 'Rice', grams: 200, base: 200, size: 'M',
  kcal_per_100g: 130, protein_per_100g: 2.7, carbs_per_100g: 28, fat_per_100g: 0.3, ...over,
})

const meal = (over: Partial<Meal> = {}): Meal => ({
  id: 'm1', date: '2026-11-05', at: '2026-11-05T12:00:00Z', title: 'Rice bowl',
  items: [item()], share: 1, source: 'photo', ...over,
})

function day(date: string, f: Partial<ZeppDailyRow> = {}): ZeppDailyRow {
  return {
    date, readiness: null, hrv_readiness: null, rhr_readiness: null, physical_readiness: null, mental_readiness: null,
    sleep_hrv_ms: null, hrv_baseline_ms: null, sleep_rhr: null, rhr_baseline: null, resting_hr: null,
    sleep_min: null, sleep_score: null, deep_min: null, light_min: null, rem_min: null, awake_min: null,
    wake_count: null, nap_min: null, training_load: null, pai_daily: null, pai_total: null, steps: null,
    active_min: null, stress_avg: null, spo2_score: null, resp_rate: null, weight_kg: null,
    distance_m: null, active_calories: null, step_goal: null, ...f,
  }
}

describe('meal macros', () => {
  it('scales per-100g values by grams', () => {
    expect(itemMacros(item()).kcal).toBeCloseTo(260)
  })

  it('divides a shared meal by the number of people', () => {
    expect(mealMacros(meal({ share: 2 })).kcal).toBeCloseTo(130)
    expect(mealMacros(meal({ share: 0 })).kcal).toBeCloseTo(260) // bad share treated as 1
  })

  it('S/M/L scale from the base, typed grams become the new M', () => {
    expect(setItemSize(item(), 'S').grams).toBe(140)
    expect(setItemSize(item(), 'L').grams).toBe(260)
    expect(setItemSize(setItemSize(item(), 'L'), 'M').grams).toBe(200)
    const typed = setItemGrams(setItemSize(item(), 'L'), 150)
    expect(typed).toMatchObject({ grams: 150, base: 150, size: 'M' })
    expect(setItemSize(typed, 'S').grams).toBe(105)
  })

  it('sums intake per day across meals', () => {
    const m = intakeByDate([meal(), meal({ id: 'm2' }), meal({ id: 'm3', date: '2026-11-04' })])
    expect(m.get('2026-11-05')!.kcal).toBeCloseTo(520)
    expect(m.get('2026-11-04')!.kcal).toBeCloseTo(260)
  })
})

describe('repeat meals', () => {
  it('copies items to a new date without sharing references', () => {
    const src = meal({ share: 3 })
    const r = repeatMeal(src, '2026-11-06', 'new', '2026-11-06T08:00:00Z')
    expect(r).toMatchObject({ id: 'new', date: '2026-11-06', share: 3, source: 'repeat', title: 'Rice bowl' })
    r.items[0].grams = 1
    expect(src.items[0].grams).toBe(200)
  })

  it('lists recent meals newest first, one per title', () => {
    const list = recentDistinctMeals([
      meal({ id: 'a', at: '2026-11-01T08:00:00Z', title: 'Oats' }),
      meal({ id: 'b', at: '2026-11-03T08:00:00Z', title: 'oats ' }),
      meal({ id: 'c', at: '2026-11-02T08:00:00Z', title: 'Curry' }),
    ])
    expect(list.map(m => m.id)).toEqual(['b', 'c'])
  })
})

describe('validateMealEstimate', () => {
  it('clamps junk, drops zero-gram items and fills a title', () => {
    const v = validateMealEstimate({
      items: [
        { name: 'Chicken', grams: 150.4, kcal_per_100g: 165, protein_per_100g: 31, carbs_per_100g: 0, fat_per_100g: 3.6 },
        { name: 'Air', grams: 0, kcal_per_100g: 0 },
        { name: 'Oil', grams: '10', kcal_per_100g: 5000, protein_per_100g: -1 },
      ],
      confidence: 'very',
    })
    expect(v.items.map(i => i.name)).toEqual(['Chicken', 'Oil'])
    expect(v.items[0]).toMatchObject({ grams: 150, base: 150, size: 'M' })
    expect(v.items[1]).toMatchObject({ kcal_per_100g: 900, protein_per_100g: 0 })
    expect(v.confidence).toBe('low')
    expect(v.title).toBe('Chicken & Oil')
  })

  it('handles non-object input', () => {
    expect(validateMealEstimate(null)).toMatchObject({ items: [], title: 'Meal' })
  })
})

describe('calories burned', () => {
  it('Mifflin–St Jeor for a known case', () => {
    // 10×96 + 6.25×180 − 5×46 + 5 = 1860
    expect(bmrMifflin({ weightKg: 96, heightCm: 180, age: 46, sex: 'male' })).toBe(1860)
    expect(bmrMifflin({ weightKg: 60, heightCm: 165, age: 30, sex: 'female' })).toBe(1320)
    expect(bmrMifflin({ weightKg: 96, heightCm: null, age: 46, sex: 'male' })).toBeNull()
  })

  it('parses sex loosely', () => {
    expect(parseSex('Male')).toBe('male')
    expect(parseSex(' f ')).toBe('female')
    expect(parseSex('')).toBeNull()
  })

  it('uses watch active calories, falling back to steps when the watch value is implausible', () => {
    expect(burnForDay(day('d', { active_calories: 1200 }), 1800, 70)).toMatchObject({ total: 3000, activeSource: 'watch' })
    expect(burnForDay(day('d', { active_calories: 6, steps: 10000 }), 1800, 70)).toMatchObject({ active: 400, activeSource: 'steps' })
    expect(burnForDay(day('d', { steps: 10000 }), 1800, 140).active).toBe(800)
    expect(burnForDay(undefined, 1800, 70)).toMatchObject({ total: 1800, activeSource: 'none' })
  })

  it('takes the latest scale reading on or before the date', () => {
    const rows = [day('2026-11-01', { weight_kg: 97 }), day('2026-11-03', { weight_kg: 96 }), day('2026-11-05', { weight_kg: 95 })]
    expect(weightOn(rows, '2026-11-04', 90)).toBe(96)
    expect(weightOn(rows, '2026-10-01', 90)).toBe(90)
  })
})

describe('energy balance', () => {
  const body = { heightCm: 180, age: 46, sex: 'male' as const }
  const rows = [
    day('2026-11-03', { active_calories: 1000, weight_kg: 96 }),
    day('2026-11-04', { active_calories: 1000 }),
    day('2026-11-05', { active_calories: 500, weight_kg: 95 }),
  ]
  const meals = [
    meal({ date: '2026-11-03', items: [item({ grams: 1000, kcal_per_100g: 200 })] }), // 2000
    meal({ id: 'x', date: '2026-11-05', items: [item({ grams: 500, kcal_per_100g: 200 })] }), // 1000
  ]

  it('builds one row per day with deficit only where both sides are known', () => {
    const days = energyBalance(meals, rows, body, null, '2026-11-05', 3)
    expect(days.map(d => d.date)).toEqual(['2026-11-03', '2026-11-04', '2026-11-05'])
    // 11-03: BMR at 96 kg = 1860, + 1000 active = 2860 − 2000 eaten
    expect(days[0]).toMatchObject({ eaten: 2000, burned: 2860, deficit: 860, weightKg: 96 })
    expect(days[1]).toMatchObject({ eaten: null, deficit: null, burned: 2860 })
    // 11-05: BMR at 95 kg = 1850 + 500
    expect(days[2]).toMatchObject({ eaten: 1000, burned: 2350, deficit: 1350 })
  })

  it('summarises completed logged days and compares expected vs scale change', () => {
    const days = energyBalance(meals, rows, body, null, '2026-11-05', 3)
    const s = summarizeBalance(days, '2026-11-05')
    expect(s.loggedDays).toBe(1) // today excluded, 11-04 unlogged
    expect(s.avgDeficit).toBe(860)
    expect(s.expectedChangeKg).toBe(-0.1)
    expect(s.actualChangeKg).toBe(-1)
  })

  it('has no burned values without body stats', () => {
    const days = energyBalance(meals, rows, { heightCm: null, age: 46, sex: 'male' }, null, '2026-11-05', 3)
    expect(days.every(d => d.burned == null && d.deficit == null)).toBe(true)
  })
})
