// Single source of truth for bodyweight-exercise load handling.
//
// Bodyweight moves don't lift your full mass — a squat leaves feet/shanks
// planted (~85%), a push-up loads ~64%, a pull-up ~100%. We express this as a
// "% of bodyweight moved" per movement, so an est. 1RM for a bodyweight set is
//   load = bodyweight × pct/100 + any added weight.
//
// Detection is driven by the exercise library (category === 'bodyweight') plus a
// name-based fallback for custom/typed names. Analytics additionally treats an
// exercise whose sets are mostly logged at zero weight as bodyweight.

import { exercises } from './exerciseLibrary'
import { getSetting, upsertSetting } from './db'

const BW_LIBRARY_NAMES = new Set(
  exercises.filter(e => e.category === 'bodyweight').map(e => e.name.toLowerCase())
)

// Names that are safe to treat as bodyweight by pattern (no collision with
// loaded barbell/machine lifts). Deliberately excludes plain "leg press",
// "back squat", etc.
const BW_NAME_RE = /pull.?up|chin.?up|push.?up|\bdip\b|nordic|pistol|muscle.?up|plank|sit.?up|hollow|inverted row|\bring\b|bodyweight|air squat|walking lunge|reverse lunge|sissy|spanish squat|split squat|bulgarian|glute bridge|burpee|mountain climber|bird.?dog|bear crawl|superman|leg raise|crunch|bicycle|dead.?bug|wall.?sit|high knee|inchworm|jump squat|step.?up|isometric/i

export function isBodyweightExercise(name: string): boolean {
  const n = (name || '').toLowerCase()
  return BW_LIBRARY_NAMES.has(n) || BW_NAME_RE.test(n)
}

// Percentage (0–100) of bodyweight actually moved by a bodyweight movement.
// Sensible population-average defaults, grouped by movement family.
export function bodyweightPct(name: string): number {
  const n = (name || '').toLowerCase()
  // Full-body vertical pull / hang
  if (/muscle.?up|pull.?up|chin.?up/.test(n)) return 100
  if (/\bdip\b/.test(n)) return 95
  // Push-up family
  if (/pike.?push/.test(n)) return 70
  if (/push.?up/.test(n)) return 64
  // Squat / lunge / single-leg — feet planted (~85%)
  if (/pistol|sissy|spanish|split.?squat|bulgarian|lunge|step.?up|wall.?sit|air squat|bodyweight squat|jump squat|isometric/.test(n)) return 85
  if (/glute bridge|hip thrust/.test(n)) return 55
  // Locomotion / plank family
  if (/burpee|mountain climber|bear crawl|inchworm|high knee|plank/.test(n)) return 60
  // Floor core
  if (/hollow|leg raise|sit.?up|crunch|bicycle|superman|bird.?dog|dead.?bug|contralateral/.test(n)) return 45
  return 100
}

// ── Per-exercise overrides (edited once in the Library, applied everywhere) ───
// Stored as a single JSON map { [exerciseName lowercased]: pct } in user_settings.
export type BwOverrides = Record<string, number>

export function resolveBodyweightPct(name: string, overrides?: BwOverrides): number {
  const o = overrides?.[(name || '').toLowerCase()]
  return typeof o === 'number' && o > 0 ? o : bodyweightPct(name)
}

export async function getBwOverrides(): Promise<BwOverrides> {
  try {
    const raw = await getSetting('bwpct_overrides')
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed as BwOverrides : {}
  } catch { return {} }
}

// Save (or clear, when pct is null) a single exercise's override, returning the new map.
export async function saveBwOverride(name: string, pct: number | null): Promise<BwOverrides> {
  const cur = await getBwOverrides()
  const key = (name || '').toLowerCase()
  if (pct == null || isNaN(pct)) delete cur[key]
  else cur[key] = Math.min(100, Math.max(1, Math.round(pct)))
  await upsertSetting('bwpct_overrides', JSON.stringify(cur))
  return cur
}
