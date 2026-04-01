/**
 * POST /api/health-import
 * Receives workout data from the "Health Auto Export" iOS app and saves
 * sessions to Supabase. Secured with a static API key in HEALTH_IMPORT_SECRET.
 *
 * Health Auto Export setup:
 *   Export type: REST API
 *   URL: https://<your-domain>/api/health-import
 *   Header: x-api-key: <HEALTH_IMPORT_SECRET value>
 *   Data types: Workouts
 *   Format: JSON
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!   // service role — bypasses RLS
const IMPORT_SECRET = process.env.HEALTH_IMPORT_SECRET ?? ''

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
  // Cycling
  HKWorkoutActivityTypeCycling:               { type: 'run',    name: 'Cycle' },
  // Swimming
  HKWorkoutActivityTypeSwimming:              { type: 'run',    name: 'Swim' },
}

function mapWorkout(w: AppleWorkout): { type: string; name: string } {
  return WORKOUT_TYPE_MAP[w.workoutActivityType] ?? { type: 'hybrid', name: w.workoutActivityType ?? 'Workout' }
}

// ─── Health Auto Export payload shape ────────────────────────────────────────
// Health Auto Export sends either a top-level array or { data: { workouts: [] } }

interface AppleWorkout {
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

function parseDate(dateStr: string): string {
  // Health Auto Export format: "2026-03-30 07:00:00 +0800"
  // Just grab the YYYY-MM-DD directly from the string — no Date parsing needed
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : dateStr.slice(0, 10)
}

function parseKm(w: AppleWorkout): number | null {
  const dist = w.totalDistance
  if (!dist || !dist.qty) return null
  const units = (dist.units ?? '').toLowerCase()
  if (units.includes('km') || units.includes('kilometer')) return Math.round(dist.qty * 100) / 100
  if (units.includes('mi') || units.includes('mile'))       return Math.round(dist.qty * 1.60934 * 100) / 100
  if (units.includes('m') && !units.includes('mi'))         return Math.round(dist.qty / 10) / 100
  return Math.round(dist.qty * 100) / 100
}

function parseElevationM(w: AppleWorkout): number | null {
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
    id: `import-${Date.now()}`,
    segmentType: 'run',
    metric: 'distance',
    plannedValue: String(km),
    plannedPace: '',
    actualValue: String(km),
    actualPace: '',
  }]
}

function workoutToSession(w: AppleWorkout) {
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

  if (type === 'hike') {
    if (km)    session.hikeKm        = km
    if (elevM) session.hikeElevationM = elevM
    session.run       = []
    session.exercises = []
  } else if (type === 'run') {
    session.run       = buildRunSegment(w, km)
    session.exercises = []
  } else {
    session.exercises = []
    session.run       = []
  }

  return session
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth
  const key = req.headers.get('x-api-key') ?? req.nextUrl.searchParams.get('api_key') ?? ''
  if (!IMPORT_SECRET || key !== IMPORT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Health Auto Export sends { data: { workouts: [...] } } or just [...]
  let workouts: AppleWorkout[] = []
  if (Array.isArray(body)) {
    workouts = body as AppleWorkout[]
  } else {
    const b = body as Record<string, unknown>
    const data = (b.data ?? b) as Record<string, unknown>
    workouts = (data.workouts ?? data.Workouts ?? []) as AppleWorkout[]
  }

  if (!workouts.length) {
    return NextResponse.json({ imported: 0, message: 'No workouts in payload' })
  }

  // Build session rows
  const sessions = workouts.map(workoutToSession)

  // Upsert into Supabase using service role (no user auth needed server-side)
  // Sessions are keyed by saved_at so re-importing is idempotent.
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  // Resolve user — store against the first user that has HEALTH_IMPORT_USER_ID set,
  // or fall back to HEALTH_IMPORT_USER_EMAIL to look up the user id.
  const userId = process.env.HEALTH_IMPORT_USER_ID
  if (!userId) {
    return NextResponse.json({ error: 'HEALTH_IMPORT_USER_ID env var not set' }, { status: 500 })
  }

  const rows = sessions.map(s => ({
    saved_at: s.savedAt,
    data: s,
    user_id: userId,
  }))

  const { error } = await supabase
    .from('sessions')
    .upsert(rows, { onConflict: 'saved_at' })

  if (error) {
    console.error('health-import upsert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ imported: rows.length })
}
