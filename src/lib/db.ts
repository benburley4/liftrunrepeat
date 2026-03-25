import { supabase } from './supabase'

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

export async function getSessions(): Promise<StoredSession[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('data')
    .order('saved_at', { ascending: false })
  throwIfError(error)
  return (data ?? []).map(row => row.data as StoredSession)
}

export async function upsertSession(session: StoredSession): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('sessions')
    .upsert({ saved_at: session.savedAt, data: session, user_id: user?.id }, { onConflict: 'saved_at' })
  throwIfError(error)
}

export async function deleteSession(savedAt: string): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('saved_at', savedAt)
  throwIfError(error)
}

export async function upsertAllSessions(sessions: StoredSession[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  const rows = sessions.map(s => ({ saved_at: s.savedAt, data: s, user_id: user?.id }))
  const { error } = await supabase
    .from('sessions')
    .upsert(rows, { onConflict: 'saved_at' })
  throwIfError(error)
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

// ─── User Settings ────────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  const { data } = await supabase
    .from('user_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  return data?.value ?? null
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
  // Trim to last 10 — delete oldest beyond the limit
  const { data: rows } = await supabase
    .from('ai_reports')
    .select('id')
    .order('created_at', { ascending: false })
  if (rows && rows.length > 10) {
    const toDelete = rows.slice(10).map((r: { id: string }) => r.id)
    await supabase.from('ai_reports').delete().in('id', toDelete)
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
    .limit(12)
  throwIfError(error)
  return (data ?? []).map(row => ({
    id: row.id,
    weekEnding: row.week_ending,
    reportText: row.report_text,
    stats: row.stats,
    createdAt: row.created_at,
  }))
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
  // Trim to last 12 weeks — delete any beyond that
  const { data: rows } = await supabase
    .from('coach_reports')
    .select('id')
    .eq('user_id', user.id)
    .order('week_ending', { ascending: false })
  if (rows && rows.length > 12) {
    const toDelete = rows.slice(12).map((r: { id: string }) => r.id)
    await supabase.from('coach_reports').delete().in('id', toDelete)
  }
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
