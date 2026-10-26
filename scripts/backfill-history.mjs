#!/usr/bin/env node
/**
 * One-off history backfill: Garmin Connect export + Strong CSV → sessions.
 *
 * Reads from Data/ (gitignored):
 *   - Data/<garmin export>/DI_CONNECT/DI-Connect-Fitness/*_summarizedActivities.json
 *   - Data/strong_workouts.csv
 * and writes to Supabase for HEALTH_IMPORT_USER_ID via the service role key.
 *
 * Strong sessions are stored like hand-logged lifts (their sets and weights
 * are what counts). Garmin activities go through the Zepp planner
 * (src/lib/zeppImport.ts): a Garmin strength activity on a Strong day only
 * attaches its watch stats (HR, time, load) to that session; everything else
 * becomes a watch session with source 'garmin'. Watch stats live under the
 * session's `zepp` key like Zepp-synced ones, so the existing views show them.
 *
 * Re-running is idempotent (Garmin rows re-link by workout id, Strong rows
 * have fixed saved_at). Each Garmin activity is dated in its own local time.
 *
 * Usage:
 *   node scripts/backfill-history.mjs --dry-run   # print the plan, write nothing
 *   node scripts/backfill-history.mjs
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { planZeppImport } from '../src/lib/zeppImport.ts'
import {
  SKIPPED_GARMIN_TYPES, garminToWorkout, garminOffsetMin, offsetZone, parseStrongCsv, strongToSession,
} from '../src/lib/historyImport.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'Data')
const DRY_RUN = process.argv.includes('--dry-run')
const DEFAULT_OFFSET_MIN = 480   // Hong Kong, for Strong days with no Garmin activity

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

// ── Read the exports ─────────────────────────────────────────────────────────
const garminDir = readdirSync(DATA_DIR)
  .map(d => join(DATA_DIR, d, 'DI_CONNECT', 'DI-Connect-Fitness'))
  .find(existsSync)
if (!garminDir) { console.error(`No Garmin export found under ${DATA_DIR}`); process.exit(1) }

const activities = readdirSync(garminDir)
  .filter(f => f.endsWith('_summarizedActivities.json'))
  .flatMap(f => JSON.parse(readFileSync(join(garminDir, f), 'utf8'))[0].summarizedActivitiesExport)
  .filter(a => !SKIPPED_GARMIN_TYPES.has(a.activityType))

const strong = parseStrongCsv(readFileSync(join(DATA_DIR, 'strong_workouts.csv'), 'utf8'))

// A Strong session's zone: that of a Garmin activity on the same local date.
const offsetByDate = new Map()
for (const a of activities)
  offsetByDate.set(new Date(a.startTimeLocal).toISOString().slice(0, 10), garminOffsetMin(a))
const strongRows = strong.map(s => strongToSession(s, offsetByDate.get(s.date) ?? DEFAULT_OFFSET_MIN))

// ── Existing sessions over the backfill's dates ──────────────────────────────
const dates = [...activities.map(a => new Date(a.startTimeLocal).toISOString().slice(0, 10)), ...strong.map(s => s.date)].sort()
const fromDate = dates[0], toDate = dates.at(-1)

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
// Paged: PostgREST returns at most 1000 rows per request.
const rows = []
for (let page = 0; ; page++) {
  const { data, error } = await supabase
    .from('sessions')
    .select('saved_at, data')
    .eq('user_id', USER_ID)
    .gte('data->>date', fromDate)
    .lte('data->>date', toDate)
    .order('saved_at')
    .range(page * 1000, page * 1000 + 999)
  if (error) {
    console.error('Failed to read sessions:', error.message)
    process.exit(1)
  }
  rows.push(...data)
  if (data.length < 1000) break
}

// ── Plan: Strong rows first (fresh copies replace earlier imports), then the
// Garmin workouts per UTC offset so each one is dated in its local time. ─────
const pool = new Map(rows.map(r => [r.saved_at, { savedAt: r.saved_at, data: r.data }]))
for (const s of strongRows) pool.set(s.savedAt, { savedAt: s.savedAt, data: s })
const touched = new Set(strongRows.map(s => s.savedAt))
const deleted = new Set()

const groups = new Map()
for (const a of activities) {
  const off = garminOffsetMin(a)
  if (!groups.has(off)) groups.set(off, [])
  groups.get(off).push(garminToWorkout(a))
}

for (const [off, workouts] of groups) {
  const plan = planZeppImport(workouts, [...pool.values()], {
    timeZone: offsetZone(off),
    needsSetsSince: new Date().toISOString(),   // history: never prompt for sets
  })
  for (const p of plan) {
    if (p.action === 'delete') { pool.delete(p.savedAt); touched.delete(p.savedAt); deleted.add(p.savedAt); continue }
    const data = { ...p.data }
    if (data.source === 'zepp' && String(data.zepp?.workoutId).startsWith('garmin-')) data.source = 'garmin'
    if (data.importedFrom === 'strong') delete data.manualOriginal
    pool.set(p.savedAt, { savedAt: p.savedAt, data })
    touched.add(p.savedAt)
  }
}

const toWrite = [...touched].map(k => pool.get(k).data)
const strongLinked = toWrite.filter(d => d.importedFrom === 'strong' && d.zepp).length
console.log(`Garmin: ${activities.length} activities from ${garminDir.split(/[\\/]/).slice(-3)[0]}`)
console.log(`Strong: ${strong.length} sessions (${strongLinked} matched to a Garmin strength activity)`)
console.log(`Existing sessions ${fromDate} to ${toDate}: ${rows.length}`)

const summary = {}
for (const d of toWrite) {
  const k = `${d.date.slice(0, 4)} ${d.importedFrom ?? d.source ?? 'manual'}/${d.type}`
  summary[k] = (summary[k] ?? 0) + 1
}
console.log(`${toWrite.length} sessions to write${deleted.size ? `, ${deleted.size} to delete` : ''}:`)
for (const [k, n] of Object.entries(summary).sort()) console.log(`  ${k.padEnd(24)} ${n}`)

// No process.exit() past this point: exiting with fetch sockets still open
// trips a libuv assertion on Windows.
if (DRY_RUN) {
  const sample = toWrite.filter(d => d.importedFrom === 'strong' && d.zepp).slice(0, 2)
    .concat(toWrite.filter(d => d.source === 'garmin' && d.type === 'run').slice(0, 1))
  for (const d of sample) console.log(JSON.stringify(d).slice(0, 700))
} else {
  for (const savedAt of deleted) {
    const { error } = await supabase.from('sessions').delete().eq('user_id', USER_ID).eq('saved_at', savedAt)
    if (error) { console.error('Delete failed:', error.message); process.exitCode = 1 }
  }
  const upserts = toWrite.map(d => ({ user_id: USER_ID, saved_at: d.savedAt, data: d }))
  let written = 0
  for (let i = 0; i < upserts.length; i += 300) {
    const { error } = await supabase.from('sessions').upsert(upserts.slice(i, i + 300), { onConflict: 'user_id,saved_at' })
    if (error) { console.error('Upsert failed:', error.message); process.exitCode = 1; break }
    written += Math.min(300, upserts.length - i)
  }
  console.log(`Wrote ${written} sessions`)
}
