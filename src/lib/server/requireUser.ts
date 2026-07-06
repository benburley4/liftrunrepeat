// Server-side auth + AI usage enforcement for API routes.
// Never import from client components.

import { createClient } from '@supabase/supabase-js'
import { FEATURES } from '@/lib/features'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const serverKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

function serverClient() {
  return createClient(url, serverKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export type AuthResult = { user: { id: string } } | { error: Response }

/**
 * Validates the Supabase access token sent as "Authorization: Bearer <token>".
 * Returns the user id, or an error Response to return directly.
 */
export async function requireUser(req: Request): Promise<AuthResult> {
  if (!url || !serverKey) {
    return { error: new Response('Server auth is not configured', { status: 500 }) }
  }
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return { error: new Response('Unauthorized', { status: 401 }) }

  const { data, error } = await serverClient().auth.getUser(token)
  if (error || !data?.user) return { error: new Response('Unauthorized', { status: 401 }) }
  return { user: { id: data.user.id } }
}

interface AIUsage {
  lifetimeCount: number
  monthCount: number
  monthResetDate: string
}

const DEFAULT_USAGE: AIUsage = { lifetimeCount: 0, monthCount: 0, monthResetDate: '' }

function currentYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Server-side AI usage gate. When the paywall is enabled, checks the user's
 * remaining AI allowance and records the use BEFORE the AI call is made.
 * Returns null if allowed, or an error Response if over limit.
 *
 * NOTE: is_premium currently lives in user_settings which the user's own
 * client can write (RLS scopes rows per user, not per key). Before charging
 * money, move is_premium to a service-role-only table — see supabase/schema.sql.
 */
export async function checkAndRecordAIUse(userId: string): Promise<Response | null> {
  if (!FEATURES.PAYWALL_ENABLED) return null

  const admin = serverClient()
  const [premiumRes, usageRes] = await Promise.all([
    admin.from('user_settings').select('value').eq('user_id', userId).eq('key', 'is_premium').maybeSingle(),
    admin.from('user_settings').select('value').eq('user_id', userId).eq('key', 'ai_usage').maybeSingle(),
  ])
  const isPremium = premiumRes.data?.value === 'true'

  let usage: AIUsage = DEFAULT_USAGE
  try {
    usage = { ...DEFAULT_USAGE, ...(usageRes.data?.value ? JSON.parse(usageRes.data.value) : {}) }
  } catch { /* corrupted usage JSON — treat as fresh */ }

  const ym = currentYearMonth()
  if (isPremium && usage.monthResetDate !== ym) {
    usage = { ...usage, monthCount: 0, monthResetDate: ym }
  }

  const allowed = isPremium
    ? usage.monthCount < FEATURES.PREMIUM.AI_USES_PER_MONTH
    : usage.lifetimeCount < FEATURES.FREE.AI_USES_LIFETIME
  if (!allowed) {
    return new Response(`AI uses exhausted. ${FEATURES.UPGRADE_CTA}`, { status: 429 })
  }

  const updated: AIUsage = isPremium
    ? { ...usage, monthCount: usage.monthCount + 1 }
    : { ...usage, lifetimeCount: usage.lifetimeCount + 1 }
  await admin
    .from('user_settings')
    .upsert({ key: 'ai_usage', user_id: userId, value: JSON.stringify(updated) }, { onConflict: 'key,user_id' })

  return null
}
