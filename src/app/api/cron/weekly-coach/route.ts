/**
 * Weekly AI Coach report generator — runs every Sunday at 23:50 UTC via Vercel cron.
 *
 * Required Supabase table (run once in Supabase SQL editor):
 *
 *   create table coach_reports (
 *     id          uuid default gen_random_uuid() primary key,
 *     user_id     uuid references auth.users not null,
 *     week_ending date not null,
 *     report_text text not null,
 *     stats       jsonb,
 *     created_at  timestamptz default now(),
 *     unique(user_id, week_ending)
 *   );
 *   alter table coach_reports enable row level security;
 *   create policy "Users read own reports"   on coach_reports for select using (auth.uid() = user_id);
 *   create policy "Users insert own reports" on coach_reports for insert with check (auth.uid() = user_id);
 *   create policy "Users update own reports" on coach_reports for update using (auth.uid() = user_id);
 *   create policy "Service role full access" on coach_reports using (true);
 *
 * Required env vars (add to Vercel project settings):
 *   SUPABASE_SERVICE_ROLE_KEY   — from Supabase → Project Settings → API → service_role key
 *   CRON_SECRET                 — any random string; set the same value in Vercel cron headers
 *   DEEPSEEK_API_KEY            — already set
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { computeStats, SessionData } from '@/lib/computeStats'
import { COACH_SYSTEM_PROMPT } from '@/lib/coachPrompt'
import { completeChat, deepseekConfigured } from '@/lib/server/deepseek'
import { profileToPrompt, AthleteProfile } from '@/lib/athleteProfile'

const CRON_SECRET = process.env.CRON_SECRET ?? ''

// Most recent Sunday (or today if today is Sunday) — the week that just ended
function currentWeekEnding(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay() // 0 = Sunday
  d.setUTCDate(d.getUTCDate() - day) // go back to last Sunday
  return d.toISOString().split('T')[0]
}

async function generateReport(
  stats: ReturnType<typeof computeStats>,
  profileText: string,
  previousRecommendations: string,
): Promise<string> {
  const { overview, totalSessions, strengthSummary, runSummary, breakdown, balance } = stats

  const pplTotal = breakdown?.hasData ? (breakdown.pplSlices.reduce((s: number, sl: { value: number }) => s + sl.value, 0) || 1) : 1
  const bodyTotal = breakdown?.hasData ? (breakdown.bodySlices.reduce((s: number, sl: { value: number }) => s + sl.value, 0) || 1) : 1

  const factorStr = (overview.tsbFactors ?? []).map((f: { name: string; points: number }) => `${f.name} ${f.points > 0 ? '+' : ''}${f.points}`).join(', ')
  const lines = [
    `OVERVIEW:`,
    `- Sessions this week: ${overview.sessionsThisWeek}`,
    `- Km run this week: ${overview.kmThisWeek}`,
    `- Volume lifted this week: ${overview.volumeThisWeek} kg`,
    `- Total volume lifted (all time): ${overview.totalVolume} kg`,
    `- Readiness score: ${overview.tsb}% — ${overview.readinessLabel}${factorStr ? ` (factors: ${factorStr})` : ''}`,
    overview.overtrained ? `- ⚠ HIGH LOAD WARNING: volume >30% above last week — injury risk elevated` : '',
    `- Total sessions logged: ${totalSessions}`,
    ``,
    strengthSummary
      ? [`STRENGTH:`,
         `- Top exercises: ${strengthSummary.topExercises.join(', ')}`,
         `- Recent PRs: ${strengthSummary.prs.map(p => `${p.exercise}: ${p.rm} (${p.date})`).join('; ')}`].join('\n')
      : `STRENGTH: No strength sessions logged yet.`,
    ``,
    runSummary
      ? [`RUNNING:`,
         `- Weekly km: ${runSummary.weeklyKm.map(w => `${w.week}: ${w.km}km`).join(', ')}`,
         `- Run type mix: ${runSummary.runTypeMix.map(t => `${t.name} ${t.value}%`).join(', ')}`].join('\n')
      : `RUNNING: No run sessions logged yet.`,
    ``,
    breakdown?.hasData
      ? [`TRAINING BREAKDOWN:`,
         `- Push/Pull/Legs: ${breakdown.pplSlices.map((s: { label: string; value: number }) => `${s.label} ${Math.round((s.value / pplTotal) * 100)}%`).join(', ')}`,
         `- Body parts: ${breakdown.bodySlices.map((s: { label: string; value: number }) => `${s.label} ${Math.round((s.value / bodyTotal) * 100)}%`).join(', ')}`].join('\n')
      : '',
    balance ? `SESSION BALANCE: ${balance.liftPct}% strength, ${balance.runPct}% running` : '',
    profileText ? `\n${profileText}` : '',
    previousRecommendations
      ? `\nLAST WEEK'S COACH RECOMMENDATIONS (follow up on these — acknowledge what the athlete acted on and what they ignored):\n${previousRecommendations}`
      : '',
  ]

  return completeChat({
    system: COACH_SYSTEM_PROMPT,
    user: lines.filter(Boolean).join('\n'),
    maxTokens: 1500,
  })
}

/** Pulls the KEY RECOMMENDATIONS section out of a previous report (falls back to last 800 chars). */
function extractRecommendations(reportText: string): string {
  const m = reportText.match(/## KEY RECOMMENDATIONS([\s\S]*?)(?=\n## |$)/)
  const section = m ? m[1].trim() : ''
  return section || reportText.slice(-800)
}

export async function GET(req: NextRequest) {
  // Fail closed: without a configured secret this endpoint must not run —
  // it uses the service-role key and spends AI credits for every user.
  if (!CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }
  if (!deepseekConfigured()) {
    return NextResponse.json({ error: 'DEEPSEEK_API_KEY is not configured' }, { status: 500 })
  }
  // Vercel sends CRON_SECRET as "Authorization: Bearer <secret>"
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const weekEnding = currentWeekEnding()

  // Get all distinct user_ids from the sessions table
  const { data: userRows, error: userErr } = await supabaseAdmin
    .from('sessions')
    .select('user_id')
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 })

  const userIds = [...new Set((userRows ?? []).map((r: { user_id: string }) => r.user_id).filter(Boolean))]

  const results: { userId: string; status: string; error?: string }[] = []

  for (const userId of userIds) {
    try {
      // Skip if report already exists for this week
      const { data: existing } = await supabaseAdmin
        .from('coach_reports')
        .select('id')
        .eq('user_id', userId)
        .eq('week_ending', weekEnding)
        .maybeSingle()
      if (existing) { results.push({ userId, status: 'skipped (already exists)' }); continue }

      // Fetch user sessions
      const { data: sessionRows, error: sessErr } = await supabaseAdmin
        .from('sessions')
        .select('data')
        .eq('user_id', userId)
        .order('saved_at', { ascending: false })
      if (sessErr) throw new Error(sessErr.message)

      const history = (sessionRows ?? []).map(r => r.data as SessionData)
      if (history.length === 0) { results.push({ userId, status: 'skipped (no sessions)' }); continue }

      // Athlete profile (B1) — so the coach knows goals, 1RMs, race date, injuries
      const { data: profileRow } = await supabaseAdmin
        .from('user_settings')
        .select('value')
        .eq('user_id', userId)
        .eq('key', 'athlete_profile')
        .maybeSingle()
      let profileText = ''
      try {
        profileText = profileRow?.value ? profileToPrompt(JSON.parse(profileRow.value) as AthleteProfile) : ''
      } catch { /* malformed profile — skip */ }

      // Previous report (B2) — so the coach follows up on its own advice
      const { data: prevRows } = await supabaseAdmin
        .from('coach_reports')
        .select('report_text')
        .eq('user_id', userId)
        .lt('week_ending', weekEnding)
        .order('week_ending', { ascending: false })
        .limit(1)
      const previousRecommendations = prevRows?.[0]?.report_text
        ? extractRecommendations(prevRows[0].report_text)
        : ''

      const stats = computeStats(history, weekEnding)
      const reportText = await generateReport(stats, profileText, previousRecommendations)

      const { error: saveErr } = await supabaseAdmin
        .from('coach_reports')
        .upsert(
          { user_id: userId, week_ending: weekEnding, report_text: reportText, stats, created_at: new Date().toISOString() },
          { onConflict: 'user_id,week_ending' }
        )
      if (saveErr) throw new Error(saveErr.message)

      // Trim to last 12 weeks per user
      const { data: allRows } = await supabaseAdmin
        .from('coach_reports')
        .select('id')
        .eq('user_id', userId)
        .order('week_ending', { ascending: false })
      if (allRows && allRows.length > 12) {
        const toDelete = allRows.slice(12).map((r: { id: string }) => r.id)
        await supabaseAdmin.from('coach_reports').delete().in('id', toDelete)
      }

      results.push({ userId, status: 'generated' })
    } catch (e) {
      results.push({ userId, status: 'error', error: String(e) })
    }
  }

  return NextResponse.json({ weekEnding, processed: results.length, results })
}
