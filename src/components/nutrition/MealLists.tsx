'use client'

import { Plus, Star, Trash2, Users, Repeat, GlassWater, Pencil } from 'lucide-react'
import Card from '@/components/ui/Card'
import { Meal, mealMacros } from '@/lib/nutrition'
import type { FavouriteMeal } from '@/lib/nutritionStore'

const sub = 'var(--color-text-subtle)'
const r = Math.round

function Thumb({ src, drink }: { src?: string; drink?: boolean }) {
  const Icon = drink ? GlassWater : Repeat
  return src
    // eslint-disable-next-line @next/next/no-img-element -- stored data URL thumbnail
    ? <img src={src} alt="" className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover shrink-0" />
    : <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg shrink-0 flex items-center justify-center" style={{ background: '#1E1E1E' }}><Icon size={16} color={drink ? '#00BFA5' : '#606060'} /></div>
}

/** Favourites + recent meals — one tap logs it again, no photo or AI call. */
export function RepeatMeals({
  favourites, recent, onLog, onUnfavourite, busy,
}: {
  favourites: FavouriteMeal[]
  recent: Meal[]
  onLog: (m: Pick<Meal, 'title' | 'items' | 'share' | 'thumb'>) => void
  onUnfavourite: (id: string) => void
  busy: boolean
}) {
  const favTitles = new Set(favourites.map(f => f.title.trim().toLowerCase()))
  const recentOnly = recent.filter(m => !favTitles.has(m.title.trim().toLowerCase()))
  if (!favourites.length && !recentOnly.length) return null

  const row = (key: string, m: Pick<Meal, 'title' | 'items' | 'share' | 'thumb'>, fav?: FavouriteMeal) => (
    <div key={key} className="flex items-center gap-3 py-3" style={{ borderBottom: '1px solid #1E1E1E' }}>
      <Thumb src={m.thumb} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold line-clamp-2 break-words" style={{ color: '#F5F5F5' }}>
          {fav && <Star size={12} className="inline mr-1 -mt-0.5" color="#00BFA5" fill="#00BFA5" />}{m.title}
        </p>
        <p className="text-xs mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: sub }}>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{r(mealMacros(m).kcal)} kcal{m.share > 1 ? ` · ÷${m.share}` : ''}</span>
          {fav && (
            <button type="button" onClick={() => onUnfavourite(fav.id)} className="underline underline-offset-2 py-1" style={{ color: '#8A8A8A' }}>
              Remove
            </button>
          )}
        </p>
      </div>
      <button
        type="button" onClick={() => onLog(m)} disabled={busy}
        aria-label={`Log ${m.title} again`}
        className="shrink-0 flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-bold"
        style={{ background: 'rgba(0,191,165,0.12)', color: '#00BFA5' }}
      >
        <Plus size={16} /> Log
      </button>
    </div>
  )

  return (
    <Card hover={false}>
      <p className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>Log a repeat meal</p>
      <p className="text-xs mb-2" style={{ color: sub }}>Favourites and recent meals — no photo needed.</p>
      {favourites.map(f => row(f.id, f, f))}
      {recentOnly.slice(0, 6).map(m => row(m.id, m))}
    </Card>
  )
}

export function DayMeals({
  meals, favouriteTitles, onDelete, onFavourite, onEdit, label,
}: {
  meals: Meal[]
  favouriteTitles: Set<string>
  onDelete: (m: Meal) => void
  onFavourite: (m: Meal) => void
  onEdit: (m: Meal) => void
  label: string
}) {
  return (
    <Card hover={false}>
      <p className="text-sm font-bold mb-2" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>{label}</p>
      {!meals.length && <p className="text-sm" style={{ color: sub }}>Nothing logged yet.</p>}
      {meals.map(m => {
        const t = mealMacros(m)
        const fav = favouriteTitles.has(m.title.trim().toLowerCase())
        return (
          <div key={m.id} className="flex items-start gap-3 py-3" style={{ borderBottom: '1px solid #1E1E1E' }}>
            <Thumb src={m.thumb} drink={m.kind === 'drink'} />
            <div className="flex-1 min-w-0">
              {/* Tapping the name / calories opens the editor */}
              <button type="button" onClick={() => onEdit(m)} aria-label={`Edit ${m.title}`} className="w-full flex items-start justify-between gap-3 text-left">
                <span className="text-sm font-bold line-clamp-2 break-words min-w-0" style={{ color: '#F5F5F5' }}>{m.title}</span>
                <span className="shrink-0 text-base font-bold leading-5" style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>
                  {r(t.kcal)}<span className="text-xs font-normal ml-0.5" style={{ color: sub }}>kcal</span>
                </span>
              </button>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className="text-xs min-w-0 truncate" style={{ color: sub }}>
                  {new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {m.share > 1 && <> · <Users size={11} className="inline -mt-0.5" /> ÷{m.share}</>}
                  {m.kind === 'drink'
                    ? <>{' · '}{r(m.items.reduce((a, it) => a + it.grams, 0) / Math.max(1, m.share))} ml</>
                    : <>{' · '}{r(t.protein)}P {r(t.carbs)}C {r(t.fat)}F</>}
                </p>
                <div className="shrink-0 flex -mr-2">
                  <button type="button" onClick={() => onEdit(m)} aria-label={`Edit ${m.title}`} className="p-2.5 rounded-lg" style={{ color: '#8A8A8A' }}>
                    <Pencil size={16} />
                  </button>
                  <button type="button" onClick={() => onFavourite(m)} disabled={fav} aria-label={fav ? 'Already a favourite' : `Add ${m.title} to favourites`} className="p-2.5 rounded-lg">
                    <Star size={16} color={fav ? '#00BFA5' : '#8A8A8A'} fill={fav ? '#00BFA5' : 'none'} />
                  </button>
                  <button type="button" onClick={() => onDelete(m)} aria-label={`Delete ${m.title}`} className="p-2.5 rounded-lg" style={{ color: '#8A8A8A' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </Card>
  )
}
