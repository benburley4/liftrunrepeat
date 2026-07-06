import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Fail loudly in production instead of silently talking to a placeholder host
if (!url || !key) {
  const msg = 'Supabase env vars missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
  if (process.env.NODE_ENV === 'production') throw new Error(msg)
  console.warn(msg)
}

export const supabase = createClient(url ?? 'https://placeholder.supabase.co', key ?? 'placeholder')
