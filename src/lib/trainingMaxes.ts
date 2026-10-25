import { epleyRM } from './computeStats'

// Estimated 1RMs are unreliable from high-rep sets, so only sets of this many
// reps or fewer count towards an exercise's best.
export const MAX_REPS_FOR_E1RM = 10

interface LoggedSession { exercises?: unknown[] }
interface LoggedExercise { exerciseName?: string; actualSets?: { weight: string; reps: string }[] }

/** Best logged estimated 1RM per exercise (lowercased name → kg). */
export function bestLoggedE1RMs(sessions: LoggedSession[]): Map<string, number> {
  const best = new Map<string, number>()
  for (const s of sessions) {
    for (const ex of (s.exercises ?? []) as LoggedExercise[]) {
      if (!ex.exerciseName) continue
      const key = ex.exerciseName.trim().toLowerCase()
      for (const set of ex.actualSets ?? []) {
        const w = parseFloat(set.weight), r = parseInt(set.reps)
        if (!(w > 0) || !(r > 0) || r > MAX_REPS_FOR_E1RM) continue
        const rm = epleyRM(w, r)
        if (rm > (best.get(key) ?? 0)) best.set(key, rm)
      }
    }
  }
  return best
}

/** Planned weight as a % of the best estimated 1RM, or null when either is unknown. */
export function pctOfBest(weight: string, best: number | undefined): number | null {
  const w = parseFloat(weight)
  return w > 0 && best && best > 0 ? Math.round((w / best) * 100) : null
}

/** Colour band for a %1RM: light < 70, moderate 70–84, heavy 85+. */
export function intensityColor(pct: number): string {
  if (pct >= 85) return '#EF4444'
  if (pct >= 70) return '#F59E0B'
  return '#00BFA5'
}
