import { supabase } from './supabase'

export async function signUp(username: string, email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  })
  if (error) throw error
  return data
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export function getUsername(user: { user_metadata?: { username?: string }; email?: string } | null): string {
  return user?.user_metadata?.username ?? user?.email?.split('@')[0] ?? 'User'
}

/**
 * Headers for calling the app's AI API routes — includes the Supabase access
 * token so the server can verify the caller. Throws if not signed in.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('You must be signed in to use AI features')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  }
}
