# TheHybridLife (LIFTRUNREPEAT)

Hybrid strength + endurance training tracker. Log lifts, runs and hikes; build
periodised programmes (by hand, from built-in plans, or AI-generated); get a
weekly AI coach report; import workouts automatically from Apple Health.

**Stack:** Next.js 16 (App Router) · React 19 · Tailwind 4 · Supabase (auth +
Postgres with RLS) · DeepSeek via the OpenAI SDK · Vercel (hosting + cron).

## Local development

```bash
npm install
npm run dev        # http://localhost:3000  (or run start-dev.bat)
npm test           # vitest unit tests
npm run lint       # eslint over src/
npm run build      # production build
```

## Environment variables (`.env.local` / Vercel project settings)

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — server routes only |
| `DEEPSEEK_API_KEY` | DeepSeek API key for all AI features |
| `CRON_SECRET` | Required. Bearer secret for the weekly coach cron |
| `HEALTH_IMPORT_SECRET` | Static API key for the Apple Health import endpoint |
| `HEALTH_IMPORT_USER_ID` | Supabase user id the imports are stored against |

## Database

Schema + RLS policies live in [`supabase/schema.sql`](supabase/schema.sql) —
run it in the Supabase SQL editor. **Migrations marked in that file must run
before deploying code that depends on them** (currently: the
`(user_id, saved_at)` sessions key).

## AI features

All AI routes require a signed-in user (Supabase bearer token) and share one
DeepSeek helper (`src/lib/server/deepseek.ts`):

- `POST /api/generate-programme` — full periodised programme as JSON (JSON mode
  + schema validation client-side).
- `POST /api/programme-review` — scorecard-style coaching review of a saved
  programme.
- `POST /api/revamp-programme` — rebuilds a programme applying the review's
  recommendations.
- `GET /api/cron/weekly-coach` — Sunday 23:50 UTC Vercel cron; writes a weekly
  report per user, follows up on last week's recommendations.

Every AI prompt is enriched with the user's **athlete profile** (`/profile`):
age, bodyweight, 1RMs, goal race + date, injuries.

## Apple Health import

`POST /api/health-import` accepts Health Auto Export (iOS) payloads.
Setup in the app: REST API export, header `x-api-key: <HEALTH_IMPORT_SECRET>`,
data type Workouts, format JSON. Parsing logic is unit-tested in
`src/lib/healthImport.ts`.

## Project map

```
src/app/               pages (dashboard, programmes, templates, analytics, …)
src/app/get-started/   onboarding quiz + training glossary
src/app/profile/       athlete profile (feeds all AI prompts)
src/app/api/           AI routes, cron, health import
src/components/        UI components
src/lib/               db access, stats, exercise library, built-in plans
src/lib/server/        server-only helpers (auth, DeepSeek)
supabase/schema.sql    DB schema + RLS (source of truth)
IMPROVEMENT_PLAN.md    roadmap; PROGRESS.md — what's been done
```
