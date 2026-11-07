#!/usr/bin/env node
/**
 * Renpho → TheHybridLife sync. Renpho is the main source for bodyweight.
 *
 * Reads the signed-in Renpho profile and writes, for HEALTH_IMPORT_USER_ID:
 *   - every weigh-in → renpho_body
 *   - last / lowest-morning weight per day → zepp_daily.weight_kg, weight_am_kg
 *   - 7-day median → user_settings.bodyweight_kg
 *   - result → user_settings.renpho_sync_status (Weight tab)
 *
 * Usage:
 *   node scripts/renpho-sync.mjs             # daily weights for the last 30 days
 *   node scripts/renpho-sync.mjs --all       # daily weights for the full history
 *   node scripts/renpho-sync.mjs --dry-run   # print the plan, write nothing
 *
 * Runs before each 2-hourly Zepp sync (zepp-sync.bat) and from the site's
 * "Sync Renpho" button (zepp-sync-poll.mjs). RENPHO_EMAIL / RENPHO_PASSWORD stay
 * in .env.local on this PC.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { RenphoClient } from './renpho-client.mjs'
import { toBodyReading } from '../src/lib/renpho.ts'
import { buildZeppDaily, scaleBodyweight } from '../src/lib/zeppDaily.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN = process.argv.includes('--dry-run')
const ALL = process.argv.includes('--all')
const RECENT_DAYS = 30
const CHUNK = 500

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
const USER_ID = env.HEALTH_IMPORT_USER_ID
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !USER_ID) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or HEALTH_IMPORT_USER_ID')
  process.exit(1)
}
if (!env.RENPHO_EMAIL || !env.RENPHO_PASSWORD) {
  console.error('Missing RENPHO_EMAIL or RENPHO_PASSWORD')
  process.exit(1)
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function writeStatus(ok, message, latestDay = null) {
  if (DRY_RUN) return
  const value = JSON.stringify({ at: new Date().toISOString(), ok, latestDay, message })
  const { error } = await supabase.from('user_settings')
    .upsert({ user_id: USER_ID, key: 'renpho_sync_status', value }, { onConflict: 'key,user_id' })
  if (error) console.error('Status update failed:', error.message)
}

async function upsertChunks(table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + CHUNK), { onConflict })
    if (error) return error
  }
  return null
}

async function sync() {
  const client = new RenphoClient(env.RENPHO_EMAIL, env.RENPHO_PASSWORD)
  await client.login()
  const raw = await client.measurements()
  const readings = raw.map(r => toBodyReading(r, String(client.userId))).filter(Boolean)
    .sort((a, b) => a.measured_at.localeCompare(b.measured_at))
  // An empty result would otherwise look like a clean sync.
  if (!readings.length) throw new Error('Renpho returned no readings for this profile')

  const weights = readings.map(r => ({ timestamp: r.measured_at, kg: r.weight_kg }))
  const allDays = buildZeppDaily([], [], weights)
  const since = new Date(Date.now() - RECENT_DAYS * 86400e3).toISOString().slice(0, 10)
  const now = new Date().toISOString()
  const daily = allDays
    .filter(r => ALL || r.date >= since)
    .map(r => ({ user_id: USER_ID, date: r.date, weight_kg: r.weight_kg, weight_am_kg: r.weight_am_kg, updated_at: now }))
  const bodyweight = scaleBodyweight(weights)
  const latest = readings.at(-1)
  const composition = readings.filter(r => r.body_fat_pct != null).length
  const summary = `${readings.length} readings, ${composition} with body composition`

  if (DRY_RUN) {
    console.log(`${summary}; ${readings[0].date} to ${latest.date}; ${allDays.length} days`)
    console.log(`${daily.length} daily weights to write; bodyweight ${bodyweight?.kg ?? '-'} kg`)
    const { data } = await supabase.from('zepp_daily').select('date, weight_kg')
      .eq('user_id', USER_ID).not('weight_kg', 'is', null)
    const byDate = new Map(allDays.map(r => [r.date, r.weight_kg]))
    const shared = (data ?? []).filter(r => byDate.has(r.date))
    const differ = shared.filter(r => Math.abs(r.weight_kg - byDate.get(r.date)) >= 0.15)
    console.log(`Existing weight days: ${data?.length ?? 0}; on Renpho too: ${shared.length}; differ by 0.15 kg+: ${differ.length}`)
    return
  }

  // Weight first: every other page reads it, so it shouldn't wait on renpho_body.
  let warning = ''
  let error = await upsertChunks('zepp_daily', daily, 'user_id,date')
  if (error && /weight_am_kg/.test(error.message)) {
    console.log('weight_am_kg column missing: run the 2026-11-06 migration in supabase/schema.sql')
    warning = ' Morning weights need the 2026-11-06 migration.'
    error = await upsertChunks('zepp_daily', daily.map(({ weight_am_kg, ...r }) => r), 'user_id,date')
  }
  if (error) throw new Error(`Daily weights failed: ${error.message}`)

  if (bodyweight) {
    const { error: e } = await supabase.from('user_settings').upsert([
      { user_id: USER_ID, key: 'bodyweight_kg', value: String(bodyweight.kg) },
      { user_id: USER_ID, key: 'bodyweight_source', value: JSON.stringify({ source: 'renpho', asOf: bodyweight.asOf }) },
    ], { onConflict: 'key,user_id' })
    if (e) throw new Error(`Bodyweight update failed: ${e.message}`)
  }

  error = await upsertChunks('renpho_body', readings.map(r => ({ ...r, user_id: USER_ID, updated_at: now })), 'user_id,reading_id')
  if (error) throw new Error(`Readings failed: ${error.message}`)

  console.log(`[${now}] Renpho: ${summary}; latest ${latest.date} ${latest.weight_kg} kg; ${daily.length} daily weights`)
  await writeStatus(!warning, summary + warning, latest.date)
}

try {
  await sync()
} catch (e) {
  const message = e instanceof Error ? e.message : String(e)
  console.error(`[${new Date().toISOString()}] ${message}`)
  await writeStatus(false, message)
  process.exitCode = 1
}
