'use client'

import { useEffect, useState } from 'react'
import { getSetting, upsertSetting } from '@/lib/db'
import { FEATURES } from '@/lib/features'

interface AIUsage {
  lifetimeCount:  number   // free tier: total AI calls ever
  monthCount:     number   // premium: AI calls this calendar month
  monthResetDate: string   // "YYYY-MM" — month of last reset
}

const DEFAULT_USAGE: AIUsage = { lifetimeCount: 0, monthCount: 0, monthResetDate: '' }

function currentYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Provides premium status, AI usage tracking, and limit helpers.
 * While PAYWALL_ENABLED is false, everything returns permissive values with no DB calls.
 */
export function usePremium() {
  const [isPremium, setIsPremium] = useState(!FEATURES.PAYWALL_ENABLED)
  const [usage,     setUsage]     = useState<AIUsage>(DEFAULT_USAGE)
  const [loading,   setLoading]   = useState(FEATURES.PAYWALL_ENABLED)

  useEffect(() => {
    if (!FEATURES.PAYWALL_ENABLED) return
    Promise.all([getSetting('is_premium'), getSetting('ai_usage')])
      .then(([premiumVal, usageRaw]) => {
        setIsPremium(premiumVal === 'true')
        try {
          const parsed = usageRaw ? JSON.parse(usageRaw as string) : DEFAULT_USAGE
          setUsage({ ...DEFAULT_USAGE, ...parsed })
        } catch {
          setUsage(DEFAULT_USAGE)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  /** Returns usage with monthly count reset if we've rolled into a new month. */
  function effectiveUsage(u: AIUsage): AIUsage {
    const ym = currentYearMonth()
    if (isPremium && u.monthResetDate !== ym) {
      return { ...u, monthCount: 0, monthResetDate: ym }
    }
    return u
  }

  /** True if the user is allowed to make another AI call. */
  function canUseAI(): boolean {
    if (!FEATURES.PAYWALL_ENABLED) return true
    const u = effectiveUsage(usage)
    if (isPremium) return u.monthCount  < FEATURES.PREMIUM.AI_USES_PER_MONTH
    return                u.lifetimeCount < FEATURES.FREE.AI_USES_LIFETIME
  }

  /** How many AI uses remain (Infinity when paywall is off). */
  function aiUsesRemaining(): number {
    if (!FEATURES.PAYWALL_ENABLED) return Infinity
    const u = effectiveUsage(usage)
    if (isPremium) return Math.max(0, FEATURES.PREMIUM.AI_USES_PER_MONTH - u.monthCount)
    return               Math.max(0, FEATURES.FREE.AI_USES_LIFETIME      - u.lifetimeCount)
  }

  /** Human-readable label for the remaining count, e.g. "3 of 4 lifetime uses remaining". */
  function aiUsesLabel(): string {
    if (!FEATURES.PAYWALL_ENABLED) return ''
    const remaining = aiUsesRemaining()
    if (isPremium) return `${remaining} of ${FEATURES.PREMIUM.AI_USES_PER_MONTH} monthly AI uses remaining`
    return               `${remaining} of ${FEATURES.FREE.AI_USES_LIFETIME} lifetime AI uses remaining`
  }

  /** Call this after a successful AI response to deduct one use. */
  async function recordAIUse(): Promise<void> {
    if (!FEATURES.PAYWALL_ENABLED) return
    const u = effectiveUsage(usage)
    const updated: AIUsage = isPremium
      ? { ...u, monthCount:    u.monthCount    + 1 }
      : { ...u, lifetimeCount: u.lifetimeCount + 1 }
    setUsage(updated)
    upsertSetting('ai_usage', JSON.stringify(updated)).catch(console.error)
  }

  /** True if the user is within the free-tier count limit for programmes/templates. */
  function withinLimit(type: 'MAX_PROGRAMMES' | 'MAX_TEMPLATES', currentCount: number): boolean {
    if (!FEATURES.PAYWALL_ENABLED) return true
    if (isPremium) return true
    return currentCount < FEATURES.FREE[type]
  }

  return { isPremium, loading, canUseAI, aiUsesRemaining, aiUsesLabel, recordAIUse, withinLimit }
}
