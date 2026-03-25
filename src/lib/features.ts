/**
 * ─── Premium Feature Flags ────────────────────────────────────────────────────
 *
 * MASTER TOGGLE:  Set PAYWALL_ENABLED = true when ready to go live with premium.
 *                 While false, every user has full access regardless of status.
 *
 * FREE TIER LIMITS (only enforced when PAYWALL_ENABLED = true):
 *   - 3 saved programmes
 *   - 5 custom templates
 *   - No AI features (generate programme, AI coach review, revamp)
 *
 * PREMIUM TIER:
 *   - Unlimited programmes & templates
 *   - AI Programme Generator
 *   - AI Coach Review
 *   - AI Revamp Programme
 *
 * TO MARK A USER AS PREMIUM:
 *   Insert a row in user_settings: { key: 'is_premium', value: 'true' }
 *   (Stripe webhook or manual toggle via Supabase dashboard)
 */

export const FEATURES = {
  /** Flip to true to enforce free-tier limits and show upgrade prompts. */
  PAYWALL_ENABLED: false,

  FREE: {
    MAX_PROGRAMMES: 3,
    MAX_TEMPLATES:  5,

    /** Individual AI feature flags — set false to block on free tier */
    AI_PROGRAMME_GENERATE: false,
    AI_COACH_REVIEW:       false,
    AI_REVAMP:             false,
  },

  PREMIUM_LABEL: 'Premium',    // shown in UI
  UPGRADE_CTA:   'Upgrade to Premium for unlimited programmes, templates and AI features.',
} as const
