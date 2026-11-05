'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import SectionHeading from '@/components/ui/SectionHeading'
import MealLogger, { LoggedMeal } from '@/components/nutrition/MealLogger'
import { RepeatMeals, DayMeals } from '@/components/nutrition/MealLists'
import EnergyBalance from '@/components/nutrition/EnergyBalance'
import DaySummary from '@/components/nutrition/DaySummary'
import { getZeppDaily, getSetting } from '@/lib/db'
import { loadProfile, derivedAge, AthleteProfile } from '@/lib/athleteProfile'
import { localToday } from '@/lib/recovery'
import type { ZeppDailyRow } from '@/lib/zeppDaily'
import {
  Meal, mealMacros, addMacros, ZERO_MACROS, mealsOnDate, intakeByDate, repeatMeal, recentDistinctMeals, energyBalance,
  bmrMifflin, burnForDay, weightOn, parseSex, shiftDay,
} from '@/lib/nutrition'
import { loadMeals, saveDay, loadFavourites, saveFavourites, FavouriteMeal } from '@/lib/nutritionStore'

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)

export default function NutritionPage() {
  const today = localToday()
  const [date, setDate] = useState(today)
  const [meals, setMeals] = useState<Meal[] | null>(null)
  const [favourites, setFavourites] = useState<FavouriteMeal[]>([])
  const [rows, setRows] = useState<ZeppDailyRow[]>([])
  const [profile, setProfile] = useState<AthleteProfile>({})
  const [scaleKg, setScaleKg] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    loadMeals().then(setMeals).catch(e => { setError(e instanceof Error ? e.message : 'Failed to load meals'); setMeals([]) })
    loadFavourites().then(setFavourites).catch(() => {})
    getZeppDaily().then(setRows).catch(() => {})
    loadProfile().then(setProfile).catch(() => {})
    getSetting('bodyweight_kg').then(v => setScaleKg(v ? Number(v) || null : null)).catch(() => {})
  }, [])

  // Persist one day, rolling back the optimistic change on failure.
  const commit = useCallback(async (next: Meal[], day: string, prev: Meal[]) => {
    setMeals(next)
    try { await saveDay(day, next) } catch (e) {
      setMeals(prev)
      setError(e instanceof Error ? e.message : 'Could not save')
      throw e
    }
  }, [])

  async function addMeal(meal: Meal) {
    const prev = meals ?? []
    await commit([...prev, meal], meal.date, prev)
  }

  async function addFavourite(src: Pick<Meal, 'title' | 'items' | 'share' | 'thumb'>) {
    const key = src.title.trim().toLowerCase()
    if (favourites.some(f => f.title.trim().toLowerCase() === key)) return
    const next = [...favourites, { id: newId(), title: src.title, items: src.items, share: src.share, thumb: src.thumb }]
    setFavourites(next)
    try { await saveFavourites(next) } catch { setFavourites(favourites); setError('Could not save favourite') }
  }

  async function onLogged(m: LoggedMeal, favourite: boolean) {
    const meal: Meal = {
      id: newId(), date, at: new Date().toISOString(), title: m.draft.title.trim() || 'Meal',
      items: m.draft.items, share: m.draft.share, source: m.source, note: m.note, thumb: m.thumb,
    }
    await addMeal(meal)
    if (favourite) await addFavourite(meal)
  }

  async function onRepeat(src: Pick<Meal, 'title' | 'items' | 'share' | 'thumb'>) {
    setBusy(true)
    try { await addMeal(repeatMeal(src, date, newId(), new Date().toISOString())) } catch { /* error shown */ } finally { setBusy(false) }
  }

  async function onDelete(m: Meal) {
    if (!confirm(`Delete “${m.title}”?`)) return
    const prev = meals ?? []
    await commit(prev.filter(x => x.id !== m.id), m.date, prev).catch(() => {})
  }

  async function onUnfavourite(id: string) {
    const next = favourites.filter(f => f.id !== id)
    setFavourites(next)
    try { await saveFavourites(next) } catch { setFavourites(favourites); setError('Could not update favourites') }
  }

  // ── Body stats → calories burned ──
  const profileWeight = Number(profile.bodyweightKg) || null
  const fallbackWeight = scaleKg ?? profileWeight
  const body = {
    heightCm: Number(profile.heightCm) || null,
    age: Number(derivedAge(profile)) || null,
    sex: parseSex(profile.sex),
  }
  const missingStats = [
    !body.heightCm && 'height',
    body.age == null && 'date of birth',
    !body.sex && 'sex',
    weightOn(rows, today, fallbackWeight) == null && 'bodyweight',
  ].filter(Boolean) as string[]

  // Load at least a year (for the Year range), more if meals go back further (All).
  const balanceDays = useMemo(() => {
    const first = (meals ?? []).reduce<string | null>((a, m) => (!a || m.date < a ? m.date : a), null)
    const span = first ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000) + 1 : 0
    return Math.min(3650, Math.max(365, span))
  }, [meals, today])
  const balance = useMemo(
    () => energyBalance(meals ?? [], rows, body, fallbackWeight, today, balanceDays),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- body is derived from profile
    [meals, rows, profile, fallbackWeight, today, balanceDays],
  )
  const todayW = weightOn(rows, today, fallbackWeight)
  const todayBmr = bmrMifflin({ ...body, weightKg: todayW })
  const todayBurn = todayBmr != null && todayW != null ? burnForDay(rows.find(r => r.date === today), todayBmr, todayW) : null
  const todayEaten = intakeByDate(meals ?? []).get(today)?.kcal ?? 0

  const dayMeals = mealsOnDate(meals ?? [], date)
  const dayMacros = dayMeals.reduce((a, m) => addMacros(a, mealMacros(m)), ZERO_MACROS)
  const dayWeight = weightOn(rows, date, fallbackWeight)
  const dayBurn = (() => {
    if (date === today) return todayBurn ? { total: todayBurn.total, resting: todayBurn.bmr, active: todayBurn.active } : null
    const d = balance.find(x => x.date === date)
    return d?.burned != null ? { total: d.burned, resting: d.resting ?? 0, active: d.active ?? 0 } : null
  })()
  const recent = recentDistinctMeals(meals ?? [], 10)
  const favTitles = new Set(favourites.map(f => f.title.trim().toLowerCase()))
  const dayLabel = date === today ? 'Today' : date === shiftDay(today, -1) ? 'Yesterday' : date

  return (
    <div style={{ background: '#0D0D0D', minHeight: '100vh' }}>
      {/* Hero — compact on phones so the logger is near the top of the screen */}
      <div
        className="pt-16 pb-5 sm:pb-12"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,191,165,0.08) 0%, transparent 70%)', borderBottom: '1px solid #1A1A1A' }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-10">
          <p className="text-xs uppercase tracking-widest mb-1 sm:mb-2" style={{ color: '#00BFA5' }}>Fuel</p>
          <h1 className="text-4xl sm:text-6xl font-black uppercase sm:mb-3" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>
            Nutrition
          </h1>
          <p className="hidden sm:block text-lg" style={{ color: '#A0A0A0' }}>
            Snap or describe a meal, and see what you ate against what your watch says you burned.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-10 space-y-8 sm:space-y-10">
        {error && (
          <Card tint="#C8102E" hover={false}>
            <p className="text-sm" style={{ color: '#F5F5F5' }}>{error}</p>
          </Card>
        )}

        {/* Day picker + summary first: on a phone it's the glanceable bit */}
        <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-widest" style={{ color: '#00BFA5' }}>{dayLabel}</p>
          <label className="text-xs flex items-center gap-2" style={{ color: 'var(--color-text-subtle)' }}>
            Log to
            <input
              type="date" value={date} max={today}
              onChange={e => setDate(e.target.value || today)}
              className="rounded-lg px-2 py-1.5 text-base sm:text-sm"
              style={{ background: '#1E1E1E', border: '1px solid #2E2E2E', color: '#F5F5F5', colorScheme: 'dark' }}
            />
          </label>
        </div>
        <DaySummary macros={dayMacros} burn={dayBurn} weightKg={dayWeight} inProgress={date === today} />
        </section>

        {/* grid-cols-1 (= minmax(0,1fr)) + min-w-0: without them a long meal name
            stretches the column past the phone screen. */}
        <section className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-4">
            <MealLogger onSave={onLogged} />
            <RepeatMeals favourites={favourites} recent={recent} onLog={onRepeat} onUnfavourite={onUnfavourite} busy={busy} />
          </div>

          <div className="min-w-0 space-y-4">
            {meals === null
              ? <p className="text-sm" style={{ color: 'var(--color-text-subtle)' }}>Loading meals…</p>
              : <DayMeals meals={dayMeals} favouriteTitles={favTitles} onDelete={onDelete} onFavourite={addFavourite} label={`${dayLabel}'s meals`} />}
          </div>
        </section>

        <section className="space-y-6">
          <SectionHeading eyebrow="Energy balance" title="Deficit & weight" sub="Calories burned = resting burn from your profile plus active calories from your watch." />
          <EnergyBalance days={balance} today={today} todayEaten={todayEaten} todayBurn={todayBurn} missingStats={missingStats} />
        </section>

        <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
          Photo estimates are rough — often ±20–40% on mixed plates. Use S / M / L or type grams to correct them before saving.
        </p>
      </div>
    </div>
  )
}
