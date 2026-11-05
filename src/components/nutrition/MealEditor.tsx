'use client'

import { useState } from 'react'
import { Minus, Plus, X, Star } from 'lucide-react'
import Button from '@/components/ui/Button'
import {
  MealItem, PortionSize, PORTION_FACTOR, itemMacros, mealMacros, setItemSize, setItemGrams,
} from '@/lib/nutrition'

export interface MealDraft {
  title: string
  items: MealItem[]
  share: number
  comment?: string
  confidence?: string
  meta?: string
}

const SIZES = Object.keys(PORTION_FACTOR) as PortionSize[]
const sub = 'var(--color-text-subtle)'

function SizeToggle({ value, onChange, label }: { value: PortionSize | null; onChange: (s: PortionSize) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg overflow-hidden" style={{ border: '1px solid #2E2E2E' }}>
      {SIZES.map((s, i) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          aria-pressed={value === s}
          className="px-4 py-2 sm:px-3 sm:py-1 text-xs font-bold"
          style={{
            background: value === s ? '#00BFA5' : 'transparent',
            color: value === s ? '#0D0D0D' : '#A0A0A0',
            borderLeft: i ? '1px solid #2E2E2E' : 'none',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {s}
        </button>
      ))}
    </div>
  )
}

const r = Math.round

export default function MealEditor({
  draft, onChange, onSave, onDiscard, saving,
}: {
  draft: MealDraft
  onChange: (d: MealDraft) => void
  onSave: (favourite: boolean) => void
  onDiscard: () => void
  saving: boolean
}) {
  const [addName, setAddName] = useState('')
  const [addGrams, setAddGrams] = useState('')
  const [addKcal, setAddKcal] = useState('')

  const setItems = (items: MealItem[]) => onChange({ ...draft, items })
  const sizes = new Set(draft.items.map(i => i.size))
  const allSize = sizes.size === 1 ? [...sizes][0] : null
  const yours = mealMacros(draft)
  const whole = mealMacros({ items: draft.items, share: 1 })

  function addItem() {
    const name = addName.trim()
    const g = Number(addGrams)
    if (!name || !(g > 0)) return
    setItems([...draft.items, {
      name, grams: r(g), base: r(g), size: 'M',
      kcal_per_100g: Math.max(0, Number(addKcal) || 0), protein_per_100g: 0, carbs_per_100g: 0, fat_per_100g: 0,
    }])
    setAddName(''); setAddGrams(''); setAddKcal('')
  }

  const inputStyle = { background: '#1E1E1E', border: '1px solid #2E2E2E', color: '#F5F5F5', fontFamily: 'var(--font-sans)' }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <input
          value={draft.title}
          onChange={e => onChange({ ...draft, title: e.target.value })}
          aria-label="Meal name"
          className="flex-1 min-w-0 bg-transparent text-lg font-bold outline-none rounded-lg px-2 py-1 -mx-2"
          style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}
        />
        {draft.confidence && (
          <span className="text-xs rounded-full px-2 py-0.5 shrink-0" style={{ border: '1px solid #2E2E2E', color: sub }}>
            {draft.confidence} confidence
          </span>
        )}
      </div>

      {draft.items.length > 0 && (
        <div className="flex items-center justify-between gap-3 pb-3" style={{ borderBottom: '1px solid #2E2E2E' }}>
          <span className="text-sm" style={{ color: '#A0A0A0' }}>Whole meal portion</span>
          <SizeToggle label="Whole meal portion" value={allSize} onChange={s => setItems(draft.items.map(it => setItemSize(it, s)))} />
        </div>
      )}

      <div>
        {draft.items.length === 0 && (
          <p className="text-sm" style={{ color: sub }}>No food found. Add items below, or retake the photo.</p>
        )}
        {draft.items.map((it, i) => {
          const m = itemMacros(it)
          return (
            <div key={i} className="grid gap-3 py-3 items-center" style={{ gridTemplateColumns: '1fr auto auto', borderBottom: '1px solid #1E1E1E' }}>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: '#F5F5F5' }}>{it.name}</p>
                <p className="text-xs" style={{ color: sub, fontFamily: 'var(--font-mono)' }}>
                  {r(m.kcal)} kcal · {r(m.protein)}P {r(m.carbs)}C {r(m.fat)}F
                </p>
                <div className="mt-2">
                  <SizeToggle label={`${it.name} portion`} value={it.size} onChange={s => setItems(draft.items.map((x, j) => (j === i ? setItemSize(x, s) : x)))} />
                </div>
              </div>
              <label className="flex items-center gap-1">
                <input
                  type="number" inputMode="decimal" min={0}
                  value={it.grams}
                  onChange={e => setItems(draft.items.map((x, j) => (j === i ? setItemGrams(x, Number(e.target.value)) : x)))}
                  aria-label={`${it.name} grams`}
                  className="w-20 rounded-lg px-2 py-2 text-right text-base sm:text-sm"
                  style={inputStyle}
                />
                <span className="text-xs" style={{ color: sub }}>g</span>
              </label>
              <button type="button" onClick={() => setItems(draft.items.filter((_, j) => j !== i))} aria-label={`Remove ${it.name}`} className="p-2.5 -mr-2 rounded-lg" style={{ color: '#A0A0A0' }}>
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Phone: name on its own row, then grams / kcal / add. Desktop: one row. */}
      <div className="grid gap-2 grid-cols-[1fr_1fr_auto] sm:grid-cols-[1fr_72px_96px_auto]">
        <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Add item (e.g. olive oil)" aria-label="Item name" className="col-span-3 sm:col-span-1 rounded-lg px-3 py-2 text-base sm:text-sm min-w-0" style={inputStyle} />
        <input value={addGrams} onChange={e => setAddGrams(e.target.value)} type="number" inputMode="decimal" placeholder="grams" aria-label="Item grams" className="rounded-lg px-2 py-2 text-base sm:text-sm min-w-0" style={inputStyle} />
        <input value={addKcal} onChange={e => setAddKcal(e.target.value)} type="number" inputMode="decimal" placeholder="kcal/100g" aria-label="Item calories per 100 g" className="rounded-lg px-2 py-2 text-base sm:text-sm min-w-0" style={inputStyle} />
        <button type="button" onClick={addItem} aria-label="Add item" className="rounded-lg px-4 sm:px-3" style={{ background: '#242424', border: '1px solid #2E2E2E', color: '#F5F5F5' }}>
          <Plus size={16} />
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 py-3" style={{ borderTop: '1px solid #2E2E2E', borderBottom: '1px solid #2E2E2E' }}>
        <div>
          <p className="text-sm" style={{ color: '#A0A0A0' }}>Shared between</p>
          {draft.share > 1 && <p className="text-xs" style={{ color: sub }}>Whole dish {r(whole.kcal)} kcal · you get 1/{draft.share}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onChange({ ...draft, share: Math.max(1, draft.share - 1) })} disabled={draft.share <= 1} aria-label="Fewer people" className="p-3 sm:p-2 rounded-lg" style={{ background: '#242424', color: draft.share <= 1 ? '#606060' : '#F5F5F5' }}>
            <Minus size={14} />
          </button>
          <span className="w-16 text-center text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>
            {draft.share} {draft.share === 1 ? 'person' : 'people'}
          </span>
          <button type="button" onClick={() => onChange({ ...draft, share: Math.min(20, draft.share + 1) })} aria-label="More people" className="p-3 sm:p-2 rounded-lg" style={{ background: '#242424', color: '#F5F5F5' }}>
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest" style={{ color: '#00BFA5' }}>{draft.share > 1 ? 'Your share' : 'Total'}</p>
          <p className="text-xs mt-1" style={{ color: sub, fontFamily: 'var(--font-mono)' }}>
            {r(yours.protein)}g protein · {r(yours.carbs)}g carbs · {r(yours.fat)}g fat
          </p>
        </div>
        <p className="text-3xl font-black" style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>
          {r(yours.kcal)}<span className="text-sm font-normal ml-1" style={{ color: sub }}>kcal</span>
        </p>
      </div>

      {(draft.comment || draft.meta) && (
        <p className="text-xs" style={{ color: sub }}>{[draft.comment, draft.meta].filter(Boolean).join(' — ')}</p>
      )}

      {/* Phone: big full-width Save on top, the other two side by side below. */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button size="md" onClick={() => onSave(false)} disabled={saving || !draft.items.length} className="col-span-2 sm:order-last">
          {saving ? 'Saving…' : 'Save meal'}
        </Button>
        <Button variant="subtle" size="sm" onClick={onDiscard} disabled={saving}>Discard</Button>
        <Button variant="ghost" size="sm" onClick={() => onSave(true)} disabled={saving || !draft.items.length}>
          <Star size={14} /> Save + favourite
        </Button>
      </div>
    </div>
  )
}
