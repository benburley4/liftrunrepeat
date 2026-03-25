/**
 * ─── Premium Feature Flags ────────────────────────────────────────────────────
 *
 * MASTER TOGGLE:  Set PAYWALL_ENABLED = true when ready to go live with premium.
 *                 While false, every user has full access with no limits.
 *
 * FREE TIER (enforced when PAYWALL_ENABLED = true):
 *   - Log sessions & view analytics: unlimited
 *   - 2 saved programmes
 *   - 6 custom templates
 *   - 4 AI uses LIFETIME (shared across all AI features)
 *
 * PREMIUM TIER:
 *   - Unlimited programmes & templates
 *   - 8 AI uses PER MONTH (resets on 1st of each month, shared across all AI features)
 *     → AI Programme Generator
 *     → AI Coach Review
 *     → AI Revamp Programme
 *
 * HOW TO MARK A USER AS PREMIUM:
 *   user_settings: { key: 'is_premium', value: 'true' }
 *   (set via Stripe webhook or manually in Supabase dashboard)
 *
 * AI USAGE TRACKING:
 *   user_settings: { key: 'ai_usage', value: JSON }
 *   Schema: { lifetimeCount: number, monthCount: number, monthResetDate: "YYYY-MM" }
 */

export const FEATURES = {
  /** Flip to true to enforce free-tier limits and AI usage caps. */
  PAYWALL_ENABLED: false,

  FREE: {
    MAX_PROGRAMMES:    2,
    MAX_TEMPLATES:     6,
    AI_USES_LIFETIME:  4,   // total across all AI features, never resets
  },

  PREMIUM: {
    AI_USES_PER_MONTH: 8,   // resets on the 1st of each month
  },

  PREMIUM_LABEL: 'Premium',
  UPGRADE_CTA:   'Upgrade to Premium for unlimited programmes, templates and 8 AI uses per month.',
} as const
