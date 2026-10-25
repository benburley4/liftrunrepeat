# TheHybridLife — Zepp Data Integration & Insights Plan

Written: 2026-10-25. Status: **planned** (Phase 0 done). Companion to
[IMPROVEMENT_PLAN.md](IMPROVEMENT_PLAN.md); supersedes its B5 ("heart rate —
skipped by request"): HR/recovery data is now wanted.

## Where we are (Phase 0 — done 2026-10-25)

- **Source:** ZeppBridge desktop app (Amazfit Balance 2) keeps
  `%LOCALAPPDATA%\ZeppBridge\data\zepp.db` synced from the Zepp cloud
  (official Open API, OAuth via zeppbridge.com). A 10-year history backfill
  is running; real data starts ~Dec 2025.
- **Sync:** `scripts/zepp-sync.mjs` → Supabase `sessions` (service role, user
  `HEALTH_IMPORT_USER_ID`). Logic in `src/lib/zeppImport.ts` (tested).
  Task `TheHybridLife_ZeppSync` every 2 h (S4U), 14-day window, log
  `logs/zepp-sync.log`; covered by `AI_Task_Monitor`.
- **Rules:** watch workouts enrich same-day manual sessions (hikes: km/elev
  replaced when within 25%, originals kept in `manualOriginal`; lifting days:
  HR/duration/calories only, sets untouched); everything else becomes a new
  session (`source: 'zepp'`); auto-detected `activity` blocks skipped.
- **Not yet used:** every daily metric below — only workouts reach the site.

### Data available in zepp.db (Apr–Oct 2026, growing with backfill)

| Group | Metrics | Notes |
|---|---|---|
| Readiness (Zepp-computed) | `readiness`, `hrv_readiness`, `rhr_readiness`, `skin_temp_readiness`, `physical_readiness`, `mental_readiness` | daily scores 0–100, from May |
| Recovery inputs | `sleep_hrv` + `hrv_baseline` (ms), `sleep_rhr` + `rhr_baseline`, `device_resting_hr` | HRV avg 37 ms; RHR 62→55 Jul→Oct |
| Sleep | sessions: score, duration, deep/light/REM/awake, wake count, stages | ~2 rows per night (main + nap/dup) — needs dedupe |
| Load & activity | `training_load` (daily), PAI (+ zone minutes), steps, active minutes, calories | |
| Stress / night | `stress` (+ % relaxed/normal/high), `spo2_*`, `respiratory_rate`, `ahi_*` | from Jun |
| Body | weight, BMI (smart scale) | 358 readings, 94–101 kg |
| Workouts | walks, treadmill, run, **strength (78)** with HR, HR zones, splits, GPS, per-second samples | |

---

## Phase 1 — Data layer (prerequisite for everything else)

### 1.1 `zepp_daily` table
One row per user per local date, wide columns (easy to chart, cheap to read):
`readiness, hrv_readiness, rhr_readiness, physical_readiness, mental_readiness,
sleep_hrv_ms, hrv_baseline_ms, sleep_rhr, rhr_baseline, resting_hr,
sleep_min, sleep_score, deep_min, light_min, rem_min, awake_min, wake_count,
nap_min, training_load, pai_daily, pai_total, steps, active_min,
stress_avg, spo2_score, resp_rate, weight_kg`, plus `updated_at`.
PK `(user_id, date)`. RLS: select own rows only; writes via service role.
Add to `supabase/schema.sql`; **run in the Supabase SQL editor before deploy.**

### 1.2 Extend the sync
- Pure builder `buildZeppDaily(metrics, sleepSessions)` in
  `src/lib/zeppDaily.ts` (tested): pivots `daily_metrics`, picks the main
  sleep per wake date (longest, non-nap), sums naps separately.
- `zepp-sync.mjs` upserts the last 14 days of `zepp_daily` alongside sessions.

### 1.3 Unmatched watch strength sessions
78 strength workouts; most will match a logged lifting day. Ones that don't
become a lift session with `exercises: []` and `zepp` stats, flagged
`needsSets: true` — surfaced in the UI as "Lifting session recorded on your
watch — add your sets" (one tap opens the logger pre-dated). Keep them out
of volume/tonnage stats until sets exist.

### 1.4 History import
When the ZeppBridge backfill completes: `zepp-sync.mjs --all --dry-run`,
review matches, then `--all` (sessions + daily). Backup first
(`scripts/backup-db.mjs`).

### 1.5 Weight → bodyweight setting
Latest scale weight (7-day median) written to the bodyweight setting
`bodyweight.ts` already reads, so bodyweight-exercise loads and
strength-to-weight use real weight. Only overwrite when the scale reading is
newer than the last manual entry.

### 1.6 Data hygiene (one-off)
- 2026-05-13 "Run" — 643 min / avg HR 74: forgotten stop; delete or fix.
- 2026-08-26: manual 15 km kept + separate 4 km "Walk" → possible
  double-count; merge.
- Session list noise: ~230 short watch walks. Add a "hide watch walks
  < 2 km" toggle (default on) on lists; stats still count them.

---

## Phase 2 — Insights › Recovery page (`/recovery`)

New entry in the Navbar "Insights" group (Progress · **Recovery** · Library ·
Tools). Built as small components under `src/components/recovery/` (don't
grow `progress/page.tsx`, already 2,300 lines); calculations in
`src/lib/recovery.ts` with tests. Uses `Card`, `StatTile`, `SectionHeading`,
Recharts, house palette (teal = good, red = strain, purple = sleep).

| # | Section | What it shows | Why it matters for hybrid training |
|---|---|---|---|
| 2.1 | **Today** | Zepp readiness (big number + 7-day sparkline) and its drivers: HRV vs baseline, RHR vs baseline, sleep, skin temp. One-line call: *Go hard / Train as planned / Keep it easy / Rest*. | Decide lift-heavy vs easy-hike day at a glance. |
| 2.2 | **Today vs plan** | If the current programme has a session today, pair it with readiness: e.g. heavy lower-body day + readiness < 50 → "swap for Zone 2 hike / move to tomorrow". | Turns data into an action, not just a chart. |
| 2.3 | **Recovery trends** (30/90/180 d) | HRV & RHR with baseline bands; sleep duration + stages (stacked bars); stress. | RHR ↓ / HRV ↑ = engine improving; sustained opposite = overreaching. |
| 2.4 | **Load vs recovery** | Weekly bars: Zepp training load + lifting tonnage + hike km, overlaid with avg readiness. Flags weeks where load ↑ while readiness ↓ for 2+ weeks. | Early overtraining warning; validates deload timing. |
| 2.5 | **Session effort** | Per-session avg/max HR, duration, calories; lifting density (tonnage ÷ minutes); HR-zone split for hikes. | Shows how hard sessions actually were vs. how they felt (RPE). |
| 2.6 | **Cardio efficiency** | Hikes: avg HR vs grade-adjusted pace (Naismith, same as `computeStats`) over time; monthly RHR. | Clearest evidence the aerobic base is growing. |
| 2.7 | **Body** | Weight trend (7-day avg) + strength-to-weight for main lifts. | Context for strength progress. |

Empty states: page works for users without a watch (explains how to connect;
shows nothing fake — per IMPROVEMENT_PLAN B6).

---

## Phase 3 — Use the data across the existing site

| # | Where | Change |
|---|---|---|
| 3.1 | **Weekly AI coach** (`api/cron/weekly-coach`) | Add a RECOVERY block to the prompt: 7-day avg readiness/HRV/RHR/sleep vs 28-day, load trend, flagged weeks. Coach can then prescribe deloads from evidence. Biggest leverage, small change. |
| 3.2 | **Today / log session** | Readiness banner at the top; when a watch workout exists today, offer "use watch time & HR" (start, duration) when saving. |
| 3.3 | **Progress** | Session cards get an HR/duration chip and a watch badge; tonnage-per-minute alongside tonnage. |
| 3.4 | **Running** | Hiking/walking panel: weekly km, elevation, time-in-zone (PAI zones), longest effort — replaces generic articles as the page's lead content. |
| 3.5 | **AI programme generator / revamp** | Pass recent readiness + load so generated weeks start from actual recovery, not assumptions. |
| 3.6 | **Privacy page** | Mention health data from Zepp (HR, HRV, sleep, SpO₂) — sensitive category; say where it's stored and how to delete. |

---

## Phase 4 — Later

- **Cloud sync (Option B):** if Zepp grants Open Platform credentials
  (request sent to developer@zepp.com), move the sync server-side
  (Vercel cron + OAuth "Connect Zepp" button). `zeppImport.ts` /
  `zeppDaily.ts` are reused unchanged; the PC + ZeppBridge dependency goes away.
- Watch app (Zepp OS mini-program) as a fallback source for daily metrics.
- Route maps for hikes (GPS is in zepp.db; 418k points — store simplified
  polylines only).

---

## Order of work & effort

| Step | Content | Effort | Blocker |
|---|---|---|---|
| 1 | Phase 1.1–1.2, 1.5 (table, daily sync, weight) | ~½ day | you run the SQL migration |
| 2 | Phase 2.1, 2.3 (Today + trends) — first visible value | ~1 day | step 1 |
| 3 | Phase 3.1 (coach recovery block) | ~2 h | step 1 |
| 4 | Phase 1.3, 1.6, 2.4–2.7 | ~1–1½ days | — |
| 5 | Phase 1.4 history import | ~1 h | backfill finished |
| 6 | Phase 3.2–3.6 | ~1 day | — |

## Before any deploy

- The working tree has a large set of **uncommitted changes** (UI overhaul,
  progress, programmes…). Commit/finish those first so the Zepp work deploys
  on a clean base — a Vercel deploy ships the whole working tree.
- Run `npm test`, `npm run build`; migration SQL before code that reads
  `zepp_daily`.

## Decisions needed

1. Readiness thresholds for the daily call (default proposal: ≥75 go hard,
   55–74 as planned, 40–54 easy, < 40 rest — tune after 4 weeks).
2. Unmatched watch strength sessions: create with "add sets" prompt (1.3,
   recommended) or ignore.
3. Weight from the scale overrides manual bodyweight (1.5) — yes/no.
4. Hide short watch walks in session lists by default (1.6) — threshold.
