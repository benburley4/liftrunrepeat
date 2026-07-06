#!/usr/bin/env node
/**
 * Normalise bodyweight-exercise logging to the "added weight" scheme.
 *
 *   Old convention (historical): logged value = TOTAL system load.
 *       e.g. a bodyweight pull-up was logged as 95 (your bodyweight).
 *   New convention (going forward): logged value = ADDED weight only.
 *       e.g. bodyweight pull-up = 0, +10 kg pull-up = 10.
 *
 * Rule applied to every set of a bodyweight-type exercise:
 *   • weight >= BODYWEIGHT  → treated as total → new = weight - BODYWEIGHT
 *   • weight <  BODYWEIGHT  → already added weight → left unchanged
 *
 * SAFE BY DEFAULT: dry-run only. It prints every change and writes nothing.
 * To actually write the changes back to Supabase, re-run with:  --apply
 *
 * Usage:
 *   node scripts/normalize-bodyweight.mjs            # dry run (no writes)
 *   node scripts/normalize-bodyweight.mjs --apply    # write changes
 *   BW=95 node scripts/normalize-bodyweight.mjs      # override bodyweight (default 95)
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Load .env.local (no dotenv dependency) ───────────────────────────────────
function loadEnv() {
  const env = {}
  try {
    const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* ignore */ }
  return env
}

const env = loadEnv()
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const BODYWEIGHT   = Number(process.env.BW || 95)
const APPLY        = process.argv.includes('--apply')

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

// Same detection the analytics page uses
const BW_RE = /pull.?up|chin.?up|push.?up|\bdip\b|nordic|pistol|muscle.?up|plank|sit.?up|hollow|inverted row|ring|bodyweight|air squat/i

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

// ── Revert mode: restore originals from a backup file ────────────────────────
const revertArg = process.argv.find(a => a.startsWith('--revert='))
if (revertArg) {
  const path = revertArg.slice('--revert='.length)
  const rows = JSON.parse(readFileSync(path, 'utf8'))
  console.log(`Reverting ${rows.length} sessions from ${path} ...`)
  const { error } = await supabase.from('sessions').upsert(rows, { onConflict: 'saved_at' })
  if (error) { console.error('Revert error:', error.message); process.exit(1) }
  console.log(`✓ Reverted ${rows.length} sessions.\n`)
  process.exit(0)
}

function normaliseSets(sets, exName, date, changes) {
  let touched = false
  for (const set of sets ?? []) {
    if (set == null || set.weight == null) continue
    const w = parseFloat(set.weight)
    if (isNaN(w)) continue
    if (w >= BODYWEIGHT) {
      const nw = Math.round((w - BODYWEIGHT) * 100) / 100
      changes.push({ date, exName, from: set.weight, to: String(nw), reps: set.reps })
      set.weight = String(nw)
      touched = true
    }
  }
  return touched
}

async function main() {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`Normalise bodyweight exercises → added-weight scheme`)
  console.log(`Bodyweight threshold: ${BODYWEIGHT} kg`)
  console.log(`Mode: ${APPLY ? '⚠  APPLY (will write to Supabase)' : 'DRY RUN (no writes)'}`)
  console.log(`${'='.repeat(70)}\n`)

  const { data, error } = await supabase
    .from('sessions')
    .select('saved_at, data')
    .order('saved_at', { ascending: false })
  if (error) { console.error('Fetch error:', error.message); process.exit(1) }

  const rowsToWrite = []
  const backups = []
  const allChanges = []
  let bwExerciseCount = 0

  for (const row of data ?? []) {
    const session = row.data
    if (!session || !Array.isArray(session.exercises)) continue
    const original = JSON.parse(JSON.stringify(row.data)) // snapshot before mutation
    let sessionTouched = false

    for (const ex of session.exercises) {
      if (!ex?.exerciseName || !BW_RE.test(ex.exerciseName)) continue
      bwExerciseCount++
      const changes = []
      const a = normaliseSets(ex.actualSets, ex.exerciseName, session.date, changes)
      const p = normaliseSets(ex.plannedSets, ex.exerciseName, session.date, changes)
      if (a || p) sessionTouched = true
      allChanges.push(...changes)
    }

    if (sessionTouched) {
      rowsToWrite.push({ saved_at: row.saved_at, data: session })
      backups.push({ saved_at: row.saved_at, data: original })
    }
  }

  // Report
  if (allChanges.length === 0) {
    console.log('No sets need changing — nothing at/above the bodyweight threshold.\n')
  } else {
    console.log(`Proposed changes (${allChanges.length} sets across ${rowsToWrite.length} sessions):\n`)
    console.log('  DATE        EXERCISE                    REPS   OLD → NEW')
    console.log('  ' + '-'.repeat(64))
    for (const c of allChanges) {
      const date = (c.date ?? '').padEnd(11)
      const name = String(c.exName).slice(0, 26).padEnd(27)
      const reps = String(c.reps ?? '?').padStart(3)
      console.log(`  ${date} ${name} ${reps}    ${String(c.from).padStart(5)} → ${c.to} kg`)
    }
    console.log('')
  }

  console.log(`Bodyweight-exercise blocks scanned: ${bwExerciseCount}`)
  console.log(`Sessions that would be updated:     ${rowsToWrite.length}`)
  console.log(`Sets that would change:             ${allChanges.length}\n`)

  if (!APPLY) {
    console.log('DRY RUN — nothing was written. Re-run with --apply to commit these changes.\n')
    return
  }

  if (rowsToWrite.length === 0) { console.log('Nothing to write.\n'); return }

  // Backup the ORIGINAL (pre-change) affected sessions so a revert is trivial.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = join(__dirname, `backup-bodyweight-${stamp}.json`)
  writeFileSync(backupPath, JSON.stringify(backups, null, 2), 'utf8')
  console.log(`✓ Backup of ${backups.length} original sessions written to:\n    ${backupPath}\n`)

  console.log('Writing changes to Supabase...')
  const { error: upErr } = await supabase
    .from('sessions')
    .upsert(rowsToWrite, { onConflict: 'saved_at' })
  if (upErr) { console.error('Write error:', upErr.message); process.exit(1) }
  console.log(`✓ Updated ${rowsToWrite.length} sessions.\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
