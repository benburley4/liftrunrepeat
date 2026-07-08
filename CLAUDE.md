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
