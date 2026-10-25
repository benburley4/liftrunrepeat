#!/usr/bin/env node
/**
 * Zepp → TheHybridLife sync.
 *
 * Reads workouts from ZeppBridge's local database (the desktop app keeps it
 * synced from the Zepp cloud) and writes them to Supabase as sessions for
 * HEALTH_IMPORT_USER_ID, via the service role key. Matching/enrichment rules
 * live in src/lib/zeppImport.ts (unit-tested).
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
db.close()

if (!workouts.length) {
  console.log(`No Zepp workouts since ${since.slice(0, 10)}`)
  process.exit(0)
}

// ── Existing sessions over the same dates (a day either side for time zones) ─
const dayShift = (iso, d) => new Date(new Date(iso).getTime() + d * 86400e3).toISOString().slice(0, 10)
const fromDate = dayShift(workouts[0].startTime, -1)
const toDate = dayShift(workouts.at(-1).startTime, 1)

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
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

const plan = planZeppImport(workouts, rows.map(r => ({ savedAt: r.saved_at, data: r.data })))
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
