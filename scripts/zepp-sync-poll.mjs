#!/usr/bin/env node
/**
 * Answers the site's "Sync now" button (navbar watch box) and "Send to watch"
 * requests (zepp-watch-push.mjs).
 *
 * Runs every minute (task TheHybridLife_ZeppSyncPoll). If
 * user_settings.zepp_sync_request is newer than zepp_sync_status, runs
 * scripts/zepp-sync.mjs (which writes a fresh status when it finishes).
 * Silent when there is nothing to do, so the log only records real syncs.
 * Requests older than 15 minutes are ignored (PC was off — the regular
 * 2-hourly sync covers them).
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { handleWatchPush } from './zepp-watch-push.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MAX_REQUEST_AGE_MS = 15 * 60_000

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
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data, error } = await supabase.from('user_settings')
  .select('key, value')
  .eq('user_id', env.HEALTH_IMPORT_USER_ID)
  .in('key', ['zepp_sync_request', 'zepp_sync_status'])
if (error) {
  console.error(`[${new Date().toISOString()}] poll failed: ${error.message}`)
  process.exitCode = 1
} else {
  const get = key => { try { return JSON.parse(data.find(r => r.key === key)?.value ?? 'null') } catch { return null } }
  const request = get('zepp_sync_request')
  const status = get('zepp_sync_status')
  const fresh = request?.at && Date.now() - new Date(request.at).getTime() < MAX_REQUEST_AGE_MS
  if (fresh && (!status?.at || request.at > status.at)) {
    console.log(`[${new Date().toISOString()}] Sync requested from the site at ${request.at}`)
    const run = spawnSync(process.execPath, ['--no-warnings', join(__dirname, 'zepp-sync.mjs')], { stdio: 'inherit' })
    process.exitCode = run.status ?? 1
  }
}

// "Send to watch" requests (run builder / programme → Amazfit watch).
try {
  await handleWatchPush(supabase, env.HEALTH_IMPORT_USER_ID)
} catch (e) {
  console.error(`[${new Date().toISOString()}] ${e.message}`)
  process.exitCode = 1
}
