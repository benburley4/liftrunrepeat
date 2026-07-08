-- TheHybridLife — Supabase schema & RLS policies
-- ================================================
-- This file is the source of truth for the DB schema. Run sections in the
-- Supabase SQL editor. Sections marked MIGRATION must be run BEFORE deploying
-- the app version that references them (2026-07-06 changes).

-- ─── sessions ────────────────────────────────────────────────────────────────
create table if not exists sessions (
  saved_at   text not null,
  user_id    uuid references auth.users,
  data       jsonb not null,
  primary key (saved_at)
);

-- MIGRATION (2026-07-06, REQUIRED before deploy):
-- saved_at was globally unique — two users logging at the same timestamp
-- collide, and the health-import service-role path could overwrite another
-- user's row. Re-key on (user_id, saved_at).
--
-- alter table sessions drop constraint sessions_pkey;
-- alter table sessions add primary key (user_id, saved_at);

-- ─── programmes / templates / custom_exercises / ai_reports ─────────────────
create table if not exists programmes (
  id         text primary key,
  user_id    uuid references auth.users,
  data       jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists templates (
  id         text primary key,
  user_id    uuid references auth.users,
  data       jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists custom_exercises (
  id         text primary key,
  user_id    uuid references auth.users,
  data       jsonb not null,
  created_at timestamptz default now()
);

create table if not exists ai_reports (
  id         text primary key,
  user_id    uuid references auth.users,
  data       jsonb not null,
  created_at timestamptz default now()
);

-- ─── user_settings ───────────────────────────────────────────────────────────
-- Key/value per user. Known keys: current_programme_id, gen_form_state,
-- ai_usage, is_premium, athlete_profile, onboarding_done.
create table if not exists user_settings (
  key     text not null,
  user_id uuid references auth.users not null,
  value   text,
  primary key (key, user_id)
);

-- ─── coach_reports (weekly AI coach cron) ────────────────────────────────────
create table if not exists coach_reports (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users not null,
  week_ending date not null,
  report_text text not null,
  stats       jsonb,
  created_at  timestamptz default now(),
  unique(user_id, week_ending)
);

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- Every table must scope rows to auth.uid(). The app's client queries do NOT
-- filter by user_id — they rely entirely on these policies.
-- IMPORTANT: upserts need BOTH insert and update policies; ids are client-
-- generated, so without the update check a user could upsert onto another
-- user's row id.

-- NOTE: this drops EVERY existing policy on these tables first. Postgres ORs
-- permissive policies together, so a single leftover "allow all" policy from
-- early development silently defeats the strict ones (found live on
-- `sessions` 2026-07-08 — anonymous clients could read every row).
-- Service-role access is unaffected (it bypasses RLS entirely).
do $$
declare t text; pol record;
begin
  foreach t in array array['sessions','programmes','templates','custom_exercises','ai_reports','user_settings','coach_reports']
  loop
    execute format('alter table %I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on %I', pol.policyname, t);
    end loop;
    execute format('create policy "own rows select" on %I for select using (auth.uid() = user_id)', t);
    execute format('create policy "own rows insert" on %I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "own rows update" on %I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "own rows delete" on %I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ─── TODO before enabling the paywall ────────────────────────────────────────
-- is_premium currently lives in user_settings, which users can write to
-- themselves. Before charging money, move it to a service-role-only table:
--
-- create table if not exists profiles (
--   user_id    uuid references auth.users primary key,
--   is_premium boolean default false,
--   updated_at timestamptz default now()
-- );
-- alter table profiles enable row level security;
-- create policy "read own profile" on profiles for select using (auth.uid() = user_id);
-- -- no insert/update/delete policies: only the service role can write
--
-- Then update lib/server/requireUser.ts to read profiles.is_premium.
