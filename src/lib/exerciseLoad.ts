// Volume multipliers: how many times the entered weight × reps is actually moved.
//
// Weights are entered per dumbbell, and single-leg/arm reps are entered per
// side, so weight × reps undercounts those lifts:
//   two-dumbbell lift             ×2  (one dumbbell per hand)
//   single-leg / single-arm       ×2  (reps done on each side)
//   single-leg holding dumbbells  ×4  (both of the above)
// Users can override any exercise; overrides are a JSON map in user_settings
// ('volume_multipliers'), keyed by lowercased exercise name like bwpct_overrides.

import { exercises } from './exerciseLibrary'

export type VolumeMultipliers = Record<string, number>
export const VOLUME_MULTIPLIER_OPTIONS = [1, 2, 4] as const

const UNILATERAL_ARM_RE = /single.?arm|one.?arm/i
const UNILATERAL_LEG_RE = /single.?leg|one.?leg|split.?squat|bulgarian|lunge|step|pistol/i
const LIBRARY_CATEGORY = new Map(exercises.map(e => [e.name.toLowerCase(), e.category as string]))

/** Category for a logged exercise, which only stores its name. */
function inferCategory(name: string): string | undefined {
  return LIBRARY_CATEGORY.get(name.trim().toLowerCase()) ?? (/dumbbell|\bdb\b/i.test(name) ? 'dumbbell' : undefined)
}

export function defaultVolumeMultiplier(name: string, category?: string): number {
  const dumbbell = (category ?? inferCategory(name)) === 'dumbbell'
  if (UNILATERAL_ARM_RE.test(name)) return 2
  if (UNILATERAL_LEG_RE.test(name)) return dumbbell ? 4 : 2
  return dumbbell ? 2 : 1
}

export function resolveVolumeMultiplier(name: string, category?: string, overrides?: VolumeMultipliers): number {
  const o = overrides?.[(name || '').trim().toLowerCase()]
  return typeof o === 'number' && o > 0 ? o : defaultVolumeMultiplier(name || '', category)
}

/** Σ weight × reps × multiplier for one exercise's sets. */
export function exerciseVolume(
  name: string,
  sets: { weight: string; reps: string }[],
  overrides?: VolumeMultipliers,
  category?: string,
): number {
  const m = resolveVolumeMultiplier(name, category, overrides)
  return sets.reduce((sum, s) => sum + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0) * m
}
