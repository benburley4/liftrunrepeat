import { supabase } from './supabase'
import { dedupeSessions } from './sessionDedupe'
import type { ZeppDailyRow } from './zeppDaily'
import type { BodyReading } from './renpho'
import type { SeriesPoint, LatLon } from './zeppSeries'

export interface StoredSession {
  type: string
  name: string
  date: string
  savedAt: string
  exercises?: unknown[]
  run?: unknown[]
}

function throwIfError(error: unknown) {
  if (!error) return
  const e = error as { message?: string; details?: string; code?: string }
  throw new Error(`Supabase error: ${e.message ?? JSON.stringify(error)} (code: ${e.code}, details: ${e.details})`)
}

// PostgREST returns at most 1000 rows per request, so long histories are paged.
const PAGE = 1000

// ─── Read cache ─────────────────────────────────────────────────────────────
// These full-history readers pull large JSONB (sessions.data, GPS routes) and
// are called on almost every page mount. Re-reading them each time is the main
// Supabase Disk IO cost, so one in-flight read is shared for a short window and
// writes bust the relevant key. The cache is module-level: it survives SPA
// navigation and resets on a full page reload.
const CACHE_TTL_MS = 5 * 60_000
const readCache = new Map<string, { at: number; p: Promise<unknown> }>()

function cached<T>(key: string, load: () => Promise<T>, ttl = CACHE_TTL_MS): Promise<T> {
  const hit = readCache.get(key)
  if (hit && Date.now() - hit.at < ttl) return hit.p as Promise<T>
  const p = load()
  readCache.set(key, { at: Date.now(), p })
  // On failure, drop the entry so the next call retries instead of caching a reject.
  p.catch(() => { if (readCache.get(key)?.p === p) readCache.delete(key) })
  return p
}

/** Drop cached reads whose key starts with `prefix` (after a write). */
function invalidate(prefix: string) {
  for (const k of readCache.keys()) if (k === prefix || k.startsWith(`${prefix}:`)) readCache.delete(k)
}

/**
 * Bust cached reads so the next call hits Supabase. Pass key prefixes
 * (`sessions`, `zepp_daily`, `renpho_body`, `zepp_routes`); no args clears all.
 * Call this after an out-of-band write such as a watch/Renpho sync completing,
 * so the reload shows fresh data instead of the cached copy.
 */
export function clearReadCache(...prefixes: string[]) {
  if (!prefixes.length) { readCache.clear(); return }
  for (const p of prefixes) invalidate(p)
}

export async function getSessions(): Promise<StoredSession[]> {
  return cached('sessions', async () => {
    const rows: { data: unknown }[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('sessions')
        .select('data')
        .order('saved_at', { ascending: false })
        .range(from, from + PAGE - 1)
      throwIfError(error)
      rows.push(...(data ?? []))
      if ((data ?? []).length < PAGE) break
    }
    return dedupeSessions(rows.map(row => row.data as StoredSession))
  })
}

/** Every saved session on one date, duplicates included (for the save-time check). */
export async function getSessionsOnDate(date: string): Promise<StoredSession[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('data')
    .eq('data->>date', date)
  throwIfError(error)
  return (data ?? []).map(row => row.data as StoredSession)
}

export async function upsertSession(session: StoredSession): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('sessions')
    .upsert({ saved_at: session.savedAt, data: session, user_id: user?.id }, { onConflict: 'user_id,saved_at' })
  throwIfError(error)
  invalidate('sessions')
}

export async function deleteSession(savedAt: string): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('saved_at', savedAt)
  throwIfError(error)
  invalidate('sessions')
}

export async function upsertAllSessions(sessions: StoredSession[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  const rows = sessions.map(s => ({ saved_at: s.savedAt, data: s, user_id: user?.id }))
  const { error } = await supabase
    .from('sessions')
    .upsert(rows, { onConflict: 'user_id,saved_at' })
  throwIfError(error)
  invalidate('sessions')
}

// ─── Programmes ───────────────────────────────────────────────────────────────

export async function getProgrammes(): Promise<unknown[]> {
  const { data, error } = await supabase
    .from('programmes')
    .select('data')
    .order('updated_at', { ascending: false })
  throwIfError(error)
  return (data ?? []).map(row => row.data)
}

export async function upsertProgramme(id: string, prog: unknown): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('programmes')
    .upsert({ id, data: prog, user_id: user?.id, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  throwIfError(error)
}

export async function deleteProgramme(id: string): Promise<void> {
  const { error } = await supabase
    .from('programmes')
    .delete()
    .eq('id', id)
  throwIfError(error)
}

// ─── Templates ────────────────────────────────────────────────────────────────

export async function getTemplates(): Promise<unknown[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('data')
    .order('updated_at', { ascending: false })
  throwIfError(error)
  return (data ?? []).map(row => row.data)
}

export async function upsertTemplate(id: string, tpl: unknown): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('templates')
    .upsert({ id, data: tpl, user_id: user?.id, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  throwIfError(error)
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', id)
  throwIfError(error)
}

// ─── Zepp daily recovery data (written by scripts/zepp-sync.mjs) ─────────────

/** Every Renpho weigh-in, oldest first. Paged: a reading a day passes the row cap. */
export async function getRenphoBody(): Promise<BodyReading[]> {
  return cached('renpho_body', async () => {
    const rows: BodyReading[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('renpho_body')
        .select('*')
        .order('measured_at', { ascending: true })
        .range(from, from + PAGE - 1)
      throwIfError(error)
      rows.push(...((data ?? []) as BodyReading[]))
      if ((data ?? []).length < PAGE) break
    }
    return rows
  })
}

/**
 * Daily watch/recovery rows. `sinceDays` limits the read to recent days via the
 * `(user_id, date)` primary-key index — use it from callers that only need a
 * recent window (e.g. the AI context) to avoid detoasting the full 2018→now
 * history. Omit it for the all-time views.
 */
export async function getZeppDaily(opts: { sinceDays?: number } = {}): Promise<ZeppDailyRow[]> {
  const since = opts.sinceDays
    ? new Date(Date.now() - opts.sinceDays * 86400e3).toISOString().slice(0, 10)
    : null
  return cached(since ? `zepp_daily:${since}` : 'zepp_daily', async () => {
    // Garmin backfill reaches back to 2018 (>1000 days), so page it.
    const rows: ZeppDailyRow[] = []
    for (let from = 0; ; from += PAGE) {
      let q = supabase.from('zepp_daily').select('*')
      if (since) q = q.gte('date', since)
      const { data, error } = await q
        .order('date', { ascending: true })
        .range(from, from + PAGE - 1)
      throwIfError(error)
      rows.push(...((data ?? []) as ZeppDailyRow[]))
      if ((data ?? []).length < PAGE) break
    }
    return rows
  })
}

/** Watch-recorded strength sessions still waiting for their sets to be logged. */
export async function getSessionsNeedingSets(): Promise<StoredSession[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('data')
    .eq('data->>needsSets', 'true')
    .order('saved_at', { ascending: false })
  throwIfError(error)
  return (data ?? []).map(row => row.data as StoredSession)
}

/** HR-zone upper bounds from the most recent watch workout that has them. */
export async function getLatestWatchHrZones(): Promise<{ upperBpm: number; seconds: number }[] | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('data->zepp->hrZones')
    .not('data->zepp->hrZones', 'is', null)
    .order('saved_at', { ascending: false })
    .limit(1)
  if (error) return null
  return ((data?.[0] as { hrZones?: unknown } | undefined)?.hrZones as { upperBpm: number; seconds: number }[]) ?? null
}

/** Per-minute trace and GPS route for one watch workout (either may be null). */
export async function getZeppWorkoutSeries(workoutId: string): Promise<{ points: SeriesPoint[] | null; route: LatLon[] | null }> {
  const empty = { points: null, route: null }
  let res = await supabase.from('zepp_workout_series').select('points, route').eq('workout_id', workoutId).maybeSingle()
  // Route column not migrated yet → fall back to the trace alone.
  if (res.error) res = await supabase.from('zepp_workout_series').select('points').eq('workout_id', workoutId).maybeSingle()
  if (res.error || !res.data) return empty  // table missing / no access / nothing synced — the panel just omits these
  const row = res.data as { points?: SeriesPoint[] | null; route?: LatLon[] | null }
  return { points: row.points ?? null, route: row.route ?? null }
}

/** Every synced GPS route, keyed by watch workout id (empty when the route column or table is missing). */
export async function getZeppRoutes(): Promise<Record<string, LatLon[]>> {
  return cached('zepp_routes', async () => {
    const out: Record<string, LatLon[]> = {}
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('zepp_workout_series')
        .select('workout_id, route')
        .not('route', 'is', null)
        .range(from, from + PAGE - 1)
      if (error) return out
      for (const row of (data ?? []) as { workout_id: string; route: LatLon[] | null }[])
        if (Array.isArray(row.route) && row.route.length > 1) out[row.workout_id] = row.route
      if ((data ?? []).length < PAGE) break
    }
    return out
  })
}

// ─── User Settings ────────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  const { data } = await supabase
    .from('user_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  return data?.value ?? null
}

/** All settings whose key starts with `prefix` (no `%` / `_` in the prefix). */
export async function getSettingsByPrefix(prefix: string): Promise<{ key: string; value: string | null }[]> {
  const out: { key: string; value: string | null }[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('user_settings')
      .select('key, value')
      .like('key', `${prefix}%`)
      .order('key', { ascending: true })
      .range(from, from + PAGE - 1)
    throwIfError(error)
    out.push(...((data ?? []) as { key: string; value: string | null }[]))
    if ((data ?? []).length < PAGE) break
  }
  return out
}

export async function upsertSetting(key: string, value: string | null): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  if (value === null) {
    await supabase.from('user_settings').delete().eq('key', key).eq('user_id', user.id)
    return
  }
  const { error } = await supabase
    .from('user_settings')
    .upsert({ key, user_id: user.id, value }, { onConflict: 'key,user_id' })
  throwIfError(error)
}

// ─── AI Reports ───────────────────────────────────────────────────────────────

export async function getAIReports(): Promise<unknown[]> {
  const { data, error } = await supabase
    .from('ai_reports')
    .select('id, data')
    .order('created_at', { ascending: false })
    .limit(10)
  throwIfError(error)
  return (data ?? []).map(row => row.data)
}

export async function upsertAIReport(id: string, report: unknown): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('ai_reports')
    .upsert({ id, data: report, user_id: user?.id, created_at: new Date().toISOString() }, { onConflict: 'id' })
  throwIfError(error)
  // Trim to last 10 — fetch only the ids past the newest 10 (ids are tiny; this
  // skips reading the whole table) and delete them when there are any.
  const { data: stale } = await supabase
    .from('ai_reports')
    .select('id')
    .order('created_at', { ascending: false })
    .range(10, 10 + PAGE)
  if (stale && stale.length) {
    await supabase.from('ai_reports').delete().in('id', stale.map((r: { id: string }) => r.id))
  }
}

export async function deleteAIReport(id: string): Promise<void> {
  const { error } = await supabase
    .from('ai_reports')
    .delete()
    .eq('id', id)
  throwIfError(error)
}

// ─── Weekly Coach Reports ─────────────────────────────────────────────────────

export interface CoachReport {
  id: string
  weekEnding: string   // ISO date string YYYY-MM-DD (Sunday of the week)
  reportText: string
  stats: unknown
  createdAt: string
}

export async function getCoachReports(): Promise<CoachReport[]> {
  const { data, error } = await supabase
    .from('coach_reports')
    .select('id, week_ending, report_text, stats, created_at')
    .order('week_ending', { ascending: false })
  throwIfError(error)
  return (data ?? []).map(row => ({
    id: row.id,
    weekEnding: row.week_ending,
    reportText: row.report_text,
    stats: row.stats,
    createdAt: row.created_at,
  }))
}

export async function deleteCoachReport(id: string): Promise<void> {
  const { error } = await supabase.from('coach_reports').delete().eq('id', id)
  throwIfError(error)
}

export async function saveCoachReport(weekEnding: string, reportText: string, stats: unknown): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { error } = await supabase
    .from('coach_reports')
    .upsert(
      { user_id: user.id, week_ending: weekEnding, report_text: reportText, stats, created_at: new Date().toISOString() },
      { onConflict: 'user_id,week_ending' }
    )
  throwIfError(error)
  // All reports are kept — users can delete individual ones from the Weekly Review tab
}

// ─── Custom Exercises ─────────────────────────────────────────────────────────

export async function getCustomExercises(): Promise<unknown[]> {
  const { data, error } = await supabase
    .from('custom_exercises')
    .select('data')
    .order('created_at', { ascending: true })
  throwIfError(error)
  return (data ?? []).map(row => row.data)
}

export async function upsertCustomExercise(id: string, ex: unknown): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('custom_exercises')
    .upsert({ id, data: ex, user_id: user?.id }, { onConflict: 'id' })
  throwIfError(error)
}

export async function deleteCustomExercise(id: string): Promise<void> {
  const { error } = await supabase
    .from('custom_exercises')
    .delete()
    .eq('id', id)
  throwIfError(error)
}
