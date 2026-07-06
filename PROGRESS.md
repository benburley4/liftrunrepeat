# Implementation Progress — IMPROVEMENT_PLAN.md

Log of the 2026-07-06/07 implementation session (Claude Code). Statuses refer
to plan items in [IMPROVEMENT_PLAN.md](IMPROVEMENT_PLAN.md).

## ⚠ REQUIRED BEFORE NEXT DEPLOY

Run the **MIGRATION** section in `supabase/schema.sql` in the Supabase SQL
editor first — the app now upserts sessions with `onConflict: 'user_id,saved_at'`,
which needs the `(user_id, saved_at)` primary key. Deploying without the
migration will break session saves. Also review/apply the RLS policy block.

## Done — technical (Priority 1–4)

- **1.1 AI route auth** — all AI routes (`generate-programme`, `revamp-programme`,
  `programme-review`) now require a Supabase bearer token, verified server-side
  via `src/lib/server/requireUser.ts`. Client sends it through `authHeaders()`
  in `src/lib/auth.ts`. The unused `analytics-coach` route was dead code and
  was deleted outright.
- **1.2 Cron fails closed** — `weekly-coach` returns 500 if `CRON_SECRET` or
  `DEEPSEEK_API_KEY` is unset, 401 on bad token.
- **1.3 Server-side AI usage** — `checkAndRecordAIUse()` enforces free/premium
  limits server-side (reads+increments `ai_usage` via service role) when
  `PAYWALL_ENABLED` flips on. `usePremium.recordAIUse()` now only refreshes the
  local display. *Remaining before charging money:* move `is_premium` to a
  service-role-only `profiles` table (SQL stub at the bottom of schema.sql).
- **1.4 User-scoped session keys** — `db.ts` and health-import upsert on
  `user_id,saved_at`. **Needs the DB migration above.**
- **1.5 Schema in repo** — `supabase/schema.sql` documents all 7 tables + RLS
  policies (including update-via-upsert protection).
- **2.1 AI JSON validation** — generate/revamp use DeepSeek JSON mode
  (`response_format: json_object`); client validates with
  `validateAIProgramme()` (`src/lib/programmeSchema.ts`) before expanding.
- **2.2 Env fail-fast** — `supabase.ts` throws in production when env vars are
  missing instead of silently using a placeholder host.
- **2.5 Import segment ids** — `crypto.randomUUID()` instead of `Date.now()`.
- **3.2 Rename** — `mockData.ts` → `exerciseLibrary.ts` (10 imports updated);
  fake `analyticsData`/`recentSessions` deleted.
- **3.3 Dead weight removed** — `zustand` dep, `postcss.config.mjs.bak`,
  duplicate `src/Programme Review Prompt.txt`, unused `seedHistory.ts`,
  unused `InterferenceTrendChart.tsx`, stray bodyweight backup JSON.
- **3.4 One DeepSeek helper** — `src/lib/server/deepseek.ts` (stream +
  non-stream); all routes use it.
- **3.5 / 4.x Docs & tooling** — README rewritten, CLAUDE.md filled in,
  `lint` script fixed (`eslint src`), vitest added with 29 passing tests
  covering `computeStats` and health-import parsing.

## Done — content & service (Part B)

- **B1 Athlete profile** — new `/profile` page (linked from the avatar menu +
  mobile nav). Stored in `user_settings.athlete_profile`; injected into
  programme generation, review, revamp, and the weekly cron via
  `profileToPrompt()`.
- **B2 Coach continuity** — weekly cron feeds the previous report's KEY
  RECOMMENDATIONS back to the model and instructs it to follow up.
- **B3 Startable built-ins** — all six programme cards now have full
  periodised plans (`src/lib/builtinProgrammes.ts`) expanded with the same
  progression/deload logic as AI output. "Start This Programme" on the
  dashboard modal saves it and makes it current (signed-in users).
- **B4 Review auto-feed** — already existed (review page reads saved
  programmes); no change needed. `AI/Programme Review Prompt.txt` kept as the
  only copy of the legacy manual prompt.
- **B6 Fake analytics removed** — mock chart + mock data deleted (see 3.2/3.3).
- **B7 Library depth** — `substitutions` + `mistakes` fields added and
  populated for the 8 core movements; rendered in the Library page under the
  cues. (Video links skipped by request.)
- **B8 Onboarding** — new `/get-started` page (navbar link): 4-question quiz →
  recommended programme with one-tap start, plus a 9-term training glossary.
- **B10 Cycle/swim types** — health import maps cycling/swimming to distinct
  `cycle`/`swim` types with `distanceKm` on its own field, so running km/pace
  stats stay honest.

## Skipped (not possible without external resources / by request)

- **B5 heart-rate persistence** — skipped per instruction (no HR data use).
- **B7 video/demo media** — skipped per instruction.
- **B9 report delivery by email/Telegram** — needs an email provider account.
- **2.4 per-user import tokens** — single-user env-var approach kept;
  multi-user token table sketched conceptually in the plan.
- **4.x Sentry / CI** — need external accounts / GitHub remote.
- **3.1 splitting giant pages** — deliberately deferred (opportunistic work).

## Verification

- `npm test` — 29/29 pass.
- `npm run build` — passes (all routes compile, /profile + /get-started added).
- `npm run lint` — all new/modified files are clean. 28 pre-existing errors
  remain in the old large pages (mostly `react-hooks/set-state-in-effect` and
  unused vars) — fix opportunistically alongside 3.1 page splitting.

## Env vars now referenced

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `DEEPSEEK_API_KEY`, `CRON_SECRET` (now required
for the cron), `HEALTH_IMPORT_SECRET`, `HEALTH_IMPORT_USER_ID`.
