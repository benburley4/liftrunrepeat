// Validation for AI-generated programme JSON (generate + revamp routes output
// this shape; the client expands phases into week-by-week cells).

export interface AIProgrammeSet { reps: string; weight: string }
export interface AIProgrammeExercise { exerciseName: string; category?: string; sets: AIProgrammeSet[] }
export interface AIProgrammeRunRow { segmentType: string; metric: string; value: string }
export interface AIProgrammeSession {
  rpe: number
  template: {
    name: string
    type: string
    exerciseRows?: AIProgrammeExercise[]
    runRows?: AIProgrammeRunRow[]
  }
}
export interface AIProgrammePhase {
  name: string
  startWeek: number
  endWeek: number
  deloadWeeks?: number[]
  sessions: Record<string, AIProgrammeSession>
}
export interface AIProgramme {
  name: string
  weeks: number
  weightProgressKgPerWeek?: number
  runProgressMinPerWeek?: number
  phases: AIProgrammePhase[]
}

/**
 * Validates a parsed AI programme object. Returns the typed programme,
 * or throws an Error with a human-readable reason.
 */
export function validateAIProgramme(data: unknown): AIProgramme {
  const fail = (msg: string): never => { throw new Error(`AI returned an invalid programme: ${msg}`) }

  if (!data || typeof data !== 'object') fail('response is not a JSON object')
  const p = data as Record<string, unknown>

  if (typeof p.name !== 'string' || !p.name.trim()) fail('missing programme name')
  if (typeof p.weeks !== 'number' || p.weeks < 1 || p.weeks > 52) fail('invalid weeks count')
  if (!Array.isArray(p.phases) || p.phases.length === 0) fail('no phases')

  for (const [i, ph] of (p.phases as Record<string, unknown>[]).entries()) {
    const label = `phase ${i + 1}`
    if (!ph || typeof ph !== 'object') fail(`${label} is not an object`)
    if (typeof ph.startWeek !== 'number' || typeof ph.endWeek !== 'number') fail(`${label} missing week range`)
    if ((ph.startWeek as number) > (ph.endWeek as number)) fail(`${label} startWeek > endWeek`)
    const sessions = ph.sessions
    if (!sessions || typeof sessions !== 'object' || Array.isArray(sessions)) fail(`${label} has no sessions`)
    for (const [dayKey, s] of Object.entries(sessions as Record<string, unknown>)) {
      if (!/^d[1-7]$/.test(dayKey)) fail(`${label} has invalid day key "${dayKey}"`)
      const sess = s as Record<string, unknown>
      const tpl = sess?.template as Record<string, unknown> | undefined
      if (!tpl || typeof tpl.name !== 'string' || typeof tpl.type !== 'string') {
        throw new Error(`AI returned an invalid programme: ${label} ${dayKey} session is malformed`)
      }
      if (tpl.exerciseRows !== undefined && !Array.isArray(tpl.exerciseRows)) fail(`${label} ${dayKey} exerciseRows is not an array`)
      if (tpl.runRows !== undefined && !Array.isArray(tpl.runRows)) fail(`${label} ${dayKey} runRows is not an array`)
    }
  }

  // Phase continuity: first starts at week 1, last ends at total weeks
  const phases = p.phases as { startWeek: number; endWeek: number }[]
  if (phases[0].startWeek !== 1) fail('first phase does not start at week 1')
  if (phases[phases.length - 1].endWeek !== p.weeks) fail('last phase does not end at the final week')

  return data as AIProgramme
}
