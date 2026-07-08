import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Fail loudly on first use instead of silently talking to a placeholder host.
// The check must NOT run at module scope: Next's build-time page-data
// collection imports this module and would fail the whole build.
let client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      const msg = 'Supabase env vars missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
      if (process.env.NODE_ENV === 'production') throw new Error(msg)
      console.warn(msg)
    }
    client = createClient(url ?? 'https://placeholder.supabase.co', key ?? 'placeholder')
  }
  return client
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const real = getClient()
    const value = (real as unknown as Record<string | symbol, unknown>)[prop]
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(real) : value
  },
})
