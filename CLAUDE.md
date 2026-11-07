# CLAUDE.md

@AGENTS.md

## Project

TheHybridLife (branded LIFTRUNREPEAT) — hybrid strength + running tracker.
Next.js 16 App Router, React 19, Tailwind 4, Supabase, DeepSeek AI, Vercel.
See README.md for setup/env vars and PROGRESS.md for recent work.

## Key conventions

- **Styling**: dark theme (bg `#0D0D0D`, cards `#141414`/`#1E1E1E`, borders
  `#2E2E2E`, teal `#00BFA5`, red `#C8102E`, purple `#A78BFA`). Translucent
  accent tints must use the rgb of these hexes (`0,191,165` / `200,16,46`) —
  never the retired `0,229,200` / `255,107,53` palette.
- **Activity colours** (Progress and anywhere sessions are colour-coded): lift
  teal `#00BFA5`, run red `#C8102E`, hybrid purple `#A78BFA`, hike lime
  `#84CC16`, walk blue `#3A86C8` — `ACTIVITY_COLORS` in
  `src/components/progress/progressStyle.ts`. This matches the logo (teal
  barbell, red stride); `Brand Identity/Branding.txt` has the old reversed
  idea — ignore it.
- **Progress page** (`/progress`) is public: signed-out visitors get the
  seeded demo athlete from `src/lib/demoData.ts`. Page logic lives in
  `src/lib/progressData.ts` / `progressRange.ts`; each tab is a component in
  `src/components/progress/`.
- **Fonts** load via `next/font` in `layout.tsx`. In inline styles always use
  `fontFamily: 'var(--font-heading)'` (Montserrat) / `'var(--font-sans)'`
  (Inter) / `'var(--font-mono)'` (JetBrains Mono) — raw family names like
  `'Montserrat, sans-serif'` no longer resolve.
- **UI primitives** in `src/components/ui/`: `Card`, `Button`, `Modal`
  (Escape/focus-trap/aria built in), `SectionHeading` (fluid clamp sizing),
  `StatTile`. Use these instead of hand-rolling the patterns; adopt them
  opportunistically when touching older pages. No shared form components yet.
- **Contrast**: `#606060` (`--color-text-muted`) is for decorative labels
  only; small descriptive copy uses `var(--color-text-subtle)` (`#8A8A8A`)
  to pass WCAG AA.
- **DB access**: all client queries go through `src/lib/db.ts` and rely on
  Supabase RLS (no user_id filters client-side). Schema + policies:
  `supabase/schema.sql` — keep it updated when tables change; migrations
  there must run before dependent code deploys.
- **Sessions are keyed on `(user_id, saved_at)`** — never upsert on
  `saved_at` alone.
- **AI routes** (`src/app/api/*`): must call `requireUser()` and
  `checkAndRecordAIUse()` from `src/lib/server/requireUser.ts`, and use
  `src/lib/server/deepseek.ts` (never instantiate DeepSeek clients ad hoc).
  Client callers send `authHeaders()` from `src/lib/auth.ts` and attach the
  athlete profile via `profileToPrompt(await loadProfile())`.
- **Weight & Renpho**: `/nutrition` is the "Weight & Nutrition" nav item, with
  Nutrition, Weight & Body and Plan tabs (`src/components/body/`). The Plan tab's
  logic is `src/lib/weightPlan.ts`, stored in `user_settings.weight_plan`; an active
  plan also drives the Nutrition tab's daily and weekly budget (`PlanBudget`). Renpho is the main
  weight source. `scripts/renpho-sync.mjs` (run by `zepp-sync.bat` and the
  every-minute poll for the "Sync Renpho" button) writes `renpho_body`,
  `zepp_daily.weight_kg` / `weight_am_kg` and `user_settings.bodyweight_kg`;
  `zepp-sync.mjs` leaves those alone while `RENPHO_EMAIL` is set. The Renpho API
  is unofficial (`scripts/renpho-client.mjs`, port of renpho-py) and the password
  stays in `.env.local` on the PC, never in Vercel. The account also holds another
  person's profile: only the signed-in profile may be fetched or stored.
- **Nutrition** (`/nutrition`): the one AI route not on DeepSeek —
  `api/meal-estimate` uses `src/lib/server/mealEstimate.ts` (OpenRouter vision,
  `OPENROUTER_API_KEY`, model `MEAL_MODEL` default `google/gemini-3.8-flash`)
  because DeepSeek has no image input. Meals are stored in `user_settings` as
  one row per day (`meals:YYYY-MM-DD`, JSON `Meal[]`) plus `meal_favourites` —
  no table/migration. Logic + energy balance (Mifflin BMR + Zepp
  `active_calories`, steps fallback) in `src/lib/nutrition.ts`.
- **Programme JSON** from the AI is validated with `validateAIProgramme()`
  (`src/lib/programmeSchema.ts`) before expansion.
- **`src/lib/exerciseLibrary.ts`** is the real built-in exercise/programme/
  template library (formerly misnamed mockData.ts) — it is user-facing content.
- **Route files** (`route.ts`) must only export HTTP handlers/config — put
  testable logic in `src/lib/` (see `healthImport.ts`).
- **Tests**: vitest, colocated in `src/lib/__tests__/`. Run `npm test`.
  Pure logic (stats, parsers) should be covered.

## Watch out

- Several pages are very large (analytics ~2000 lines). When touching them,
  extract components opportunistically rather than growing them.
- PowerShell 5.1 `Get-Content`/`Set-Content` corrupts this repo's UTF-8 files
  (mojibake on °, —). Use the Edit tool, git, or explicit UTF-8 encoding.
- Paywall (`src/lib/features.ts`) is OFF. Before enabling: move `is_premium`
  to a service-role-only table (stub in schema.sql).
