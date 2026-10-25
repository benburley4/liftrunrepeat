// Pure planning logic for the Zepp import (scripts/zepp-sync.mjs).
// Zepp workouts come from ZeppBridge's local zepp.db (later: the Zepp Open
// API — the fields are the same). Kept dependency-free so the Node script can
// import this .ts file directly via type stripping.
//
// Rules:
//  - A Zepp workout already linked to a session (data.zepp.workoutId) is
//    re-applied to that same row, so re-running the sync is idempotent.
//  - Otherwise it enriches a manually logged session of the same type on the
//    same local date (closest km wins): the watch's km/elevation replace the
//    manual figures (originals kept in manualOriginal), and stats are attached.
//  - Anything left becomes a new session with source 'zepp'.

export interface ZeppWorkout {
  workoutId: string
  workoutType: string        // ZeppBridge type: "walking", "treadmill", "run", …
  startTime: string          // ISO with offset, e.g. "2026-10-25T04:37:45+00:00"
  endTime: string
  distanceM?: number | null
  elevationGainM?: number | null
  avgHr?: number | null
  maxHr?: number | null
  calories?: number | null
  // Detail extras (all optional — older/indoor recordings lack most of them).
  minHr?: number | null
  totalSteps?: number | null
  movingSeconds?: number | null
  elevationLossM?: number | null
  maxAltitudeM?: number | null
  minAltitudeM?: number | null
  trainingEffect?: number | null
  anaerobicTrainingEffect?: number | null
  trainingLoad?: number | null
  avgCadenceSpm?: number | null
  avgStrideCm?: number | null
  hrZones?: ZeppHrZone[]
  splits?: ZeppSplit[]
}

/** Time in one HR zone; zones are bounded above by `upperBpm`. */
export interface ZeppHrZone { upperBpm: number; seconds: number }

/** One km split (the last one may be partial). */
export interface ZeppSplit { km: number; distanceM: number; seconds: number; avgHr: number | null; elevationGainM: number | null }

export interface ExistingSession {
  savedAt: string            // the row's saved_at, exactly as Supabase returned it
  data: Record<string, unknown>
}

export interface PlannedRow {
  savedAt: string
  data: Record<string, unknown>
  // 'delete': a watch-only placeholder whose workout moved onto a logged session.
  action: 'new' | 'enrich' | 'update' | 'delete'
}

export const DEFAULT_TIME_ZONE = 'Asia/Hong_Kong'

// Auto-detected movement blocks (5–15 min, no distance) — not training sessions.
export const SKIPPED_ZEPP_TYPES = new Set(['activity'])
// Shorter recordings are accidental starts (e.g. 0-min "runs" of 80 m).
export const MIN_WORKOUT_MINUTES = 5

export interface PlanOptions {
  timeZone?: string
  /** Only watch-only lifting sessions starting at/after this ISO time get the
   *  "add your sets" prompt — history from before the site was used doesn't. */
  needsSetsSince?: string
}

// ─── Zepp type → session type mapping ────────────────────────────────────────

const ZEPP_TYPE_MAP: Record<string, { type: string; name: string }> = {
  walking:             { type: 'hike',  name: 'Walk' },
  hiking:              { type: 'hike',  name: 'Hike' },
  treadmill:           { type: 'hike',  name: 'Treadmill Walk' },
  run:                 { type: 'run',   name: 'Run' },
  running:             { type: 'run',   name: 'Run' },
  outdoor_running:     { type: 'run',   name: 'Run' },
  indoor_running:      { type: 'run',   name: 'Indoor Run' },
  trail_run:           { type: 'run',   name: 'Trail Run' },
  cycling:             { type: 'cycle', name: 'Cycle' },
  outdoor_cycling:     { type: 'cycle', name: 'Cycle' },
  indoor_cycling:      { type: 'cycle', name: 'Indoor Cycle' },
  swimming:            { type: 'swim',  name: 'Swim' },
  pool_swimming:       { type: 'swim',  name: 'Pool Swim' },
  open_water_swimming: { type: 'swim',  name: 'Open Water Swim' },
  strength:            { type: 'lift',  name: 'Strength' },
  strength_training:   { type: 'lift',  name: 'Strength' },
}

export function mapZeppType(workoutType: string): { type: string; name: string } {
  const key = (workoutType ?? '').trim().toLowerCase()
  const known = ZEPP_TYPE_MAP[key]
  if (known) return known
  if (key.startsWith('unknown')) return { type: 'hybrid', name: 'Workout' }
  const name = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Workout'
  return { type: 'hybrid', name }
}

// ─── Field helpers ───────────────────────────────────────────────────────────

/** Local calendar date (YYYY-MM-DD) of an instant in the given IANA zone. */
export function localDate(iso: string, timeZone = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(iso))
}

function round(n: number, dp: number): number {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

export function zeppKm(w: ZeppWorkout): number | null {
  return w.distanceM && w.distanceM > 0 ? round(w.distanceM / 1000, 2) : null
}

const roundOrNull = (n: number | null | undefined, dp = 0) => (n == null ? null : round(n, dp))

export function zeppStats(w: ZeppWorkout) {
  const minutes = (new Date(w.endTime).getTime() - new Date(w.startTime).getTime()) / 60000
  const zones = (w.hrZones ?? []).filter(z => z.upperBpm > 0)
  return {
    workoutId:      w.workoutId,
    workoutType:    w.workoutType,
    startTime:      w.startTime,
    endTime:        w.endTime,
    durationMin:    minutes > 0 ? Math.round(minutes) : null,
    distanceKm:     zeppKm(w),
    elevationGainM: w.elevationGainM != null ? Math.round(w.elevationGainM) : null,
    avgHr:          w.avgHr ?? null,
    maxHr:          w.maxHr ?? null,
    calories:       w.calories ?? null,
    minHr:          w.minHr ?? null,
    steps:          w.totalSteps || null,
    movingMin:      w.movingSeconds ? Math.round(w.movingSeconds / 60) : null,
    elevationLossM: roundOrNull(w.elevationLossM),
    maxAltitudeM:   roundOrNull(w.maxAltitudeM),
    minAltitudeM:   roundOrNull(w.minAltitudeM),
    trainingEffect: roundOrNull(w.trainingEffect, 1),
    anaerobicTrainingEffect: roundOrNull(w.anaerobicTrainingEffect, 1),
    trainingLoad:   roundOrNull(w.trainingLoad),
    avgCadenceSpm:  roundOrNull(w.avgCadenceSpm),
    avgStrideCm:    roundOrNull(w.avgStrideCm),
    hrZones:        zones.some(z => z.seconds > 0) ? zones : null,
    splits:         w.splits?.length ? w.splits : null,
  }
}

export type ZeppStats = ReturnType<typeof zeppStats> & { distanceMismatch?: boolean }

// A watch distance within this fraction of the logged km replaces it; further
// off (watch stopped early, part of the outing missed) the logged figures are
// kept and only the stats attach. Below MIN_MATCH_RATIO it's a different walk.
export const KM_REPLACE_TOLERANCE = 0.25
export const MIN_MATCH_RATIO = 0.3

/** Copies the watch's distance/elevation onto a session's own fields. */
function applyMeasurements(session: Record<string, unknown>, w: ZeppWorkout, statsOnly = false) {
  if (statsOnly) {
    session.zepp = { ...zeppStats(w), distanceMismatch: true }
    return
  }
  const km = zeppKm(w)
  const elev = w.elevationGainM != null && w.elevationGainM > 0 ? Math.round(w.elevationGainM) : null
  const { type } = mapZeppType(w.workoutType)
  if (session.type === 'hike') {
    if (km) session.hikeKm = km
    // Treadmills report no elevation — keep a manually logged incline figure.
    if (elev) session.hikeElevationM = elev
  } else if (session.type === 'cycle' || session.type === 'swim') {
    if (km) session.distanceKm = km
  } else if (session.type === 'run' && type === 'run' && km) {
    // Only fill an empty run log; never overwrite structured manual segments.
    const run = session.run as unknown[] | undefined
    if (!run || run.length === 0) {
      session.run = [{
        id: `zepp-${w.workoutId}`,
        segmentType: 'run',
        metric: 'distance',
        plannedValue: String(km),
        plannedPace: '',
        actualValue: String(km),
        actualPace: '',
      }]
    }
  }
  session.zepp = zeppStats(w)
}

export function zeppWorkoutToSession(w: ZeppWorkout, name: string, timeZone = DEFAULT_TIME_ZONE, promptSets = true) {
  const { type } = mapZeppType(w.workoutType)
  const session: Record<string, unknown> = {
    type, name,
    date: localDate(w.startTime, timeZone),
    savedAt: w.startTime,
    source: 'zepp',
    exercises: [],
    run: [],
  }
  applyMeasurements(session, w)
  // Watch-only lifting session: the UI prompts to add the sets.
  if (type === 'lift' && promptSets) session.needsSets = true
  return session
}

// ─── Planning ────────────────────────────────────────────────────────────────

// Manual session types a Zepp workout of each type may enrich. Strength
// workouts also match hybrid days (lifting logged as "Hybrid Session").
const MATCHABLE_TYPES: Record<string, string[]> = {
  lift: ['lift', 'hybrid'],
}

function nameKey(name: unknown): string {
  return String(name ?? '').trim().toLowerCase()
}

function linkedWorkoutId(data: Record<string, unknown>): string | null {
  const z = data.zepp as { workoutId?: unknown } | undefined
  return z?.workoutId != null ? String(z.workoutId) : null
}

/** "Walk" → "Walk (2)", or the next free number, matching sessionDedupe's rule. */
function freeName(base: string, taken: Set<string>): string {
  if (!taken.has(nameKey(base))) return base
  for (let i = 2; ; i++) {
    const candidate = `${base} (${i})`
    if (!taken.has(nameKey(candidate))) return candidate
  }
}

function durationMin(w: ZeppWorkout): number {
  return (new Date(w.endTime).getTime() - new Date(w.startTime).getTime()) / 60000
}

export function planZeppImport(
  workouts: ZeppWorkout[],
  existing: ExistingSession[],
  { timeZone = DEFAULT_TIME_ZONE, needsSetsSince }: PlanOptions = {},
): PlannedRow[] {
  const planned: PlannedRow[] = []
  const byWorkoutId = new Map<string, ExistingSession>()
  const takenNames = new Map<string, Set<string>>()        // date → names in use
  // Unlinked manual sessions, deduped like sessionDedupe: only the latest save
  // per date + name is visible on the site, so only it is a match candidate.
  const visibleManual = new Map<string, ExistingSession>()

  for (const s of existing) {
    const date = String(s.data.date ?? '')
    if (!takenNames.has(date)) takenNames.set(date, new Set())
    takenNames.get(date)!.add(nameKey(s.data.name))
    const linked = linkedWorkoutId(s.data)
    if (linked) byWorkoutId.set(linked, s)
    else if (!s.data.source) {
      const key = `${date}|${nameKey(s.data.name)}`
      const cur = visibleManual.get(key)
      if (!cur || String(s.data.savedAt ?? s.savedAt) > String(cur.data.savedAt ?? cur.savedAt)) visibleManual.set(key, s)
    }
  }
  const manualByDate = new Map<string, ExistingSession[]>()
  for (const s of visibleManual.values()) {
    const date = String(s.data.date ?? '')
    if (!manualByDate.has(date)) manualByDate.set(date, [])
    manualByDate.get(date)!.push(s)
  }

  // 1. Re-apply workouts already linked to a session.
  const unlinked: ZeppWorkout[] = []
  for (const w of workouts) {
    if (SKIPPED_ZEPP_TYPES.has((w.workoutType ?? '').trim().toLowerCase())) continue
    if (durationMin(w) < MIN_WORKOUT_MINUTES) continue
    const s = byWorkoutId.get(String(w.workoutId))
    if (!s) { unlinked.push(w); continue }
    // A watch-only "add your sets" session whose sets were since logged as a
    // separate manual session: hand the workout over to that session (step 2
    // matches it) and remove the placeholder.
    if (s.data.source === 'zepp' && s.data.needsSets) {
      const date = String(s.data.date ?? '')
      const matchable = MATCHABLE_TYPES[String(s.data.type)] ?? [String(s.data.type)]
      if ((manualByDate.get(date) ?? []).some(m => matchable.includes(String(m.data.type)) && ((m.data.exercises as unknown[] | undefined)?.length ?? 0) > 0)) {
        planned.push({ savedAt: s.savedAt, data: s.data, action: 'delete' })
        unlinked.push(w)
        continue
      }
    }
    const data = { ...s.data }
    const prev = s.data.zepp as { distanceMismatch?: boolean } | undefined
    applyMeasurements(data, w, prev?.distanceMismatch === true)
    if (data.needsSets) data.needsSets = !((data.exercises as unknown[] | undefined)?.length)
    planned.push({ savedAt: s.savedAt, data, action: 'update' })
  }

  // 2. Match the rest to manual sessions — longest workouts first, closest km.
  const sorted = [...unlinked].sort((a, b) => (b.distanceM ?? 0) - (a.distanceM ?? 0) || a.startTime.localeCompare(b.startTime))
  const leftovers: ZeppWorkout[] = []
  for (const w of sorted) {
    const date = localDate(w.startTime, timeZone)
    const { type } = mapZeppType(w.workoutType)
    const km = zeppKm(w) ?? 0
    const matchable = MATCHABLE_TYPES[type] ?? [type]
    const manualKm = (s: ExistingSession) => Number(s.data.hikeKm ?? s.data.distanceKm ?? 0)
    // No logged km (e.g. a lifting day) → any workout of the type matches.
    const plausible = (s: ExistingSession) => !manualKm(s) || !km || km >= manualKm(s) * MIN_MATCH_RATIO
    const candidates = (manualByDate.get(date) ?? [])
      .filter(s => matchable.includes(String(s.data.type)) && plausible(s))
    if (!candidates.length) { leftovers.push(w); continue }
    const gap = (s: ExistingSession) => manualKm(s) && km ? Math.abs(manualKm(s) - km) : 0
    const best = candidates.reduce((a, b) => gap(b) < gap(a) ? b : a)
    manualByDate.set(date, manualByDate.get(date)!.filter(s => s !== best))
    const bestKm = manualKm(best)
    const statsOnly = !!bestKm && !!km && Math.abs(km - bestKm) > bestKm * KM_REPLACE_TOLERANCE
    const data = { ...best.data }
    if (!statsOnly) data.manualOriginal = { hikeKm: best.data.hikeKm ?? null, hikeElevationM: best.data.hikeElevationM ?? null, distanceKm: best.data.distanceKm ?? null }
    applyMeasurements(data, w, statsOnly)
    planned.push({ savedAt: best.savedAt, data, action: 'enrich' })
  }

  // 3. Everything else is a new session, numbered in start order per day.
  leftovers.sort((a, b) => a.startTime.localeCompare(b.startTime))
  for (const w of leftovers) {
    const date = localDate(w.startTime, timeZone)
    if (!takenNames.has(date)) takenNames.set(date, new Set())
    const taken = takenNames.get(date)!
    const name = freeName(mapZeppType(w.workoutType).name, taken)
    taken.add(nameKey(name))
    const promptSets = !needsSetsSince || new Date(w.startTime) >= new Date(needsSetsSince)
    planned.push({ savedAt: w.startTime, data: zeppWorkoutToSession(w, name, timeZone, promptSets), action: 'new' })
  }

  return planned
}
