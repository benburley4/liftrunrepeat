#!/usr/bin/env node
/**
 * One-off Garmin detail backfill, run after scripts/backfill-history.mjs.
 *
 * Reads from Data/ (gitignored):
 *   - Data/garmin-fit/*.fit  — the activity FIT files from the Garmin export's
 *     DI-Connect-Uploaded-Files zips (only type "activity"; the other ~70k
 *     files are daily monitoring data)
 *   - Data/<garmin export>/DI_CONNECT/… — activity summaries (to match FIT
 *     files to sessions), daily summaries, sleep and Training Readiness
 *
 * Writes, for HEALTH_IMPORT_USER_ID via the service role key:
 *   1. zepp_workout_series rows (workout_id "garmin-<activityId>"): per-minute
 *      HR / altitude / pace trace and the privacy-trimmed GPS route
 *   2. sessions: zepp.hrZones and zepp.splits where still empty
 *   3. zepp_daily rows for dates that have no row yet (never overwrites
 *      Amazfit days): steps, distance, sleep, resting HR, stress, readiness
 *
 * Idempotent: re-running rewrites the same series rows and skips filled fields.
 *
 * Usage:
 *   node scripts/backfill-garmin-detail.mjs            # dry run: counts + samples, writes nothing
 *   node scripts/backfill-garmin-detail.mjs --write
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { Decoder, Stream } from '@garmin/fitsdk'
import { downsampleSeries, buildRoute } from '../src/lib/zeppSeries.ts'
import { fitSamples, fitRoutePoints, fitHrZones, fitKmSplits, garminDailyRows } from '../src/lib/garminDetail.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'Data')
const FIT_DIR = join(DATA_DIR, 'garmin-fit')
const WRITE = process.argv.includes('--write')

function loadEnv() {
  const env = {}
  try {
    for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* fall back to process.env */ }
  return { ...env, ...process.env }
}
const env = loadEnv()
const USER_ID = env.HEALTH_IMPORT_USER_ID
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !USER_ID) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or HEALTH_IMPORT_USER_ID')
  process.exit(1)
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// ── Garmin export folders ────────────────────────────────────────────────────
const exportDir = readdirSync(DATA_DIR).map(d => join(DATA_DIR, d, 'DI_CONNECT')).find(existsSync)
if (!exportDir || !existsSync(FIT_DIR)) { console.error(`Need ${FIT_DIR} and a Garmin export under ${DATA_DIR}`); process.exit(1) }
const readJsonFiles = (dir, test) => readdirSync(join(exportDir, dir)).filter(test).flatMap(f => {
  const v = JSON.parse(readFileSync(join(exportDir, dir, f), 'utf8'))
  return Array.isArray(v) ? v : [v]
})

// Activity summaries: start time (to the second) → activity id.
const activities = readJsonFiles('DI-Connect-Fitness', f => f.endsWith('_summarizedActivities.json'))
  .flatMap(x => x.summarizedActivitiesExport ?? [])
const idByStart = new Map(activities.map(a => [Math.round(a.startTimeGmt / 1000), a.activityId]))
const findActivity = startMs => {
  const s = Math.round(startMs / 1000)
  for (const d of [0, -1, 1, -2, 2]) if (idByStart.has(s + d)) return idByStart.get(s + d)
  return null
}

// Fallback HR zone limits (current Garmin profile) for files without time-in-zone.
const hrz = readJsonFiles('DI-Connect-Wellness', f => f.endsWith('heartRateZones.json')).find(z => z.sport === 'DEFAULT')
const FALLBACK_BOUNDS = hrz ? [hrz.zone1Floor, hrz.zone2Floor, hrz.zone3Floor, hrz.zone4Floor, hrz.zone5Floor, hrz.maxHeartRateUsed] : []

// ── Decode every activity FIT file ───────────────────────────────────────────
const files = readdirSync(FIT_DIR).filter(f => f.endsWith('.fit'))
const detail = new Map()   // activityId → { series, route, zones, splits, sport }
let unmatched = 0, unreadable = 0
for (const f of files) {
  let messages
  try {
    ({ messages } = new Decoder(Stream.fromByteArray(readFileSync(join(FIT_DIR, f)))).read({ convertDateTimesToDates: true }))
  } catch { unreadable++; continue }
  const session = messages.sessionMesgs?.[0]
  const records = messages.recordMesgs ?? []
  if (!session?.startTime) { unreadable++; continue }
  const id = findActivity(session.startTime.getTime())
  if (!id) { unmatched++; continue }
  const points = downsampleSeries(fitSamples(records), session.startTime.toISOString())
  detail.set(id, {
    sport: session.sport,
    series: points.length > 1 ? points : null,
    route: buildRoute(fitRoutePoints(records)),
    zones: fitHrZones(messages.timeInZoneMesgs ?? [], records, FALLBACK_BOUNDS),
    splits: fitKmSplits(records),
  })
}
console.log(`FIT files: ${files.length} · matched ${detail.size} · unmatched ${unmatched} · unreadable ${unreadable}`)

// ── Existing Garmin-linked sessions ──────────────────────────────────────────
const rows = []
for (let p = 0; ; p++) {
  const { data, error } = await supabase.from('sessions').select('saved_at, data')
    .eq('user_id', USER_ID).like('data->zepp->>workoutId', 'garmin-%')
    .order('saved_at').range(p * 1000, p * 1000 + 999)
  if (error) { console.error('Failed to read sessions:', error.message); process.exit(1) }
  rows.push(...data)
  if (data.length < 1000) break
}

const sessionUpdates = []
let zonesAdded = 0, splitsAdded = 0
for (const r of rows) {
  const d = detail.get(Number(String(r.data.zepp.workoutId).slice('garmin-'.length)))
  if (!d) continue
  const zepp = { ...r.data.zepp }
  let changed = false
  if (!zepp.hrZones && d.zones) { zepp.hrZones = d.zones; zonesAdded++; changed = true }
  // Splits only for on-foot outings (a strength session's "km" is meaningless).
  if (!zepp.splits && d.splits && ['running', 'walking', 'hiking'].includes(d.sport)) { zepp.splits = d.splits; splitsAdded++; changed = true }
  if (changed) sessionUpdates.push({ user_id: USER_ID, saved_at: r.saved_at, data: { ...r.data, zepp } })
}

const linkedIds = new Set(rows.map(r => String(r.data.zepp.workoutId)))
const seriesRows = [...detail.entries()]
  .filter(([id, d]) => linkedIds.has(`garmin-${id}`) && (d.series || d.route))
  .map(([id, d]) => ({ user_id: USER_ID, workout_id: `garmin-${id}`, points: d.series, route: d.route, updated_at: new Date().toISOString() }))

// ── Daily rows for dates with no zepp_daily row yet ──────────────────────────
const existingDays = new Set()
for (let p = 0; ; p++) {
  const { data, error } = await supabase.from('zepp_daily').select('date').eq('user_id', USER_ID).range(p * 1000, p * 1000 + 999)
  if (error) { console.error('Failed to read zepp_daily:', error.message); process.exit(1) }
  for (const d of data) existingDays.add(d.date)
  if (data.length < 1000) break
}
const daily = garminDailyRows(
  readJsonFiles('DI-Connect-Aggregator', f => f.startsWith('UDSFile_')),
  readJsonFiles('DI-Connect-Wellness', f => f.endsWith('_sleepData.json')),
  readJsonFiles('DI-Connect-Metrics', f => f.startsWith('TrainingReadinessDTO_')),
).filter(r => !existingDays.has(r.date) && (r.steps || r.sleep_min || r.readiness))
  .map(r => ({ user_id: USER_ID, ...r, updated_at: new Date().toISOString() }))

// ── Report ───────────────────────────────────────────────────────────────────
const bySport = {}
for (const r of seriesRows) {
  const s = detail.get(Number(r.workout_id.slice(7))).sport ?? 'other'
  bySport[s] ??= { traces: 0, routes: 0 }
  if (r.points) bySport[s].traces++
  if (r.route) bySport[s].routes++
}
console.log(`Garmin-linked sessions: ${rows.length}`)
console.log(`Workout series to write: ${seriesRows.length}`)
for (const [s, c] of Object.entries(bySport).sort((a, b) => b[1].traces - a[1].traces)) console.log(`  ${String(s).padEnd(18)} ${String(c.traces).padStart(5)} traces  ${String(c.routes).padStart(5)} routes`)
console.log(`Sessions to update: ${sessionUpdates.length} (HR zones +${zonesAdded}, km splits +${splitsAdded})`)
console.log(`Daily rows to add: ${daily.length}${daily.length ? ` (${daily[0].date} to ${daily.at(-1).date}; ${daily.filter(d => d.steps).length} with steps, ${daily.filter(d => d.sleep_min).length} with sleep, ${daily.filter(d => d.readiness).length} with readiness)` : ''}`)

// No process.exit() past this point: exiting with fetch sockets still open
// trips a libuv assertion on Windows.
if (!WRITE) {
  const run = sessionUpdates.find(u => u.data.zepp.splits && u.data.type === 'run')
  if (run) console.log('Sample run:', JSON.stringify({ date: run.data.date, hrZones: run.data.zepp.hrZones, splits: run.data.zepp.splits.slice(0, 3) }))
  const sr = seriesRows.find(r => r.route)
  if (sr) console.log('Sample series:', sr.workout_id, `${sr.points?.length ?? 0} points, ${sr.route.length} route points`, JSON.stringify(sr.points?.slice(0, 3)))
  if (daily.length) console.log('Sample day:', JSON.stringify(daily.at(-1)))
  console.log('\nDry run: nothing written. Re-run with --write to apply.')
} else {
  let ok = 0
  for (let i = 0; i < seriesRows.length; i += 50) {
    const { error } = await supabase.from('zepp_workout_series').upsert(seriesRows.slice(i, i + 50), { onConflict: 'user_id,workout_id' })
    if (error) { console.error('Series upsert failed:', error.message); process.exitCode = 1; break }
    ok += Math.min(50, seriesRows.length - i)
  }
  console.log(`Wrote ${ok} workout series`)
  ok = 0
  for (let i = 0; i < sessionUpdates.length; i += 200) {
    const { error } = await supabase.from('sessions').upsert(sessionUpdates.slice(i, i + 200), { onConflict: 'user_id,saved_at' })
    if (error) { console.error('Session upsert failed:', error.message); process.exitCode = 1; break }
    ok += Math.min(200, sessionUpdates.length - i)
  }
  console.log(`Updated ${ok} sessions`)
  ok = 0
  for (let i = 0; i < daily.length; i += 500) {
    const { error } = await supabase.from('zepp_daily').upsert(daily.slice(i, i + 500), { onConflict: 'user_id,date' })
    if (error) { console.error('Daily upsert failed:', error.message); process.exitCode = 1; break }
    ok += Math.min(500, daily.length - i)
  }
  console.log(`Wrote ${ok} daily rows`)
}
