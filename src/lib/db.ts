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
