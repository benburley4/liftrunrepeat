import { exercises } from './exerciseLibrary'
import type { CellData, Programme, StoredTemplate } from './programmeTypes'

// ─── Legs vs arms ─────────────────────────────────────────────────────────────

export const LOWER_BODY_INCREMENT_KG = 5
export const UPPER_BODY_INCREMENT_KG = 2.5

const LOWER_MUSCLES = new Set(['Quads', 'Glutes', 'Hamstrings', 'Adductors', 'Abductors', 'Calves', 'Hip Flexors'])
// Custom exercises carry no muscle data, so fall back to the name
const LOWER_NAME_RE = /squat|lunge|deadlift|\brdl\b|leg|step|calf|hip|glute|ham|quad|hop|nordic|good morning/i

/** True when the exercise's main muscle is in the legs/hips (library first, then name). */
export function isLowerBody(exerciseId: string, exerciseName: string): boolean {
  const lib = exercises.find(e => e.id === exerciseId)
  if (lib?.primaryMuscles?.length) return LOWER_MUSCLES.has(lib.primaryMuscles[0])
  return LOWER_NAME_RE.test(exerciseName)
}

export const BARBELL_INCREMENT_KG = 5
export const DUMBBELL_INCREMENT_KG = 2.5

/** Barbell +5 kg and dumbbell +2.5 kg regardless of body part; anything else goes by legs vs arms. */
export function incrementFor(exerciseId: string, exerciseName: string, category: string): number {
  if (category === 'barbell') return BARBELL_INCREMENT_KG
  if (category === 'dumbbell') return DUMBBELL_INCREMENT_KG
  return isLowerBody(exerciseId, exerciseName) ? LOWER_BODY_INCREMENT_KG : UPPER_BODY_INCREMENT_KG
}

function addKg(weight: string, kg: number): string {
  const n = parseFloat(weight)
  if (!n || !kg) return weight // blank / bodyweight-only sets stay as they are
  return String(Math.round((n + kg) * 100) / 100)
}

/** Deep-copies a template, adding `cycles` × each exercise's increment to every loaded set. */
export function progressTemplate(t: StoredTemplate, cycles: number): StoredTemplate {
  return {
    ...t,
    exerciseRows: t.exerciseRows?.map(r => {
      const kg = incrementFor(r.exerciseId, r.exerciseName, r.category) * cycles
      return { ...r, sets: r.sets.map(s => ({ ...s, weight: addKg(s.weight, kg) })) }
    }),
    runRows: t.runRows ? structuredClone(t.runRows) : undefined,
    hikeData: t.hikeData ? { ...t.hikeData } : undefined,
  }
}

// ─── Fill forward ─────────────────────────────────────────────────────────────

const CELL_KEY_RE = /^w(\d+)d(\d)(_2)?$/

/**
 * Repeats the first cycle across the programme: with a 4-week cycle, week 1
 * fills weeks 5 and 9, week 2 fills 6 and 10, week 3 fills 7 and 11, each
 * repeat adding one more increment (see incrementFor). Deload weeks (as targets or
 * sources) are left untouched. Target-week sessions are replaced.
 */
export function fillForwardCycles(programme: Programme, cycle = 4): { cells: Record<string, CellData>; weeksFilled: number[] } {
  const isDeload = (w: number) => !!programme.deloads?.[w]
  const cells = { ...programme.cells }
  const weeksFilled: number[] = []

  for (let w = cycle; w < programme.weeks; w++) {
    const src = w % cycle
    if (isDeload(w) || isDeload(src)) continue
    const cycles = Math.floor(w / cycle)
    for (const key of Object.keys(cells)) {
      if (key.startsWith(`w${w}d`)) delete cells[key]
    }
    for (const [key, cell] of Object.entries(programme.cells)) {
      const m = key.match(CELL_KEY_RE)
      if (!m || Number(m[1]) !== src) continue
      cells[`w${w}d${m[2]}${m[3] ?? ''}`] = { rpe: 0, template: progressTemplate(cell.template, cycles) }
    }
    weeksFilled.push(w)
  }
  return { cells, weeksFilled }
}

// ─── Logged sessions vs plan ──────────────────────────────────────────────────

export interface LoggedSet { reps: string; weight: string }

interface LoggedExercise { exerciseName?: string; actualSets?: LoggedSet[] }
interface LoggedSession { name: string; date: string; exercises?: unknown[] }

/**
 * Finds what was actually logged for a planned session: same date, same
 * session name (case-insensitive). Returns exerciseName → actual sets.
 */
export function loggedSetsFor(sessions: LoggedSession[], date: string, sessionName: string): Map<string, LoggedSet[]> | null {
  const name = sessionName.trim().toLowerCase()
  const s = sessions.find(x => x.date === date && x.name?.trim().toLowerCase() === name)
  if (!s) return null
  const out = new Map<string, LoggedSet[]>()
  for (const e of (s.exercises ?? []) as LoggedExercise[]) {
    if (e.exerciseName) out.set(e.exerciseName.trim().toLowerCase(), e.actualSets ?? [])
  }
  return out
}
