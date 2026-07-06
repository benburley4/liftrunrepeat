# CLAUDE.md

@AGENTS.md

## Project

TheHybridLife (branded LIFTRUNREPEAT) — hybrid strength + running tracker.
Next.js 16 App Router, React 19, Tailwind 4, Supabase, DeepSeek AI, Vercel.
See README.md for setup/env vars and PROGRESS.md for recent work.

## Key conventions

- **Styling**: dark theme via inline styles (bg `#0D0D0D`, cards `#141414`,
  borders `#2E2E2E`, teal `#00BFA5`, red `#C8102E`, purple `#A78BFA`), fonts
  Montserrat (headings) / Inter (body) / JetBrains Mono (numbers). Match this
  on new pages — there is no shared component library for forms.
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
