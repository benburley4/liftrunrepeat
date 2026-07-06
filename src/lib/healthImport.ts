// Pure parsing logic for the Apple Health import (Health Auto Export app).
// Kept out of the route file so it can be unit-tested and reused.

// ─── Health Auto Export payload shape ────────────────────────────────────────
// Health Auto Export sends either a top-level array or { data: { workouts: [] } }

export interface AppleWorkout {
  workoutActivityType: string   // e.g. "HKWorkoutActivityTypeRunning"
  startDate: string             // "2026-03-29 08:00:00 +0800"
  endDate:   string
  duration:  string             // "45.3 min"
  totalDistance?:       { qty: number; units: string }
  totalEnergyBurned?:   { qty: number; units: string }
  heartRateData?: { Avg?: number; Max?: number; Min?: number }
  elevation?: { ascent?: { qty: number; units: string } }
  sourceName?: string
}

// ─── Apple Health → session type mapping ─────────────────────────────────────

const WORKOUT_TYPE_MAP: Record<string, { type: string; name: string }> = {
  // Running
  HKWorkoutActivityTypeRunning:               { type: 'run',    name: 'Run' },
  HKWorkoutActivityTypeTrackAndField:         { type: 'run',    name: 'Track' },
  HKWorkoutActivityTypeTriathlon:             { type: 'run',    name: 'Triathlon' },
  // Hiking / walking
  HKWorkoutActivityTypeHiking:                { type: 'hike',   name: 'Hike' },
  HKWorkoutActivityTypeWalking:               { type: 'hike',   name: 'Walk' },
  // Strength / gym
  HKWorkoutActivityTypeTraditionalStrengthTraining: { type: 'lift', name: 'Strength' },
  HKWorkoutActivityTypeFunctionalStrengthTraining:  { type: 'lift', name: 'Functional Strength' },
  HKWorkoutActivityTypeCrossTraining:         { type: 'lift',   name: 'Cross Training' },
  HKWorkoutActivityTypeHighIntensityIntervalTraining: { type: 'lift', name: 'HIIT' },
  // Cycling / swimming — distinct types so they never pollute running km/pace stats
  HKWorkoutActivityTypeCycling:               { type: 'cycle',  name: 'Cycle' },
  HKWorkoutActivityTypeSwimming:              { type: 'swim',   name: 'Swim' },
}

export function mapWorkout(w: AppleWorkout): { type: string; name: string } {
  return WORKOUT_TYPE_MAP[w.workoutActivityType] ?? { type: 'hybrid', name: w.workoutActivityType ?? 'Workout' }
}

export function parseDate(dateStr: string): string {
  // Health Auto Export format: "2026-03-30 07:00:00 +0800"
  // Just grab the YYYY-MM-DD directly from the string — no Date parsing needed
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : dateStr.slice(0, 10)
}

export function parseKm(w: AppleWorkout): number | null {
  const dist = w.totalDistance
  if (!dist || !dist.qty) return null
  const units = (dist.units ?? '').toLowerCase()
  if (units.includes('km') || units.includes('kilometer')) return Math.round(dist.qty * 100) / 100
  if (units.includes('mi') || units.includes('mile'))       return Math.round(dist.qty * 1.60934 * 100) / 100
  if (units.includes('m') && !units.includes('mi'))         return Math.round(dist.qty / 10) / 100
  return Math.round(dist.qty * 100) / 100
}

export function parseElevationM(w: AppleWorkout): number | null {
  const asc = w.elevation?.ascent
  if (!asc || !asc.qty) return null
  const units = (asc.units ?? '').toLowerCase()
  if (units.includes('ft') || units.includes('foot') || units.includes('feet'))
    return Math.round(asc.qty * 0.3048)
  return Math.round(asc.qty)
}

function buildRunSegment(w: AppleWorkout, km: number | null) {
  if (!km) return []
  return [{
    id: `import-${crypto.randomUUID()}`,
    segmentType: 'run',
    metric: 'distance',
    plannedValue: String(km),
    plannedPace: '',
    actualValue: String(km),
    actualPace: '',
  }]
}

export function workoutToSession(w: AppleWorkout) {
  const { type, name } = mapWorkout(w)
  const date    = parseDate(w.startDate)
  // Build a stable unique ID from the date string without parsing it
  // Format: "2026-03-30 07:00:00 +0800" → "2026-03-30T07:00:00+08:00"
  const savedAt = w.startDate
    .replace(' ', 'T')
    .replace(/\s/, '')
    .replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
  const km      = parseKm(w)
  const elevM   = parseElevationM(w)

  const session: Record<string, unknown> = { type, name, date, savedAt, source: 'apple_health' }
  session.exercises = []
  session.run       = []

  if (type === 'hike') {
    if (km)    session.hikeKm         = km
    if (elevM) session.hikeElevationM = elevM
  } else if (type === 'run') {
    session.run = buildRunSegment(w, km)
  } else if (type === 'cycle' || type === 'swim') {
    // Distance stored on its own field — not as run segments — so running
    // analytics (weekly km, pace, VDOT) stay honest.
    if (km) session.distanceKm = km
  }

  return session
}
