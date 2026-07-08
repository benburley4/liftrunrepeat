import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Server-only client — never import this in client components.
// Created lazily on first property access: Next's build-time page-data
// collection imports route modules, and constructing the client at module
// scope makes the whole build fail if env vars aren't visible there.
let client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
    if (!url || !serviceKey) {
      throw new Error(
        'Supabase admin not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
      )
    }
    client = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return client
}

export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const real = getClient()
    const value = (real as unknown as Record<string | symbol, unknown>)[prop]
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(real) : value
  },
})
