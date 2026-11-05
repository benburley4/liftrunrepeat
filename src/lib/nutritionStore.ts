// Meal storage. Meals live in user_settings (one row per day, key
// `meals:YYYY-MM-DD`, value = JSON Meal[]) so no schema migration is needed and
// the existing per-user RLS applies. Favourites are one row, `meal_favourites`.

import { getSettingsByPrefix, upsertSetting, getSetting } from './db'
import type { Meal, MealItem } from './nutrition'

const DAY_PREFIX = 'meals:'
const FAV_KEY = 'meal_favourites'

export interface FavouriteMeal { id: string; title: string; items: MealItem[]; share: number; thumb?: string }

function parseArray<T>(raw: string | null | undefined): T[] {
  try {
    const v = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? v as T[] : []
  } catch { return [] }
}

export async function loadMeals(): Promise<Meal[]> {
  const rows = await getSettingsByPrefix(DAY_PREFIX)
  return rows.flatMap(r => parseArray<Meal>(r.value))
}

/** Replace one day's meals (deletes the row when empty). */
export async function saveDay(date: string, meals: Meal[]): Promise<void> {
  const day = meals.filter(m => m.date === date)
  await upsertSetting(`${DAY_PREFIX}${date}`, day.length ? JSON.stringify(day) : null)
}

export async function loadFavourites(): Promise<FavouriteMeal[]> {
  return parseArray<FavouriteMeal>(await getSetting(FAV_KEY))
}

export async function saveFavourites(favs: FavouriteMeal[]): Promise<void> {
  await upsertSetting(FAV_KEY, favs.length ? JSON.stringify(favs) : null)
}
