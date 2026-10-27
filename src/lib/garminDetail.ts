// Pure conversions for the Garmin detail backfill (scripts/backfill-garmin-detail.mjs):
// FIT activity files → per-minute traces, GPS routes, HR zones and km splits in
// the same shapes the Zepp sync writes, plus Garmin daily exports → zepp_daily rows.
// Dependency-free with type-only imports, so both vitest and the Node script
// (which loads .ts files directly) can use it. The script turns samples and
// points into traces/routes with downsampleSeries / buildRoute (zeppSeries.ts).

import type { ZeppSample, RoutePoint } from './zeppSeries'
import type { ZeppHrZone, ZeppSplit } from './zeppImport'

/** The record fields we read from a decoded FIT file (Garmin FIT SDK names). */
export interface FitRecord {
  timestamp: Date | string
  positionLat?: number
  positionLong?: number
  heartRate?: number
  altitude?: number
  enhancedAltitude?: number
  speed?: number
  enhancedSpeed?: number
  distance?: number
}

export interface FitTimeInZone {
  referenceMesg?: string
  timeInHrZone?: number[]
  hrZoneHighBoundary?: number[]
}

const iso = (t: Date | string) => (t instanceof Date ? t.toISOString() : new Date(t).toISOString())
const ms = (t: Date | string) => (t instanceof Date ? t.getTime() : Date.parse(t))
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** FIT positions are 32-bit "semicircles". */
export const semicirclesToDeg = (s: number) => (s * 180) / 2 ** 31

export function fitSamples(records: FitRecord[]): ZeppSample[] {
  return records.map(r => ({
    timestamp: iso(r.timestamp),
    heartRate: num(r.heartRate),
    altitude: num(r.enhancedAltitude) ?? num(r.altitude),
    speed: num(r.enhancedSpeed) ?? num(r.speed),
  }))
}

export function fitRoutePoints(records: FitRecord[]): RoutePoint[] {
  return records
    .filter(r => num(r.positionLat) != null && num(r.positionLong) != null)
    .map(r => ({ latitude: semicirclesToDeg(r.positionLat!), longitude: semicirclesToDeg(r.positionLong!) }))
}

/**
 * HR zones in the Zepp shape: six zones, each bounded above by `upperBpm`.
 * Garmin reports seven bins (below zone 1 … above max); the top bin is folded
 * into the sixth so lifting and cardio share the app's 1–6 load weights.
 * Uses Garmin's own session time-in-zone when the file has it, otherwise
 * counts record time against `fallbackBoundaries` (six upper limits).
 */
export function fitHrZones(timeInZone: FitTimeInZone[], records: FitRecord[], fallbackBoundaries: number[]): ZeppHrZone[] | null {
  const session = timeInZone.find(t => t.referenceMesg === 'session' && t.timeInHrZone?.length && t.hrZoneHighBoundary?.length)
  let bounds: number[], secs: number[]
  if (session) {
    bounds = session.hrZoneHighBoundary!.slice(0, 6)
    secs = session.timeInHrZone!.slice()
  } else {
    bounds = fallbackBoundaries.slice(0, 6)
    secs = Array(bounds.length + 1).fill(0)
    for (let i = 0; i < records.length - 1; i++) {
      const hr = num(records[i].heartRate)
      if (!hr) continue
      // Time until the next sample, capped so a paused gap doesn't count.
      const dt = Math.min(10, (ms(records[i + 1].timestamp) - ms(records[i].timestamp)) / 1000)
      if (dt <= 0) continue
      const bin = bounds.findIndex(b => hr < b)
      secs[bin < 0 ? bounds.length : bin] += dt
    }
  }
  if (bounds.length !== 6) return null
  const six = secs.slice(0, 6)
  six[5] += secs.slice(6).reduce((a, b) => a + b, 0)
  const zones = bounds.map((upperBpm, i) => ({ upperBpm: Math.round(upperBpm), seconds: Math.round(six[i] ?? 0) }))
  return zones.some(z => z.seconds > 0) ? zones : null
}

/**
 * Whole-km splits from cumulative record distance (the last split is
 * partial). Elevation gain uses a 5-sample moving average to ignore
 * barometer noise. Null for outings under 1 km or without distance.
 */
export function fitKmSplits(records: FitRecord[]): ZeppSplit[] | null {
  const rows = records
    .map(r => ({ t: ms(r.timestamp), d: num(r.distance), hr: num(r.heartRate), alt: num(r.enhancedAltitude) ?? num(r.altitude) }))
    .filter((r): r is { t: number; d: number; hr: number | null; alt: number | null } => r.d != null)
  if (rows.length < 2 || rows[rows.length - 1].d < 1000) return null
  const smooth = rows.map((_, i) => {
    const w = rows.slice(Math.max(0, i - 2), i + 3).map(r => r.alt).filter((a): a is number => a != null)
    return w.length ? w.reduce((a, b) => a + b, 0) / w.length : null
  })
  const out: ZeppSplit[] = []
  let startIdx = 0, km = 1
  const close = (endIdx: number, partial: boolean) => {
    const seg = rows.slice(startIdx, endIdx + 1)
    const hrs = seg.map(r => r.hr).filter((h): h is number => h != null && h > 0)
    let gain = 0
    for (let i = startIdx + 1; i <= endIdx; i++) {
      const a = smooth[i - 1], b = smooth[i]
      if (a != null && b != null && b > a) gain += b - a
    }
    const distanceM = Math.round(rows[endIdx].d - rows[startIdx].d)
    if (partial && distanceM < 50) return
    out.push({
      km,
      distanceM: partial ? distanceM : 1000,
      seconds: Math.round((rows[endIdx].t - rows[startIdx].t) / 1000),
      avgHr: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null,
      elevationGainM: Math.round(gain),
    })
  }
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].d >= km * 1000) { close(i, false); startIdx = i; km++ }
  }
  if (startIdx < rows.length - 1) close(rows.length - 1, true)
  return out.length ? out : null
}

// ─── Daily history → zepp_daily ──────────────────────────────────────────────

/** zepp_daily columns filled from Garmin (the rest stay null). */
export interface GarminDailyRow {
  date: string
  steps: number | null
  step_goal: number | null
  distance_m: number | null
  active_calories: number | null
  active_min: number | null
  resting_hr: number | null
  stress_avg: number | null
  sleep_min: number | null
  deep_min: number | null
  light_min: number | null
  rem_min: number | null
  awake_min: number | null
  wake_count: number | null
  sleep_score: number | null
  resp_rate: number | null
  readiness: number | null
}

type Json = Record<string, unknown>
const pos = (v: unknown) => { const n = num(v); return n != null && n > 0 ? n : null }
const mins = (v: unknown) => { const n = num(v); return n == null ? null : Math.round(n / 60) }

/**
 * Merge Garmin's daily summaries (UDSFile), sleep (sleepData) and Training
 * Readiness into one row per calendar date. For readiness the morning
 * ("after wake-up") score wins, else the day's last one.
 */
export function garminDailyRows(uds: Json[], sleep: Json[], readiness: Json[]): GarminDailyRow[] {
  const rows = new Map<string, GarminDailyRow>()
  const row = (date: string) => {
    let r = rows.get(date)
    if (!r) rows.set(date, r = {
      date, steps: null, step_goal: null, distance_m: null, active_calories: null, active_min: null, resting_hr: null,
      stress_avg: null, sleep_min: null, deep_min: null, light_min: null, rem_min: null, awake_min: null, wake_count: null,
      sleep_score: null, resp_rate: null, readiness: null,
    })
    return r
  }
  for (const u of uds) {
    const date = typeof u.calendarDate === 'string' ? u.calendarDate : null
    if (!date) continue
    const r = row(date)
    r.steps = pos(u.totalSteps)
    r.step_goal = pos(u.dailyStepGoal)
    r.distance_m = pos(u.totalDistanceMeters)
    r.active_calories = pos(u.activeKilocalories)
    const active = (num(u.activeSeconds) ?? 0) + (num(u.highlyActiveSeconds) ?? 0)
    r.active_min = active > 0 ? Math.round(active / 60) : null
    r.resting_hr = pos(u.restingHeartRate)
    const stress = (u.allDayStress as { aggregatorList?: Json[] } | undefined)?.aggregatorList?.find(a => a.type === 'TOTAL')
    r.stress_avg = pos(stress?.averageStressLevel)
  }
  for (const s of sleep) {
    const date = typeof s.calendarDate === 'string' ? s.calendarDate : null
    if (!date) continue
    const deep = num(s.deepSleepSeconds) ?? 0, light = num(s.lightSleepSeconds) ?? 0, rem = num(s.remSleepSeconds) ?? 0
    if (deep + light + rem <= 0) continue
    const r = row(date)
    r.sleep_min = Math.round((deep + light + rem) / 60)
    r.deep_min = mins(s.deepSleepSeconds)
    r.light_min = mins(s.lightSleepSeconds)
    r.rem_min = mins(s.remSleepSeconds)
    r.awake_min = mins(s.awakeSleepSeconds)
    r.wake_count = num(s.awakeCount)
    r.sleep_score = pos((s.sleepScores as Json | undefined)?.overallScore)
    r.resp_rate = pos(s.averageRespiration)
  }
  const best = new Map<string, Json>()
  for (const t of readiness) {
    const date = typeof t.calendarDate === 'string' ? t.calendarDate : null
    if (!date || num(t.score) == null) continue
    const prev = best.get(date)
    const morning = (x: Json) => x.inputContext === 'AFTER_WAKEUP_RESET'
    if (!prev || (morning(t) && !morning(prev)) || (morning(t) === morning(prev) && String(t.timestamp) > String(prev.timestamp))) best.set(date, t)
  }
  for (const [date, t] of best) row(date).readiness = num(t.score)
  return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date))
}
