'use client'

import Card from '@/components/ui/Card'
import { Macros, macroSplit, proteinTarget, PROTEIN_G_PER_KG } from '@/lib/nutrition'

// Validated (dataviz validator, dark #141414), fixed order protein → carbs → fat.
export const MACRO_COLORS = { protein: '#00A893', carbs: '#C7851F', fat: '#8B6CF0' }

const sub = 'var(--color-text-subtle)'
const r = Math.round

/** Glanceable day card: calories eaten vs burned, and the macro breakdown with a protein target. */
export default function DaySummary({
  macros, burned, weightKg, inProgress,
}: {
  macros: Macros
  burned: number | null
  weightKg: number | null
  inProgress: boolean
}) {
  const split = macroSplit(macros)
  const target = proteinTarget(weightKg)
  const deficit = burned != null ? burned - r(macros.kcal) : null
  const proteinPct = target ? Math.min(100, (macros.protein / target) * 100) : 0

  const macroRows = [
    { key: 'protein' as const, label: 'Protein', g: macros.protein },
    { key: 'carbs' as const, label: 'Carbs', g: macros.carbs },
    { key: 'fat' as const, label: 'Fat', g: macros.fat },
  ]

  return (
    <Card hover={false}>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <p className="text-4xl font-black" style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>
          {r(macros.kcal)}<span className="text-sm font-normal ml-1" style={{ color: sub }}>kcal eaten</span>
        </p>
        {deficit != null && (
          <p className="text-sm text-right" style={{ color: '#A0A0A0' }}>
            Burned{inProgress ? ' so far' : ''} <b style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>{burned}</b>
            <br />
            <b style={{ color: deficit >= 0 ? '#00BFA5' : '#E5484D', fontFamily: 'var(--font-mono)' }}>
              {deficit >= 0 ? `${deficit} deficit` : `${-deficit} surplus`}
            </b>
          </p>
        )}
      </div>

      {/* Calorie split: one bar, 2px surface gaps between segments */}
      <div className="flex gap-0.5 h-2 rounded-full overflow-hidden mt-4" style={{ background: '#1E1E1E' }} aria-hidden="true">
        {split && macroRows.map(m => split[m.key] > 0 && (
          <div key={m.key} style={{ width: `${split[m.key]}%`, background: MACRO_COLORS[m.key] }} />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        {macroRows.map(m => (
          <div key={m.key}>
            <p className="text-xs flex items-center gap-1.5" style={{ color: '#A0A0A0' }}>
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: MACRO_COLORS[m.key] }} />
              {m.label}
            </p>
            <p className="text-lg font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>
              {r(m.g)}<span className="text-xs font-normal" style={{ color: sub }}>g{m.key === 'protein' && target ? ` / ${target}` : ''}</span>
            </p>
            <p className="text-xs" style={{ color: sub }}>{split ? `${split[m.key]}% of kcal` : '—'}</p>
          </div>
        ))}
      </div>

      {target && (
        <div className="mt-3">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1E1E1E' }}
            role="progressbar" aria-label="Protein target" aria-valuenow={r(macros.protein)} aria-valuemin={0} aria-valuemax={target}>
            <div className="h-full rounded-full" style={{ width: `${proteinPct}%`, background: MACRO_COLORS.protein }} />
          </div>
          <p className="text-xs mt-1" style={{ color: sub }}>
            Protein target {target} g ({PROTEIN_G_PER_KG} g/kg at {weightKg} kg) — {macros.protein >= target ? 'hit' : `${r(target - macros.protein)} g to go`}
          </p>
        </div>
      )}
    </Card>
  )
}
