# TheHybridLife — Improvement Plan

Review date: 2026-07-06 (Claude Code review of full codebase).
Status: **largely implemented 2026-07-06/07 — see [PROGRESS.md](PROGRESS.md) for
item-by-item status.** Still open: B5 (heart rate — skipped by request),
B9 (email delivery — needs provider), B7 video media (skipped by request),
2.4 (multi-user import tokens), 3.1 (page splitting — opportunistic),
Sentry/CI, and the `profiles` table before enabling the paywall.
⚠ The Supabase migration in `supabase/schema.sql` must run before next deploy.

App: Next.js 16 / React 19 / Tailwind 4 / Supabase / DeepSeek, deployed on Vercel.
Hybrid training tracker: session logging, programme builder, AI programme generation,
AI coach reviews (weekly cron), Apple Health import, analytics.

---

## Priority 1 — Security (do these first)

### 1.1 AI API routes are unauthenticated
`/api/generate-programme`, `/api/analytics-coach`, `/api/programme-review`, and
`/api/revamp-programme` accept any POST from anyone. Each call spends DeepSeek
credits (up to 8k tokens). Anyone who discovers the deployed URL can drain the
API budget.

**Fix:** require a Supabase session on every AI route. Client sends
`Authorization: Bearer <supabase access token>`; route validates it with
`supabaseAdmin.auth.getUser(token)` before calling DeepSeek. Extract a shared
`requireUser(req)` helper in `src/lib/` used by all four routes.

### 1.2 Cron endpoint auth silently disabled when CRON_SECRET is unset
[route.ts:102](src/app/api/cron/weekly-coach/route.ts#L102) —
`if (CRON_SECRET && auth !== ...)` means an unset env var leaves the endpoint
wide open. It uses the service-role key and calls DeepSeek once per user.

**Fix:** fail closed — return 401 (or 500 "not configured") when `CRON_SECRET`
is empty. Same pattern is already correct in health-import; mirror it.

### 1.3 Paywall is client-side only and self-serve bypassable
`usePremium` reads `is_premium` and `ai_usage` from `user_settings`, a table the
user's own client can write (that's how `recordAIUse` works). When
`PAYWALL_ENABLED` flips on, any user can set `is_premium=true` themselves or
just POST to the AI routes directly, skipping the counter entirely.

**Fix (before enabling paywall):**
- Move AI-usage counting server-side: the AI route itself (after auth from 1.1)
  reads/increments usage via `supabaseAdmin` and rejects over-limit calls.
- Store `is_premium` somewhere the client can't write — e.g. a `profiles` table
  with RLS `select`-only for users, written only by service role (Stripe
  webhook / manual admin).

### 1.4 Sessions keyed on globally-unique `saved_at`
`upsert(..., { onConflict: 'saved_at' })` in [db.ts](src/lib/db.ts) and
[health-import](src/app/api/health-import/route.ts#L181) assumes `saved_at` is
unique across ALL users. Two users logging at the same timestamp collide — the
second write either errors or (if RLS permits nothing) fails silently; with the
service-role path in health-import it would **overwrite another user's row**.

**Fix:** change the DB constraint to `unique(user_id, saved_at)` and use
`onConflict: 'user_id,saved_at'` everywhere (db.ts upserts + health-import).
Same review for `templates`/`programmes`/`custom_exercises` `id` keys — client
generates the id, so a malicious client could upsert onto someone else's id
unless RLS blocks it. Verify RLS policies cover **update via upsert** on every
table, and add the SQL to a checked-in `supabase/schema.sql` so the schema
stops living only in code comments.

### 1.5 Verify RLS on every table
db.ts never filters selects/deletes by `user_id` — correctness depends 100% on
RLS being right. There's no schema file in the repo to confirm. **Fix:** export
current policies from Supabase into `supabase/schema.sql`, review, and commit.

---

## Priority 2 — Robustness & correctness

### 2.1 AI JSON output isn't validated
`generate-programme` / `revamp-programme` stream raw model text and trust it to
be schema-valid JSON. **Fix:** use DeepSeek's JSON mode
(`response_format: { type: 'json_object' }`), then validate server- or
client-side with a zod schema before saving; on failure, retry once or show a
useful error instead of a broken programme.

### 2.2 Silent placeholder Supabase client
[supabase.ts](src/lib/supabase.ts) falls back to `placeholder.supabase.co`,
turning a misconfigured env into confusing runtime failures. **Fix:** throw at
startup (or render a clear error) when the env vars are missing in production.

### 2.3 `getSetting` returns the first match without user scoping
Relies on RLS; also `usage` writes race (`recordAIUse` read-modify-write from
client state). Acceptable now, but must move server-side with 1.3.

### 2.4 Health import is single-user by env var
`HEALTH_IMPORT_USER_ID` hardcodes one account. Fine for personal use; if the
app gets real users, switch to per-user import tokens (a `import_tokens` table:
token → user_id) so the same endpoint serves everyone.

### 2.5 `buildRunSegment` id collision
`import-${Date.now()}` produces identical ids for workouts imported in the same
millisecond batch. Use `crypto.randomUUID()`.

---

## Priority 3 — Code health

### 3.1 Break up the giant page components
| File | Lines |
|---|---|
| `src/app/analytics/page.tsx` | 1,965 |
| `src/app/programmes/page.tsx` | 1,280 |
| `src/app/templates/page.tsx` | 1,126 |
| `src/app/log/session/page.tsx` | 1,041 |
| `src/app/page.tsx` | 888 |
| `src/app/programme-review/page.tsx` | 837 |

Extract chart panels, modals, and data-derivation hooks into
`src/components/…` and `src/hooks/…`. Do it opportunistically (when touching a
page), not as a big-bang rewrite.

### 3.2 Rename `mockData.ts`
It's not mock data — it's the real built-in exercise library imported by 10+
files. Rename to `exerciseLibrary.ts` (and move genuinely-mock parts, e.g.
`analyticsData` used by `InterferenceTrendChart`, into a separate file or
delete if the chart should use real data — check that chart is not shipping
fake numbers to users).

### 3.3 Remove dead weight
- `zustand` in package.json — appears unused; remove.
- `postcss.config.mjs.bak`, `tsconfig.tsbuildinfo` in repo root — delete /
  gitignore (`*.tsbuildinfo` is already ignored; the file predates the rule).
- `scripts/backup-bodyweight-*.json` — move out of repo or gitignore.
- Duplicate `Programme Review Prompt.txt` in both `src/` and `AI/` — keep one.
- `seedHistory.ts` / dev-seeding code — ensure it can't run in production.

### 3.4 Consolidate the four AI routes
generate/revamp/review/analytics-coach each hand-roll the DeepSeek call
(two via `openai` SDK, two via raw `fetch`). Extract one
`src/lib/deepseek.ts` helper (client, streaming wrapper, error handling) so
model/params change in one place.

### 3.5 Documentation
- README is still the create-next-app boilerplate — replace with: what the app
  is, env vars required (there are 6+: Supabase ×3, DEEPSEEK_API_KEY,
  CRON_SECRET, HEALTH_IMPORT_SECRET, HEALTH_IMPORT_USER_ID), Supabase schema
  setup, cron behaviour, Health Auto Export setup.
- CLAUDE.md just includes AGENTS.md which is a Next.js stub — add real project
  guidance (structure, conventions, where the schema lives).

---

## Priority 4 — Quality & tooling

- **Tests:** none exist. Highest-value first targets: `computeStats.ts` (272
  lines of pure logic feeding the AI coach), `bodyweight.ts`, health-import
  payload parsing (`parseKm`, `parseElevationM`, `workoutToSession`). Add
  vitest + a `test` script.
- **Lint script:** `"lint": "eslint"` runs with no target — make it
  `eslint src` (or `next lint` equivalent) and fix findings.
- **CI:** the repo is git-tracked; add a minimal GitHub Action (typecheck +
  lint + test) if/when pushed to GitHub.
- **Error monitoring:** no visibility into production errors — add Sentry (or
  at minimum Vercel log drains) before opening to other users.
- **Rate limiting:** add per-user rate limits on AI routes (e.g. Upstash
  Ratelimit or a simple Supabase counter) — complements 1.1/1.3.

---

## Part B — Content & Service improvements (product side)

Reviewed 2026-07-06. Ordered by expected impact.

### B1. Athlete profile feeding all AI features
No AI feature knows the athlete: no age, bodyweight, 1RMs, race target/date,
injury history, or training age. Add a one-time profile (stored in
`user_settings` or a `profiles` table) and inject it into the generator,
weekly coach, revamp, and review prompts. Race date enables countdown-aware
coaching and taper advice.

### B2. Weekly coach continuity
Feed the previous week's report (its KEY RECOMMENDATIONS section) into the
next report's prompt so the coach follows up on its own advice. Data already
exists in `coach_reports`.

### B3. Make the 6 built-in programmes startable
`mockData.ts` programmes are cards + 1-week preview only. Author them as full
periodised plans (phases, progression, deloads — same schema the AI generator
outputs) with a one-tap "Start this programme".

### B4. Auto-feed programme review
Review flow expects manual paste (`Programme Review Prompt.txt`), but the
programme is already in Supabase. Let the user pick a saved programme and
serialise it into the prompt automatically.

### B5. Persist heart rate + use it
Health import parses `heartRateData` (Avg/Max) then discards it. Save it on
the session; use for readiness scoring and Zone-2 discipline feedback
("easy runs drifting into Zone 3").

### B6. Remove fake analytics
`InterferenceTrendChart` renders hardcoded `analyticsData` from mockData.ts —
invented numbers shown as if real. Wire to real sessions or remove.
(`recentSessions` mock likewise — verify nothing user-facing renders it.)

### B7. Exercise library depth
Add per exercise: substitutions (equipment-based), progression/regression
chains, demo image/video link, common mistakes. Also improves AI generator
output quality since it selects from this library.

### B8. Beginner onboarding
Short quiz (goal, experience, days/week, equipment) → recommended programme
+ glossary for RPE / Zone 2 / tempo / deload. Routes new users to
"Couch to Hybrid" instead of a blank dashboard.

### B9. Deliver the weekly report
Sunday cron stores the report but nothing notifies the user. Send email
(or Telegram) with the summary + link. Retention hook.

### B10. Proper cycle/swim session types
Health import maps cycling and swimming to `run`, polluting running
analytics (km, pace, VDOT). Add distinct types, even minimally.

### Smaller ideas
- PR celebrations + logging streaks (data already tracked).
- Personalised pace zones from a recent race result (VDOT) on the tools page.
- Auto-taper/deload suggestion as race date approaches (needs B1).
- Shareable session/PR cards.

---

## Suggested build order

1. **1.1 + 1.2** — auth on AI routes, fail-closed cron (small, urgent).
2. **1.4 + 1.5** — composite unique keys + commit `supabase/schema.sql`.
3. **2.1 + 3.4** — shared DeepSeek helper with JSON mode + zod validation.
4. **1.3 + 2.3** — server-side premium/usage enforcement (prereq for paywall).
5. **3.2 + 3.3 + 3.5** — rename/cleanup/docs sweep (one tidy session).
6. **4.x** — tests for computeStats + health-import, lint fix, monitoring.
7. **3.1** — component extraction, ongoing.
