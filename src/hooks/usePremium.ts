'use client'

import { useEffect, useState } from 'react'
import { getSetting } from '@/lib/db'
import { FEATURES } from '@/lib/features'

/**
 * Returns whether the current user has premium access.
 * While PAYWALL_ENABLED is false everyone is treated as premium.
 * When enabled, reads the 'is_premium' key from user_settings.
 */
export function usePremium() {
  // If paywall is off, skip the DB lookup entirely
  const [isPremium, setIsPremium] = useState(!FEATURES.PAYWALL_ENABLED)
  const [loading,   setLoading]   = useState(FEATURES.PAYWALL_ENABLED)

  useEffect(() => {
    if (!FEATURES.PAYWALL_ENABLED) return
    getSetting('is_premium')
      .then(v  => setIsPremium(v === 'true'))
      .catch(() => setIsPremium(false))
      .finally(() => setLoading(false))
  }, [])

  /** True if this action is allowed — handles both premium check and limit check */
  function canUseAI(feature: 'AI_PROGRAMME_GENERATE' | 'AI_COACH_REVIEW' | 'AI_REVAMP'): boolean {
    if (!FEATURES.PAYWALL_ENABLED) return true
    if (isPremium) return true
    return FEATURES.FREE[feature] as boolean
  }

  function withinLimit(type: 'MAX_PROGRAMMES' | 'MAX_TEMPLATES', currentCount: number): boolean {
    if (!FEATURES.PAYWALL_ENABLED) return true
    if (isPremium) return true
    return currentCount < FEATURES.FREE[type]
  }

  return { isPremium, loading, canUseAI, withinLimit }
}
