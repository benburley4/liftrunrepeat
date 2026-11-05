'use client'

import { useState } from 'react'
import { GlassWater, Check } from 'lucide-react'
import Card from '@/components/ui/Card'
import { DRINKS, DrinkPreset, PortionSize, PORTION_FACTOR } from '@/lib/nutrition'

const sub = 'var(--color-text-subtle)'
const SIZE_LABEL: Record<PortionSize, string> = { S: 'Small', M: 'Regular', L: 'Large' }

/** One-tap drinks: pick a size, tap a drink — logged with no photo or AI call. */
export default function DrinksCard({
  onLog, fluidsMl, busy,
}: {
  onLog: (p: DrinkPreset, size: PortionSize) => Promise<void>
  fluidsMl: number
  busy: boolean
}) {
  const [size, setSize] = useState<PortionSize>('M')
  const [justLogged, setJustLogged] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  // First six are the everyday ones; the rest sit behind "More drinks" so the card stays short on a phone.
  const shown = showAll ? DRINKS : DRINKS.slice(0, 6)

  async function log(p: DrinkPreset) {
    await onLog(p, size)
    setJustLogged(p.id)
    setTimeout(() => setJustLogged(id => (id === p.id ? null : id)), 1500)
  }

  return (
    <Card hover={false}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold flex items-center gap-2" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>
            <GlassWater size={16} color="#00BFA5" /> Drinks
          </p>
          <p className="text-xs" style={{ color: sub }}>Tap to log — no photo needed. Anything else: use Describe.</p>
        </div>
        <p className="text-right shrink-0" style={{ fontFamily: 'var(--font-mono)' }}>
          <span className="text-lg font-bold" style={{ color: '#F5F5F5' }}>{(fluidsMl / 1000).toFixed(1)}</span>
          <span className="text-xs ml-1" style={{ color: sub }}>L today</span>
        </p>
      </div>

      <div role="group" aria-label="Drink size" className="grid grid-cols-3 gap-1 p-1 rounded-xl mt-3" style={{ background: '#1E1E1E' }}>
        {(Object.keys(PORTION_FACTOR) as PortionSize[]).map(s => (
          <button
            key={s} type="button" onClick={() => setSize(s)} aria-pressed={size === s}
            className="py-2 rounded-lg text-xs font-bold"
            style={{ background: size === s ? 'rgba(0,191,165,0.12)' : 'transparent', color: size === s ? '#00BFA5' : '#A0A0A0' }}
          >
            {SIZE_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
        {shown.map(p => {
          const ml = Math.round(p.ml * PORTION_FACTOR[size])
          const kcal = Math.round(p.kcal * PORTION_FACTOR[size])
          const done = justLogged === p.id
          return (
            <button
              key={p.id} type="button" onClick={() => log(p)} disabled={busy}
              aria-label={`Log ${SIZE_LABEL[size].toLowerCase()} ${p.name}, ${ml} ml, ${kcal} kcal`}
              className="text-left rounded-xl px-3 py-2.5 transition-all active:scale-[0.97]"
              style={{ background: done ? 'rgba(0,191,165,0.16)' : '#1E1E1E', border: `1px solid ${done ? '#00BFA5' : '#2E2E2E'}` }}
            >
              <p className="text-sm font-bold leading-tight flex items-center gap-1" style={{ color: '#F5F5F5' }}>
                {done && <Check size={14} color="#00BFA5" />}{p.name}
              </p>
              <p className="text-xs mt-0.5" style={{ color: sub, fontFamily: 'var(--font-mono)' }}>{ml} ml · {kcal} kcal</p>
            </button>
          )
        })}
      </div>
      <button
        type="button" onClick={() => setShowAll(v => !v)} aria-expanded={showAll}
        className="w-full mt-2 py-2.5 rounded-xl text-sm font-bold"
        style={{ color: '#00BFA5', background: 'transparent', border: '1px solid #2E2E2E' }}
      >
        {showAll ? 'Fewer drinks' : `More drinks (${DRINKS.length - 6})`}
      </button>
    </Card>
  )
}
