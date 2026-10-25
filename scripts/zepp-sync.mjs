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
         avg_hr AS avgHr, max_hr AS maxHr, calories
  FROM workouts WHERE start_time >= ? ORDER BY start_time`).all(since)
  .map(w => ({ ...w, workoutId: String(w.workoutId) }))

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

if (!workouts.length) {
  console.log(`No Zepp workouts since ${since.slice(0, 10)}`)
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
  + `${count('new')} new, ${count('enrich')} enriched manual, ${count('update')} already linked`)

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
  const upserts = plan.map(p => ({ user_id: USER_ID, saved_at: p.savedAt, data: p.data }))
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
