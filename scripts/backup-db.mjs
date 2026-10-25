#!/usr/bin/env node
/**
 * Local snapshot of the whole Supabase database (free plan has no backups).
 *
 * Dumps every app table (all users, via the service role key) plus the auth
 * user list (id/email/metadata only) to backups/db-YYYY-MM-DD.json, then
 * prunes snapshots older than KEEP_DAYS. Read-only against Supabase.
 *
 * The folder lives in OneDrive, so each snapshot also gets a cloud copy and
 * OneDrive version history.
 *
 * Usage:
 *   node scripts/backup-db.mjs
 *   KEEP_DAYS=60 node scripts/backup-db.mjs
 *
 * Restoring: rows are stored exactly as Supabase returns them, so a single
 * row (e.g. one programme) can be upserted back from the JSON.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BACKUP_DIR = join(__dirname, '..', 'backups')
const KEEP_DAYS = Number(process.env.KEEP_DAYS ?? 30)
const PAGE = 1000

// Keep in sync with supabase/schema.sql
const TABLES = ['sessions', 'programmes', 'templates', 'custom_exercises', 'ai_reports', 'user_settings', 'coach_reports']

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

const env = { ...loadEnv(), ...process.env }
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` }

async function getJson(path) {
  const res = await fetch(`${URL}${path}`, { headers })
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`)
  return res.json()
}

async function dumpTable(table) {
  const rows = []
  for (let offset = 0; ; offset += PAGE) {
    const page = await getJson(`/rest/v1/${table}?select=*&limit=${PAGE}&offset=${offset}`)
    rows.push(...page)
    if (page.length < PAGE) return rows
  }
}

async function dumpUsers() {
  const users = []
  for (let page = 1; ; page++) {
    const { users: batch } = await getJson(`/auth/v1/admin/users?page=${page}&per_page=${PAGE}`)
    users.push(...batch.map(u => ({ id: u.id, email: u.email, created_at: u.created_at, user_metadata: u.user_metadata })))
    if (batch.length < PAGE) return users
  }
}

const snapshot = { taken_at: new Date().toISOString(), tables: {} }
for (const t of TABLES) snapshot.tables[t] = await dumpTable(t)
snapshot.auth_users = await dumpUsers()

mkdirSync(BACKUP_DIR, { recursive: true })
const file = join(BACKUP_DIR, `db-${snapshot.taken_at.slice(0, 10)}.json`)
writeFileSync(file, JSON.stringify(snapshot))

const cutoff = Date.now() - KEEP_DAYS * 86_400_000
for (const f of readdirSync(BACKUP_DIR)) {
  const m = f.match(/^db-(\d{4}-\d{2}-\d{2})\.json$/)
  if (m && Date.parse(m[1]) < cutoff) unlinkSync(join(BACKUP_DIR, f))
}

const counts = Object.entries(snapshot.tables).map(([t, r]) => `${t}=${r.length}`).join(' ')
console.log(`Saved ${file}  (${counts} users=${snapshot.auth_users.length})`)
