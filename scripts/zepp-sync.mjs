#!/usr/bin/env node
/**
 * Zepp → TheHybridLife sync.
 *
 * Reads ZeppBridge's local database (the desktop app keeps it synced from the
 * Zepp cloud) and writes to Supabase for HEALTH_IMPORT_USER_ID, via the
 * service role key:
 *   - workouts → sessions (matching rules in src/lib/zeppImport.ts)
 *   - readiness/HRV/RHR/sleep/load/steps → zepp_daily (src/lib/zeppDaily.ts)
 *   - smart-scale weight → user_settings.bodyweight_kg (7-day median)
 *
 * Usage:
 *   node scripts/zepp-sync.mjs              # last 14 days
 *   node scripts/zepp-sync.mjs --all        # full history (first run)
 *   node scripts/zepp-sync.mjs --days 60
 *   node scripts/zepp-sync.mjs --dry-run    # print the plan, write nothing
 *
 * ZEPP_DB overrides the database path. Opened read-only, so it is safe to run
 * while ZeppBridge is syncing.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { createClient } from '@supabase/supabase-js'
import { planZeppImport } from '../src/lib/zeppImport.ts'
import { buildZeppDaily, scaleBodyweight } from '../src/lib/zeppDaily.ts'
import { downsampleSeries, buildRoute } from '../src/lib/zeppSeries.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ZEPP_DB = process.env.ZEPP_DB
  ?? join(process.env.LOCALAPPDATA ?? '', 'ZeppBridge', 'data', 'zepp.db')

// ── Args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const ALL = args.includes('--all')
const daysArg = args.indexOf('--days')
const DAYS = daysArg >= 0 ? Number(args[daysArg + 1]) : 14

// ── Load .env.local (no dotenv dependency) ───────────────────────────────────
function loadEnv() {
  const env = {}
  try {
    const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* fall back to process.env */ }
  return { ...env, ...process.env }
}

const env = loadEnv()
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const USER_ID = env.HEALTH_IMPORT_USER_ID
if (!SUPABASE_URL || !SERVICE_KEY || !USER_ID) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or HEALTH_IMPORT_USER_ID')
  process.exit(1)
}

// ── Read Zepp workouts ───────────────────────────────────────────────────────
const db = new DatabaseSync(ZEPP_DB, { readOnly: true })
const since = ALL ? '0000' : new Date(Date.now() - DAYS * 86400e3).toISOString()
const workouts = db.prepare(`
  SELECT workout_id AS workoutId,
         COALESCE(workout_type_override, workout_type) AS workoutType,
         start_time AS startTime, end_time AS endTime,
         distance_meters AS distanceM, elevation_gain_m AS elevationGainM,
         avg_hr AS avgHr, max_hr AS maxHr, calories,
         min_hr AS minHr, total_steps AS totalSteps, moving_seconds AS movingSeconds,
         elevation_loss_m AS elevationLossM, max_altitude_m AS maxAltitudeM, min_altitude_m AS minAltitudeM,
         training_effect AS trainingEffect, anaerobic_training_effect AS anaerobicTrainingEffect,
         training_load AS trainingLoad, avg_cadence_spm AS avgCadenceSpm, avg_stride_cm AS avgStrideCm,
         sample_count AS sampleCount
  FROM workouts WHERE start_time >= ? ORDER BY start_time`).all(since)
  .map(w => ({ ...w, workoutId: String(w.workoutId) }))

// HR zones and km splits are small — attach them to each workout's stats.
const zonesStmt = db.prepare(`
  SELECT upper_bound_bpm AS upperBpm, seconds FROM workout_hr_zones WHERE workout_id = ? ORDER BY zone_index`)
const splitsStmt = db.prepare(`
  SELECT split_index AS km, distance_m AS distanceM, duration_seconds AS seconds,
         avg_hr AS avgHr, elevation_gain_m AS elevationGainM
  FROM workout_splits WHERE workout_id = ? ORDER BY split_index`)
for (const w of workouts) {
  w.hrZones = zonesStmt.all(w.workoutId).map(z => ({ upperBpm: z.upperBpm, seconds: z.seconds }))
  w.splits = splitsStmt.all(w.workoutId).map(s => ({
    km: s.km, distanceM: Math.round(s.distanceM), seconds: s.seconds,
    avgHr: s.avgHr, elevationGainM: s.elevationGainM == null ? null : Math.round(s.elevationGainM),
  }))
}

// Per-minute HR / altitude / pace traces (zepp_workout_series), recorded workouts only.
const samplesStmt = db.prepare(`
  SELECT timestamp, heart_rate AS heartRate, altitude, speed
  FROM workout_samples WHERE workout_id = ? ORDER BY timestamp`)
// GPS routes: privacy-trimmed (first/last 200 m) and simplified — see buildRoute.
const routeStmt = db.prepare(`
  SELECT latitude, longitude FROM route_points WHERE workout_id = ? ORDER BY timestamp`)
const series = workouts
  .map(w => {
    const points = w.sampleCount > 0 ? downsampleSeries(samplesStmt.all(w.workoutId), w.startTime) : []
    return { workoutId: w.workoutId, points: points.length > 1 ? points : null, route: buildRoute(routeStmt.all(w.workoutId)) }
  })
  .filter(s => s.points || s.route)

// Daily recovery data for zepp_daily (same window).
const dailyMetrics = db.prepare(`
  SELECT date, metric, value FROM daily_metrics WHERE date >= ?`).all(since.slice(0, 10))
const sleeps = db.prepare(`
  SELECT start_time AS startTime, end_time AS endTime, score,
         duration_minutes AS durationMin, deep_minutes AS deepMin, light_minutes AS lightMin,
         rem_minutes AS remMin, awake_minutes AS awakeMin, wake_count AS wakeCount
  FROM sleep_sessions WHERE end_time >= ?`).all(since)
// Weight: the window, plus 8 days before it so the bodyweight median has data.
const weightSince = new Date(new Date(ALL ? '2000-01-01' : since).getTime() - 8 * 86400e3).toISOString()
const weights = db.prepare(`
  SELECT timestamp, value AS kg FROM metric_samples
  WHERE metric = 'weight' AND timestamp >= ? ORDER BY timestamp`).all(weightSince)
// When ZeppBridge last pulled from the Zepp cloud (shown in the site's watch box).
const bridgeSyncAt = db.prepare(`SELECT value FROM app_meta WHERE key = 'last_cloud_sync_at'`).get()?.value ?? null
db.close()

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

// ── Daily recovery rows + scale bodyweight ───────────────────────────────────
const daily = buildZeppDaily(dailyMetrics, sleeps, weights)
  .filter(r => r.date >= since.slice(0, 10))
  .map(r => ({ ...r, user_id: USER_ID, updated_at: new Date().toISOString() }))
const bodyweight = scaleBodyweight(weights)

if (DRY_RUN) {
  const last = daily.at(-1)
  console.log(`${daily.length} daily rows; latest ${last?.date}: readiness ${last?.readiness ?? '-'}, `
    + `HRV ${last?.sleep_hrv_ms ?? '-'} ms, RHR ${last?.resting_hr ?? '-'}, sleep ${last?.sleep_min ?? '-'} min`)
  if (bodyweight) console.log(`Scale bodyweight ${bodyweight.kg} kg (as of ${bodyweight.asOf.slice(0, 10)})`)
} else {
  if (daily.length) {
    const { error } = await supabase.from('zepp_daily').upsert(daily, { onConflict: 'user_id,date' })
    if (!error) console.log(`Wrote ${daily.length} daily rows`)
    else if (/zepp_daily/.test(error.message) && /not find|does not exist/i.test(error.message))
      console.log('zepp_daily table missing — run the 2026-10-25 migration in supabase/schema.sql')
    else { console.error('Daily upsert failed:', error.message); process.exitCode = 1 }
  }
  if (bodyweight) {
    const { data: cur } = await supabase.from('user_settings').select('value')
      .eq('user_id', USER_ID).eq('key', 'bodyweight_kg').maybeSingle()
    if (cur?.value !== String(bodyweight.kg)) {
      const { error } = await supabase.from('user_settings').upsert([
        { user_id: USER_ID, key: 'bodyweight_kg', value: String(bodyweight.kg) },
        { user_id: USER_ID, key: 'bodyweight_source', value: JSON.stringify({ source: 'zepp_scale', asOf: bodyweight.asOf }) },
      ], { onConflict: 'key,user_id' })
      if (error) { console.error('Bodyweight update failed:', error.message); process.exitCode = 1 }
      else console.log(`Bodyweight ${cur?.value ?? '-'} → ${bodyweight.kg} kg (scale)`)
    }
  }
}

// ── Status for the site's watch box (user_settings.zepp_sync_status) ────────
async function writeStatus() {
  if (DRY_RUN) return
  const status = {
    at: new Date().toISOString(),
    ok: process.exitCode !== 1,
    latestDay: daily.at(-1)?.date ?? null,
    bridgeSyncAt,
    message: `${workouts.length} workouts, ${daily.length} days checked`,
  }
  const { error } = await supabase.from('user_settings')
    .upsert({ user_id: USER_ID, key: 'zepp_sync_status', value: JSON.stringify(status) }, { onConflict: 'key,user_id' })
  if (error) console.error('Status update failed:', error.message)
}

if (!workouts.length) {
  console.log(`No Zepp workouts since ${since.slice(0, 10)}`)
  await writeStatus()
  process.exit()
}

// ── Existing sessions over the same dates (a day either side for time zones) ─
const dayShift = (iso, d) => new Date(new Date(iso).getTime() + d * 86400e3).toISOString().slice(0, 10)
const fromDate = dayShift(workouts[0].startTime, -1)
const toDate = dayShift(workouts.at(-1).startTime, 1)

const { data: rows, error: readError } = await supabase
  .from('sessions')
  .select('saved_at, data')
  .eq('user_id', USER_ID)
  .gte('data->>date', fromDate)
  .lte('data->>date', toDate)
if (readError) {
  console.error('Failed to read sessions:', readError.message)
  process.exit(1)
}

const plan = planZeppImport(workouts, rows.map(r => ({ savedAt: r.saved_at, data: r.data })), {
  needsSetsSince: new Date(Date.now() - 14 * 86400e3).toISOString(),
})
const count = a => plan.filter(p => p.action === a).length
console.log(`${workouts.length} Zepp workouts (${fromDate} to ${toDate}): `
  + `${count('new')} new, ${count('enrich')} enriched manual, ${count('update')} already linked`
  + (count('delete') ? `, ${count('delete')} watch-only placeholder(s) merged into logged sessions` : ''))

// No process.exit() past this point: exiting with fetch sockets still open
// trips a libuv assertion on Windows.
if (DRY_RUN) {
  for (const p of plan.filter(p => p.action !== 'update')) {
    const d = p.data
    const was = d.manualOriginal ? ` (was ${d.manualOriginal.hikeKm ?? '-'}km)` : ''
    console.log(`  ${p.action.padEnd(6)} ${d.date} ${String(d.name).padEnd(18)} ${d.hikeKm ?? '-'}km${was} ${d.zepp?.avgHr ?? '-'}bpm`)
  }
} else if (plan.length) {
  // ── Write ──────────────────────────────────────────────────────────────────
  const upserts = plan.filter(p => p.action !== 'delete')
    .map(p => ({ user_id: USER_ID, saved_at: p.savedAt, data: p.data }))
  for (const p of plan.filter(p => p.action === 'delete')) {
    const { error } = await supabase.from('sessions').delete().eq('user_id', USER_ID).eq('saved_at', p.savedAt)
    if (error) { console.error('Delete failed:', error.message); process.exitCode = 1 }
  }
  const { error: writeError } = await supabase
    .from('sessions')
    .upsert(upserts, { onConflict: 'user_id,saved_at' })
  if (writeError) {
    console.error('Upsert failed:', writeError.message)
    process.exitCode = 1
  } else {
    console.log(`Wrote ${upserts.length} sessions`)
  }
}

// ── Per-minute traces for the sessions just written ──────────────────────────
const linkedIds = new Set(plan.map(p => p.data.zepp?.workoutId).filter(Boolean))
const traceRows = series
  .filter(s => linkedIds.has(s.workoutId))
  .map(s => ({ user_id: USER_ID, workout_id: s.workoutId, points: s.points, route: s.route, updated_at: new Date().toISOString() }))
if (DRY_RUN) {
  console.log(`${traceRows.length} workout traces (${traceRows.filter(r => r.route).length} with GPS routes)`)
} else {
  let written = 0
  let rowsToWrite = traceRows
  for (let i = 0; i < rowsToWrite.length; i += 50) {
    const { error } = await supabase.from('zepp_workout_series')
      .upsert(rowsToWrite.slice(i, i + 50), { onConflict: 'user_id,workout_id' })
    if (!error) { written += Math.min(50, rowsToWrite.length - i); continue }
    if (/route|points/.test(error.message) && i === 0 && rowsToWrite === traceRows) {
      // Route column not migrated yet: keep writing HR traces without routes.
      console.log('zepp_workout_series.route missing — run the 2026-10-25 (c) migration; writing traces without routes')
      rowsToWrite = traceRows.filter(r => r.points).map(({ route, ...r }) => r)
      i = -50
      continue
    }
    if (/zepp_workout_series/.test(error.message) && /not find|does not exist/i.test(error.message))
      console.log('zepp_workout_series table missing — run the 2026-10-25 (b) migration in supabase/schema.sql')
    else { console.error('Trace upsert failed:', error.message); process.exitCode = 1 }
    break
  }
  if (written) console.log(`Wrote ${written} workout traces (${rowsToWrite.filter(r => r.route).length} with GPS routes)`)
}

await writeStatus()
