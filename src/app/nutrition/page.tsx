'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Card from '@/components/ui/Card'
import SectionHeading from '@/components/ui/SectionHeading'
import MealLogger, { LoggedMeal } from '@/components/nutrition/MealLogger'
import { RepeatMeals, DayMeals } from '@/components/nutrition/MealLists'
import EnergyBalance from '@/components/nutrition/EnergyBalance'
import DaySummary from '@/components/nutrition/DaySummary'
import DrinksCard from '@/components/nutrition/DrinksCard'
import BodyTab from '@/components/body/BodyTab'
import MealEditor, { MealDraft } from '@/components/nutrition/MealEditor'
import Modal from '@/components/ui/Modal'
import { getZeppDaily, getRenphoBody, getSetting } from '@/lib/db'
import { loadProfile, derivedAge, AthleteProfile } from '@/lib/athleteProfile'
import { localToday } from '@/lib/recovery'
import type { ZeppDailyRow } from '@/lib/zeppDaily'
import type { BodyReading } from '@/lib/renpho'
import {
  Meal, mealMacros, addMacros, ZERO_MACROS, mealsOnDate, intakeByDate, repeatMeal, recentDistinctMeals, energyBalance,
  bmrMifflin, burnForDay, weightOn, parseSex, shiftDay, drinkMeal, fluidsMl, DrinkPreset, PortionSize,
} from '@/lib/nutrition'
import { loadMeals, saveDay, loadFavourites, saveFavourites, FavouriteMeal } from '@/lib/nutritionStore'

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)

const TABS = [
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'weight', label: 'Weight & Body' },
] as const
type TabKey = (typeof TABS)[number]['key']

export default function NutritionPage() {
  const today = localToday()
  const [tab, setTab] = useState<TabKey>('nutrition')
  const [readings, setReadings] = useState<BodyReading[]>([])
  const [date, setDate] = useState(today)
  const [meals, setMeals] = useState<Meal[] | null>(null)
  const [favourites, setFavourites] = useState<FavouriteMeal[]>([])
  const [rows, setRows] = useState<ZeppDailyRow[]>([])
  const [profile, setProfile] = useState<AthleteProfile>({})
  const [scaleKg, setScaleKg] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // After a Renpho sync: new readings, plus the daily weights the other pages use.
  const reloadBody = useCallback(() => {
    getZeppDaily().then(setRows).catch(() => {})
    getRenphoBody().then(setReadings).catch(() => {})
    getSetting('bodyweight_kg').then(v => setScaleKg(v ? Number(v) || null : null)).catch(() => {})
  }, [])

  useEffect(() => {
    loadMeals().then(setMeals).catch(e => { setError(e instanceof Error ? e.message : 'Failed to load meals'); setMeals([]) })
    loadFavourites().then(setFavourites).catch(() => {})
    loadProfile().then(setProfile).catch(() => {})
    reloadBody()
  }, [reloadBody])

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

  async function onDrink(p: DrinkPreset, size: PortionSize) {
    setBusy(true)
    try { await addMeal(drinkMeal(p, size, date, newId(), new Date().toISOString())) } catch { /* error shown */ } finally { setBusy(false) }
  }

  // ── Edit an already-logged meal or drink ──
  const [editing, setEditing] = useState<Meal | null>(null)
  const [editDraft, setEditDraft] = useState<MealDraft | null>(null)
  function openEdit(m: Meal) {
    setEditing(m)
    setEditDraft({ title: m.title, items: m.items.map(it => ({ ...it })), share: m.share })
  }
  async function saveEdit(favourite: boolean) {
    if (!editing || !editDraft) return
    const updated: Meal = { ...editing, title: editDraft.title.trim() || editing.title, items: editDraft.items, share: editDraft.share }
    const prev = meals ?? []
    setBusy(true)
    try {
      await commit(prev.map(x => (x.id === editing.id ? updated : x)), editing.date, prev)
      if (favourite) await addFavourite(updated)
      setEditing(null)
    } catch { /* error shown */ } finally { setBusy(false) }
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
  const recent = recentDistinctMeals((meals ?? []).filter(m => m.kind !== 'drink'), 10)
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
          <p className="text-xs uppercase tracking-widest mb-1 sm:mb-2" style={{ color: '#00BFA5' }}>Fuel &amp; body</p>
          <h1 className="text-4xl sm:text-6xl font-black uppercase sm:mb-3" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>
            Weight &amp; Nutrition
          </h1>
          <p className="hidden sm:block text-lg" style={{ color: '#A0A0A0' }}>
            Log your meals, see them against what you burned, and track what your weight is made of.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-10 space-y-8 sm:space-y-10">
        <div className="flex gap-2" role="tablist" aria-label="Section">
          {TABS.map(t => (
            <button
              key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className="px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap"
              style={{ background: tab === t.key ? 'rgba(0,191,165,0.12)' : '#1E1E1E', color: tab === t.key ? '#00BFA5' : '#A0A0A0', border: '1px solid #2E2E2E', cursor: 'pointer' }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'weight' && <BodyTab rows={rows} readings={readings} today={today} onSynced={reloadBody} />}

        {tab === 'nutrition' && <>
        {error && (
          <Card tint="#C8102E" hover={false}>
            <p className="text-sm" style={{ color: '#F5F5F5' }}>{error}</p>
          </Card>
        )}

        {/* Logging first (easiest to reach on a phone), then the day summary and list.
            Phone: one column in DOM order. Desktop: logging on the left, summary + list on the right. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-widest" style={{ color: '#00BFA5' }}>{dayLabel}</p>
          <div className="flex items-center gap-2">
            {/* Arrows stay outside the label: a click inside it would also activate the input. */}
            <label htmlFor="log-date" className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Log to</label>
            <button
              type="button" aria-label="Previous day" onClick={() => setDate(shiftDay(date, -1))}
              className="w-9 h-9 flex items-center justify-center rounded-lg"
              style={{ background: '#1E1E1E', border: '1px solid #2E2E2E', color: '#F5F5F5' }}
            >
              <ChevronLeft size={16} />
            </button>
            <input
              id="log-date" type="date" value={date} max={today}
              onChange={e => setDate(e.target.value || today)}
              className="rounded-lg px-2 py-1.5 text-base sm:text-sm"
              style={{ background: '#1E1E1E', border: '1px solid #2E2E2E', color: '#F5F5F5', colorScheme: 'dark' }}
            />
            <button
              type="button" aria-label="Next day" disabled={date >= today} onClick={() => setDate(shiftDay(date, 1))}
              className="w-9 h-9 flex items-center justify-center rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#1E1E1E', border: '1px solid #2E2E2E', color: '#F5F5F5' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* grid-cols-1 (= minmax(0,1fr)) + min-w-0: without them a long meal name
            stretches the column past the phone screen. */}
        <section className="-mt-4 sm:-mt-6 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 items-start">
          <div className="min-w-0 space-y-4">
            <MealLogger onSave={onLogged} />
            <DrinksCard onLog={onDrink} fluidsMl={fluidsMl(dayMeals)} busy={busy} />
            <RepeatMeals favourites={favourites} recent={recent} onLog={onRepeat} onUnfavourite={onUnfavourite} busy={busy} />
          </div>

          <div className="min-w-0 space-y-4">
            <DaySummary macros={dayMacros} burn={dayBurn} weightKg={dayWeight} inProgress={date === today} />
            {meals === null
              ? <p className="text-sm" style={{ color: 'var(--color-text-subtle)' }}>Loading meals…</p>
              : <DayMeals meals={dayMeals} favouriteTitles={favTitles} onDelete={onDelete} onFavourite={addFavourite} onEdit={openEdit} label={`${dayLabel}'s meals & drinks`} />}
          </div>
        </section>

        {editing && (
          <Modal onClose={() => setEditing(null)} title={editing.kind === 'drink' ? 'Edit drink' : 'Edit meal'}>
            <MealEditor
              draft={editDraft ?? { title: editing.title, items: editing.items, share: editing.share }}
              onChange={setEditDraft}
              onSave={fav => saveEdit(fav)}
              onDiscard={() => setEditing(null)}
              saving={busy}
              saveLabel="Save changes"
              discardLabel="Cancel"
            />
          </Modal>
        )}

        <section className="space-y-6">
          <SectionHeading eyebrow="Energy balance" title="Eaten vs burned" sub="Calories burned = resting burn from your profile plus active calories from your watch." />
          <EnergyBalance days={balance} today={today} todayEaten={todayEaten} todayBurn={todayBurn} missingStats={missingStats} />
        </section>

        <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
          Photo estimates are rough — often ±20–40% on mixed plates. Use S / M / L or type grams to correct them before saving.
        </p>
        </>}
      </div>
    </div>
  )
}
