/**
 * POST /api/health-import
 * Receives workout data from the "Health Auto Export" iOS app and saves
 * sessions to Supabase. Secured with a static API key in HEALTH_IMPORT_SECRET.
 *
 * Health Auto Export setup:
 *   Export type: REST API
 *   URL: https://<your-domain>/api/health-import
 *   Header: x-api-key: <HEALTH_IMPORT_SECRET value>
 *   Data types: Workouts
 *   Format: JSON
 *
 * Parsing logic lives in src/lib/healthImport.ts (unit-tested).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { AppleWorkout, workoutToSession } from '@/lib/healthImport'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!   // service role — bypasses RLS
const IMPORT_SECRET = process.env.HEALTH_IMPORT_SECRET ?? ''

export async function POST(req: NextRequest) {
  // Auth
  const key = req.headers.get('x-api-key') ?? req.nextUrl.searchParams.get('api_key') ?? ''
  if (!IMPORT_SECRET || key !== IMPORT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Health Auto Export sends { data: { workouts: [...] } } or just [...]
  let workouts: AppleWorkout[] = []
  if (Array.isArray(body)) {
    workouts = body as AppleWorkout[]
  } else {
    const b = body as Record<string, unknown>
    const data = (b.data ?? b) as Record<string, unknown>
    workouts = (data.workouts ?? data.Workouts ?? []) as AppleWorkout[]
  }

  if (!workouts.length) {
    return NextResponse.json({ imported: 0, message: 'No workouts in payload' })
  }

  // Build session rows
  const sessions = workouts.map(workoutToSession)

  // Upsert into Supabase using service role (no user auth needed server-side)
  // Sessions are keyed by (user_id, saved_at) so re-importing is idempotent.
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  // Resolve user — imports are stored against the account in HEALTH_IMPORT_USER_ID.
  const userId = process.env.HEALTH_IMPORT_USER_ID
  if (!userId) {
    return NextResponse.json({ error: 'HEALTH_IMPORT_USER_ID env var not set' }, { status: 500 })
  }

  const rows = sessions.map(s => ({
    saved_at: s.savedAt,
    data: s,
    user_id: userId,
  }))

  const { error } = await supabase
    .from('sessions')
    .upsert(rows, { onConflict: 'user_id,saved_at' })

  if (error) {
    console.error('health-import upsert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ imported: rows.length })
}
