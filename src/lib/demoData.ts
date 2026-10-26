// Sample athlete shown on /progress to signed-out visitors. Deterministic
// (seeded) and dated relative to `today`, so the demo always looks current
// and every visitor sees the same believable year of hybrid training.

import type { SessionData, LoggedExercise, LoggedRunEntry, LoggedRunSegment } from './computeStats'
import type { ZeppStats } from './zeppImport'
import type { ZeppDay } from './recovery'
import type { LatLon } from './zeppSeries'
import type { CoachReport } from './db'
import { shiftDays } from './progressRange'
import { weekStartOf } from './activity'

export const DEMO_DAYS = 420
export const DEMO_BODYWEIGHT = 78

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

const round = (n: number, step: number) => Math.round(n / step) * step
const paceStr = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, '0')}`

// Start → end working weight (kg) over the demo year, and reps per set.
const LIFTS: Record<string, { from: number; to: number; reps: number; sets: number; step?: number; plateauWeeks?: number }> = {
  'Bench Press': { from: 70, to: 92.5, reps: 5, sets: 4 },
  'Overhead Press': { from: 45, to: 57.5, reps: 6, sets: 3, plateauWeeks: 7 },
  'Incline Dumbbell Press': { from: 22, to: 30, reps: 10, sets: 3, step: 2 },
  'Tricep Pushdown': { from: 25, to: 35, reps: 12, sets: 3 },
  'Back Squat': { from: 95, to: 130, reps: 5, sets: 4 },
  'Romanian Deadlift': { from: 80, to: 107.5, reps: 8, sets: 3 },
  'Walking Lunge': { from: 16, to: 24, reps: 10, sets: 3, step: 2 },
  'Calf Raise': { from: 60, to: 80, reps: 12, sets: 3 },
  'Deadlift': { from: 120, to: 167.5, reps: 3, sets: 3 },
  'Pull-Up': { from: 0, to: 15, reps: 6, sets: 4 },
  'Barbell Row': { from: 60, to: 80, reps: 8, sets: 3 },
  'Bicep Curl': { from: 12, to: 18, reps: 10, sets: 3, step: 1 },
}

const DAY_PLAN: Record<number, { kind: 'lift' | 'easy' | 'intervals' | 'walk' | 'hybrid' | 'long'; name: string; lifts?: string[] }> = {
  0: { kind: 'lift', name: 'Upper Push', lifts: ['Bench Press', 'Overhead Press', 'Incline Dumbbell Press', 'Tricep Pushdown'] },
  1: { kind: 'easy', name: 'Easy Run' },
  2: { kind: 'lift', name: 'Lower Strength', lifts: ['Back Squat', 'Romanian Deadlift', 'Walking Lunge', 'Calf Raise'] },
  3: { kind: 'intervals', name: 'Interval Session' },
  4: { kind: 'walk', name: 'Evening Walk' },
  5: { kind: 'hybrid', name: 'Pull + Tempo', lifts: ['Deadlift', 'Pull-Up', 'Barbell Row', 'Bicep Curl'] },
  6: { kind: 'long', name: 'Long Run' },
}

let segId = 0
const seg = (segmentType: string, km: number, paceSecs: number): LoggedRunSegment => ({
  id: `demo-seg-${++segId}`, segmentType, metric: 'distance',
  plannedValue: String(km), plannedPace: paceStr(paceSecs + 5),
  actualValue: String(Math.round(km * 100) / 100), actualPace: paceStr(paceSecs),
})

function zones(minutes: number, intensity: number): { upperBpm: number; seconds: number }[] {
  // intensity 0 (easy walk) … 1 (intervals): shifts time up the six zones.
  const weights = [1.4 - intensity, 1.6 - intensity, 1, 0.3 + intensity, 0.1 + intensity * 0.8, intensity * 0.4]
  const total = weights.reduce((a, b) => a + Math.max(0, b), 0)
  const uppers = [114, 133, 152, 162, 171, 190]
  return uppers.map((upperBpm, i) => ({ upperBpm, seconds: Math.round((Math.max(0, weights[i]) / total) * minutes * 60) }))
}

function zeppFor(id: string, date: string, startHour: number, opts: {
  workoutType: string; minutes: number; km: number | null; avgHr: number; intensity: number
  climb?: number; cadence?: number | null; stride?: number | null
}): ZeppStats {
  const start = new Date(`${date}T${String(startHour).padStart(2, '0')}:05:00Z`)
  const end = new Date(start.getTime() + opts.minutes * 60000)
  return {
    workoutId: id, workoutType: opts.workoutType,
    startTime: start.toISOString(), endTime: end.toISOString(),
    durationMin: Math.round(opts.minutes),
    distanceKm: opts.km,
    elevationGainM: opts.climb ?? null,
    avgHr: Math.round(opts.avgHr), maxHr: Math.round(opts.avgHr + 18 + opts.intensity * 15),
    calories: Math.round(opts.minutes * (6 + opts.intensity * 6)),
    minHr: Math.round(opts.avgHr - 30), steps: opts.km ? Math.round(opts.km * 1350) : null,
    movingMin: opts.km ? Math.round(opts.minutes * 0.96) : null,
    elevationLossM: opts.climb ?? null, maxAltitudeM: opts.climb ? 60 + opts.climb : null, minAltitudeM: opts.climb ? 40 : null,
    trainingEffect: Math.round((2 + opts.intensity * 2) * 10) / 10,
    anaerobicTrainingEffect: Math.round(opts.intensity * 25) / 10,
    trainingLoad: Math.round(opts.minutes * (0.8 + opts.intensity)),
    avgCadenceSpm: opts.cadence ?? null, avgStrideCm: opts.stride ?? null,
    hrZones: zones(opts.minutes, opts.intensity),
    splits: null,
  } as unknown as ZeppStats
}

/** A year+ of sessions for the demo athlete, newest first. */
export function demoSessions(today: string): SessionData[] {
  segId = 0
  const out: SessionData[] = []
  const firstDay = shiftDays(today, -DEMO_DAYS)
  const firstMonday = weekStartOf(firstDay)
  const totalWeeks = Math.ceil(DEMO_DAYS / 7)

  for (let d = 0; d <= DEMO_DAYS; d++) {
    const date = shiftDays(firstDay, d)
    const rnd = mulberry32(hash(`demo-${d}`))
    const week = Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${firstMonday}T00:00:00Z`)) / (7 * 86400000))
    const dow = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
    const progress = Math.min(1, week / totalWeeks)
    const deload = week % 6 === 5
    const plan = DAY_PLAN[dow]
    // The sample athlete skips the odd session, and takes a full week off once.
    if (rnd() < 0.1 || (week === 23 && dow !== 4)) continue

    const savedAt = `${date}T18:${String(10 + dow).padStart(2, '0')}:00.000Z`
    const wid = `demo-${date}`

    const liftBlock = (names: string[]): LoggedExercise[] => names.map((name, i) => {
      const spec = LIFTS[name]
      // A plateaued lift repeats the same weight, reps and effort: no new best for weeks.
      const stuck = !!spec.plateauWeeks && week > totalWeeks - spec.plateauWeeks
      const level = stuck ? (totalWeeks - spec.plateauWeeks!) / totalWeeks : progress
      const noise = stuck ? 0 : (rnd() - 0.4) * (spec.to - spec.from) * 0.06
      const working = spec.from + (spec.to - spec.from) * level + noise
      const w = round(working * (deload ? 0.85 : 1), spec.step ?? 2.5)
      return {
        id: `demo-ex-${date}-${i}`,
        exerciseName: name,
        plannedSets: Array.from({ length: spec.sets }, () => ({ reps: String(spec.reps), weight: String(w) })),
        actualSets: Array.from({ length: spec.sets }, (_, si) => ({
          reps: String(Math.max(1, spec.reps - (si === spec.sets - 1 && rnd() < 0.3 ? 1 : 0) + (deload ? 1 : 0))),
          weight: String(w),
          rpe: si === spec.sets - 1 ? String(deload ? 6.5 : stuck ? 9.5 : 8 + Math.round(rnd() * 2) / 2) : '',
        })),
      }
    })

    const easyPace = 360 - 35 * progress + rnd() * 12
    if (plan.kind === 'lift') {
      out.push({
        type: 'lift', name: plan.name, date, savedAt, source: 'zepp',
        exercises: liftBlock(plan.lifts!),
        zepp: zeppFor(wid, date, 7, { workoutType: 'strength', minutes: 58 + rnd() * 14, km: null, avgHr: 112 + rnd() * 8, intensity: 0.35 }),
      })
    } else if (plan.kind === 'easy') {
      const km = round(6 + rnd() * 3 + (week % 4 === 2 ? 2 : 0), 0.1)
      out.push({
        type: 'run', name: km >= 9.5 ? '10K Steady' : plan.name, date, savedAt, source: 'zepp',
        run: [seg('easy', km, easyPace)],
        zepp: zeppFor(wid, date, 6, { workoutType: 'run', minutes: (km * easyPace) / 60, km, avgHr: 146 - 6 * progress + rnd() * 5, intensity: 0.3, cadence: 166, stride: 104 }),
      })
    } else if (plan.kind === 'intervals') {
      const reps = 5 + Math.floor(progress * 2)
      const fast = 285 - 40 * progress + rnd() * 6
      const run: LoggedRunEntry[] = [
        seg('warmup', 2, easyPace + 10),
        { id: `demo-rep-${date}`, kind: 'repeat', count: String(reps), laps: [seg('interval', 1, fast), seg('recovery', 0.4, easyPace + 60)] },
        seg('cooldown', 1.5, easyPace + 15),
      ]
      const km = 3.5 + reps * 1.4
      out.push({
        type: 'run', name: `${reps} × 1 km`, date, savedAt, source: 'zepp', run,
        zepp: zeppFor(wid, date, 6, { workoutType: 'run', minutes: (km * (easyPace - 20)) / 60, km: Math.round(km * 10) / 10, avgHr: 158 + rnd() * 6, intensity: 0.9, cadence: 174, stride: 118 }),
      })
    } else if (plan.kind === 'walk') {
      if (rnd() < 0.35) continue
      const km = round(2.4 + rnd() * 2, 0.1)
      out.push({
        type: 'hike', name: plan.name, date, savedAt, source: 'zepp', hikeKm: km, hikeElevationM: Math.round(15 + rnd() * 40),
        zepp: zeppFor(wid, date, 19, { workoutType: 'walking', minutes: km * (11.5 + rnd()), km, avgHr: 98 + rnd() * 6, intensity: 0, climb: Math.round(15 + rnd() * 40), cadence: 112, stride: 72 }),
      })
    } else if (plan.kind === 'hybrid') {
      const km = 5
      const tempo = 310 - 35 * progress + rnd() * 8
      out.push({
        type: 'hybrid', name: plan.name, date, savedAt, source: 'zepp',
        exercises: liftBlock(plan.lifts!),
        run: [seg('tempo', km, tempo)],
        // Recorded as one strength workout, so the watch has no distance for it.
        zepp: zeppFor(wid, date, 8, { workoutType: 'strength', minutes: 85 + rnd() * 10, km: null, avgHr: 128 + rnd() * 6, intensity: 0.6 }),
      })
    } else {
      // Sunday: a hike every third week, a half marathon every eighth, else a long run.
      if (week % 3 === 1) {
        const km = round(10 + rnd() * 6, 0.1)
        const climb = Math.round(350 + rnd() * 450)
        out.push({
          type: 'hike', name: 'Hill Hike', date, savedAt, source: 'zepp', hikeKm: km, hikeElevationM: climb,
          zepp: zeppFor(wid, date, 9, { workoutType: 'hiking', minutes: km * (14 + rnd() * 3), km, avgHr: 118 - 5 * progress + rnd() * 5, intensity: 0.25, climb, cadence: 104, stride: 70 }),
        })
      } else {
        const km = week % 8 === 6 ? 21.1 : round(13 + progress * 5 + rnd() * 3, 0.1)
        const pace = easyPace + (km > 20 ? -18 : 8)
        out.push({
          type: 'run', name: km > 20 ? 'Half Marathon' : plan.name, date, savedAt, source: 'zepp',
          run: [seg('long', km, pace)],
          zepp: zeppFor(wid, date, 7, { workoutType: 'run', minutes: (km * pace) / 60, km, avgHr: 149 - 5 * progress + rnd() * 4, intensity: 0.45, cadence: 168, stride: 106 }),
        })
      }
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

/** Daily watch rows (readiness, sleep, steps) matching the demo sessions. */
export function demoZeppDaily(today: string, sessions: SessionData[]): ZeppDay[] {
  const load = new Map<string, number>()
  for (const s of sessions) load.set(s.date, (load.get(s.date) ?? 0) + (s.zepp?.trainingLoad ?? 0))
  const rows: ZeppDay[] = []
  for (let d = DEMO_DAYS; d >= 0; d--) {
    const date = shiftDays(today, -d)
    const rnd = mulberry32(hash(`zepp-${date}`))
    const yesterday = load.get(shiftDays(date, -1)) ?? 0
    const hrv = 58 - yesterday / 18 + (rnd() - 0.5) * 10
    const sleep = Math.round(400 + rnd() * 80 - (rnd() < 0.1 ? 70 : 0))
    const readiness = Math.max(30, Math.min(96, Math.round(70 + (hrv - 55) * 1.4 + (sleep - 430) / 6 + (rnd() - 0.5) * 8)))
    // Steps on foot: walks and hikes count fully, runs at a longer stride.
    const walked = sessions.filter(s => s.date === date).reduce((n, s) => n + (s.zepp?.distanceKm ?? 0) * (s.type === 'run' ? 0.6 : 1), 0)
    const steps = Math.round(4800 + rnd() * 5200 + walked * 1250)
    rows.push({
      date,
      readiness: d === 0 && rnd() < 0.2 ? null : readiness,
      hrv_readiness: null, rhr_readiness: null, physical_readiness: null, mental_readiness: null,
      sleep_hrv_ms: Math.round(hrv), hrv_baseline_ms: 56,
      sleep_rhr: Math.round(51 + yesterday / 60 + (rnd() - 0.5) * 3), rhr_baseline: 52, resting_hr: 53,
      sleep_min: sleep, sleep_score: Math.round(60 + (sleep - 380) / 3),
      deep_min: Math.round(sleep * 0.18), light_min: Math.round(sleep * 0.55), rem_min: Math.round(sleep * 0.22), awake_min: Math.round(sleep * 0.05),
      wake_count: Math.round(1 + rnd() * 3), nap_min: null,
      training_load: load.get(date) ?? 0, pai_daily: null, pai_total: null,
      steps, active_min: Math.round(40 + walked * 8), stress_avg: Math.round(25 + rnd() * 20),
      spo2_score: null, resp_rate: null, weight_kg: null,
      distance_m: Math.round(steps * 0.74), active_calories: Math.round(steps * 0.045), step_goal: 10000,
    })
  }
  return rows
}

// Demo routes loop around Regent's Park and Hampstead Heath, London.
const ANCHORS: [number, number][] = [[51.5273, -0.1530], [51.5313, -0.1570], [51.5345, -0.1625], [51.5609, -0.1630]]

/** A plausible closed GPS loop for a demo workout, sized to its distance. */
export function demoRoute(workoutId: string, km: number, kind: 'run' | 'hike' | 'walk'): LatLon[] {
  const rnd = mulberry32(hash(workoutId))
  const [lat0, lon0] = kind === 'hike' ? ANCHORS[3] : ANCHORS[Math.floor(rnd() * 3)]
  // Ellipse circumference ≈ km; lap shorter loops several times by shrinking the radius.
  const laps = km > 8 ? 2 : 1
  const r = (km / laps) / (2 * Math.PI)
  const rx = r * (0.8 + rnd() * 0.5), ry = r * (0.7 + rnd() * 0.4)
  const rot = rnd() * Math.PI
  const pts: LatLon[] = []
  const n = 80
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * 2 * Math.PI
    const wob = 1 + Math.sin(t * 5 + rnd() * 0.3) * 0.06
    const x = rx * Math.cos(t) * wob, y = ry * Math.sin(t) * wob
    const dx = x * Math.cos(rot) - y * Math.sin(rot), dy = x * Math.sin(rot) + y * Math.cos(rot)
    pts.push([lat0 + dy / 111, lon0 + dx / (111 * Math.cos((lat0 * Math.PI) / 180))])
  }
  return pts
}

/** GPS routes for every demo session recorded outdoors. */
export function demoRoutes(sessions: SessionData[]): Record<string, LatLon[]> {
  const out: Record<string, LatLon[]> = {}
  for (const s of sessions) {
    const id = s.zepp?.workoutId
    const km = s.zepp?.distanceKm
    if (!id || !km) continue
    const kind = s.type === 'run' ? 'run' : s.type === 'hike' ? (km >= 5 ? 'hike' : 'walk') : null
    if (kind) out[id] = demoRoute(id, km, kind)
  }
  return out
}

/** The demo athlete's latest AI weekly review. */
export function demoCoachReports(today: string): CoachReport[] {
  const lastSunday = shiftDays(weekStartOf(today), -1)
  return [{
    id: 'demo-report',
    weekEnding: lastSunday,
    createdAt: `${lastSunday}T23:50:00.000Z`,
    stats: null,
    reportText: [
      '## THE WEEK',
      '- **6 sessions** — three lifts, two runs and a long Sunday effort. Volume sat right on your 8-week average.',
      '- **Bench Press est. 1RM hit a new best.** Squat is still climbing steadily.',
      '## WHAT\'S WORKING',
      '- Easy pace has dropped **~30 s/km since spring** at the same heart rate — your aerobic base is growing.',
      '- Keeping the hard days hard and the easy days easy: interval HR peaked, recovery runs stayed in Zone 2.',
      '## WATCH OUT',
      '- **Overhead Press has stalled for 7 weeks.** Same weight, same reps.',
      '- Thursday intervals came 18 hours after heavy squats; readiness dipped to 61 the next morning.',
      '## RECOMMENDATIONS',
      '- Swap Overhead Press to **3 × 8 at 50 kg** for three weeks, then retest your 6-rep max.',
      '- Move intervals to Tuesday so they sit two days clear of lower-body work.',
      '- Keep Sunday\'s long run at conversational pace; extend it by 1 km.',
    ].join('\n'),
  }]
}
