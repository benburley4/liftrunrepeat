'use client'

import { defaultVolumeMultiplier, resolveVolumeMultiplier, VOLUME_MULTIPLIER_OPTIONS } from '@/lib/exerciseLoad'
import { saveVolumeMultiplier, useVolumeMultipliers } from '@/lib/useExerciseLoad'

/**
 * Per-exercise "×1 / ×2 / ×4" volume multiplier. Saved to the user's account
 * and applied everywhere volume is shown. Picking the default clears the override.
 */
export default function VolumeMultiplierSelect({ name, category }: { name: string; category?: string }) {
  const overrides = useVolumeMultipliers()
  if (!name.trim()) return null
  const value = resolveVolumeMultiplier(name, category, overrides)
  const def = defaultVolumeMultiplier(name, category)

  return (
    <select
      value={value}
      onClick={e => e.stopPropagation()}
      onChange={e => {
        const v = Number(e.target.value)
        saveVolumeMultiplier(name, v === def ? null : v).catch(console.error)
      }}
      title="Volume multiplier: ×2 for two dumbbells or reps per side, ×4 for single-leg with two dumbbells"
      aria-label={`${name} volume multiplier`}
      style={{ padding: '1px 4px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)', cursor: 'pointer', background: '#1E1E1E', color: value === 1 ? '#8A8A8A' : '#A78BFA', border: `1px solid ${value === 1 ? '#2E2E2E' : '#A78BFA55'}` }}
    >
      {VOLUME_MULTIPLIER_OPTIONS.map(m => (
        <option key={m} value={m}>×{m}{m === def ? ' (default)' : ''}</option>
      ))}
    </select>
  )
}
