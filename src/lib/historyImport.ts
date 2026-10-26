// Pure parsing for the one-off history backfill (scripts/backfill-history.mjs):
// a Garmin Connect data export (summarizedActivities.json) and a Strong app
// CSV export. Garmin activities are converted to the ZeppWorkout shape so the
// Zepp planner (src/lib/zeppImport.ts) does the matching: a Garmin strength
// activity on the same day as a Strong session attaches its watch stats to
// that session, and Strong's sets/weights are kept as logged.

import type { ZeppWorkout } from './zeppImport'

// ─── Garmin ──────────────────────────────────────────────────────────────────

/** The fields we use from a summarizedActivitiesExport entry. Garmin's export
 *  units: times in ms, distance/elevation in cm, calories in kJ-ish units
 *  (kcal × 4.184), stride in cm. */
export interface GarminActivity {
  activityId: number
  activityType: string
  startTimeGmt: number
  startTimeLocal: number
  duration?: number
  elapsedDuration?: number
  movingDuration?: number
  distance?: number
  elevationGain?: number
  elevationLoss?: number
  minElevation?: number
  maxElevation?: number
  avgHr?: number
  maxHr?: number
  calories?: number
  steps?: number
  aerobicTrainingEffect?: number
  anaerobicTrainingEffect?: number
  activityTrainingLoad?: number
  avgDoubleCadence?: number
  avgRunCadence?: number
  avgStrideLength?: number
}

// Garmin type → the ZeppBridge type name the planner understands. Anything
// unlisted passes through (the planner names it, e.g. "Indoor Rowing").
const GARMIN_TYPE_MAP: Record<string, string> = {
  walking: 'walking',
  hiking: 'hiking',
  running: 'run',
  treadmill_running: 'indoor_running',
  trail_running: 'trail_run',
  strength_training: 'strength',
  lap_swimming: 'pool_swimming',
  open_water_swimming: 'open_water_swimming',
  cycling: 'cycling',
  tennis_v2: 'tennis',
  resort_snowboarding: 'snowboarding',
}

// Not training sessions.
export const SKIPPED_GARMIN_TYPES = new Set(['breathwork', 'single_gas_diving', 'assistance'])

const isoSeconds = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, '+00:00')
const positive = (n: number | undefined | null) => (n != null && n > 0 ? n : null)

/** UTC offset of the activity in minutes (+480 for Hong Kong). */
export function garminOffsetMin(a: GarminActivity): number {
  return Math.round((a.startTimeLocal - a.startTimeGmt) / 60000)
}

/** Minutes → an Intl offset time zone, e.g. 480 → "+08:00". */
export function offsetZone(min: number): string {
  const sign = min < 0 ? '-' : '+'
  const abs = Math.abs(min)
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
}

export function garminToWorkout(a: GarminActivity): ZeppWorkout {
  const ms = a.elapsedDuration ?? a.duration ?? 0
  const cm = (n: number | undefined) => (n != null ? n / 100 : null)
  return {
    workoutId: `garmin-${a.activityId}`,
    workoutType: GARMIN_TYPE_MAP[a.activityType] ?? a.activityType,
    startTime: isoSeconds(a.startTimeGmt),
    endTime: isoSeconds(a.startTimeGmt + ms),
    distanceM: positive(cm(a.distance)),
    elevationGainM: cm(a.elevationGain),
    elevationLossM: cm(a.elevationLoss),
    minAltitudeM: cm(a.minElevation),
    maxAltitudeM: cm(a.maxElevation),
    avgHr: a.avgHr ?? null,
    maxHr: a.maxHr ?? null,
    calories: a.calories ? Math.round(a.calories / 4.184) : null,
    totalSteps: positive(a.steps),
    movingSeconds: a.movingDuration ? Math.round(a.movingDuration / 1000) : null,
    trainingEffect: positive(a.aerobicTrainingEffect),
    anaerobicTrainingEffect: positive(a.anaerobicTrainingEffect),
    trainingLoad: positive(a.activityTrainingLoad),
    avgCadenceSpm: positive(a.avgDoubleCadence) ?? (a.avgRunCadence ? a.avgRunCadence * 2 : null),
    avgStrideCm: positive(a.avgStrideLength),
  }
}

// ─── Strong ──────────────────────────────────────────────────────────────────

// Strong exercise → the name used on the site (exercise library / past logs),
// so PRs and load history join up. Unlisted names are kept as-is.
export const STRONG_EXERCISE_MAP: Record<string, string> = {
  'Squat (Barbell)': 'Back Squat',
  'Front Squat (Barbell)': 'Front Squat',
  'Bench Press (Barbell)': 'Bench Press',
  'Bench Press (Dumbbell)': 'Dumbbell Bench Press',
  'Bench Press - Close Grip (Barbell)': 'Close Grip Bench Press',
  'Bench Press - Wide Grip (Barbell)': 'Wide Grip Bench Press',
  'Bench Press (Smith Machine)': 'Smith Machine Bench Press',
  'Bench Press (Cable)': 'Cable Bench Press',
  'Strict Military Press (Barbell)': 'Overhead Press',
  'Sumo Deadlift (Barbell)': 'Sumo Deadlift',
  'Romanian Deadlift (Barbell)': 'Romanian Deadlift',
  'Pull Up': 'Pull-up',
  'Lat Pulldown - Underhand (Cable)': 'Lat Pulldown',
  'Seated Row (Cable)': 'Seated Cable Row',
  'Seated Leg Curl (Machine)': 'Seated Leg Curl',
  'Seated Leg Press (Machine)': 'Leg Press',
  'Hack Squat': 'Hack Squat Machine',
  'Goblet Squat (Kettlebell)': 'Goblet Squat',
  'Bulgarian Split Squat': 'Dumbbell Bulgarian Split Squat',
}

export interface StrongSession {
  /** Local wall-clock start, "YYYY-MM-DDTHH:MM" (Strong exports no zone). */
  localStart: string
  date: string
  name: string
  exercises: { exerciseName: string; sets: { weight: string; reps: string; rpe: string }[] }[]
}

/** "23/11/2023 17:13" → "2023-11-23T17:13". */
function strongLocal(ts: string): string {
  const [d, t = '00:00'] = ts.trim().split(' ')
  const [dd, mm, yy] = d.split('/')
  const [h, m] = t.split(':')
  return `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T${h.padStart(2, '0')}:${m.padStart(2, '0')}`
}

/** "22-11-23 Wednesday " → "Wednesday"; "XX Monday" → "Monday". */
export function strongSessionName(raw: string): string {
  const name = raw.trim().replace(/^(\d{1,2}-\d{1,2}-\d{2,4}|XX)\s+/i, '').trim()
  return name || 'Strength'
}

const num = (s: string) => (s === '' || Number(s) === 0 ? '0' : String(Number(s)))

/** Parses a Strong CSV export (one row per set) into sessions. */
export function parseStrongCsv(text: string): StrongSession[] {
  const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/)
  const head = lines[0].split(',').map(h => h.trim())
  const col = (n: string) => head.indexOf(n)
  const [iDate, iWorkout, iEx, iWeight, iReps, iRpe] =
    ['Date', 'Workout Name', 'Exercise Name', 'Weight', 'Reps', 'RPE'].map(col)
  const sessions = new Map<string, StrongSession>()
  for (const line of lines.slice(1)) {
    const c = line.split(',')
    if (!c[iDate]) continue
    const localStart = strongLocal(c[iDate])
    let s = sessions.get(localStart)
    if (!s) {
      s = { localStart, date: localStart.slice(0, 10), name: strongSessionName(c[iWorkout] ?? ''), exercises: [] }
      sessions.set(localStart, s)
    }
    const name = STRONG_EXERCISE_MAP[c[iEx].trim()] ?? c[iEx].trim()
    let ex = s.exercises.find(e => e.exerciseName === name)
    if (!ex) s.exercises.push(ex = { exerciseName: name, sets: [] })
    ex.sets.push({ weight: num(c[iWeight]), reps: num(c[iReps]), rpe: (c[iRpe] ?? '').trim() })
  }
  return [...sessions.values()]
}

/** A Strong session as a site session (no `source`: it was logged by hand).
 *  `offsetMin` turns its local start into the row's savedAt instant. */
export function strongToSession(s: StrongSession, offsetMin: number): Record<string, unknown> {
  const utc = new Date(`${s.localStart}:00Z`).getTime() - offsetMin * 60000
  return {
    type: 'lift',
    name: s.name,
    date: s.date,
    savedAt: isoSeconds(utc),
    importedFrom: 'strong',
    exercises: s.exercises.map((e, i) => ({
      id: `strong-${s.localStart}-${i}`,
      exerciseName: e.exerciseName,
      plannedSets: [],
      actualSets: e.sets,
    })),
    run: [],
  }
}
