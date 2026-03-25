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

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY ?? ''
const CRON_SECRET  = process.env.CRON_SECRET ?? ''

// Sunday of the current week (YYYY-MM-DD)
function currentWeekEnding(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay() // 0 = Sunday
  d.setUTCDate(d.getUTCDate() + (day === 0 ? 0 : 7 - day))
  return d.toISOString().split('T')[0]
}

async function generateReport(stats: ReturnType<typeof computeStats>): Promise<string> {
  const { overview, totalSessions, strengthSummary, runSummary, breakdown, balance } = stats

  const systemPrompt = `You are an expert hybrid athlete coach. Analyse the athlete's weekly training data and produce a concise, actionable coaching report.
Format using EXACTLY these headers (nothing before the first ##):
## TRAINING LOAD
## STRENGTH ANALYSIS
## RUNNING ANALYSIS
## HYBRID BALANCE
## KEY RECOMMENDATIONS
Each section: 3–5 bullet points starting with "- ". Use **bold** for key terms. 400–600 words total.`

  const lines = [
    `OVERVIEW:`,
    `- Sessions this week: ${overview.sessionsThisWeek}`,
    `- Km run this week: ${overview.kmThisWeek}`,
    `- Total volume lifted (all time): ${overview.totalVolume} kg`,
    `- Readiness score: ${overview.tsb}% — ${overview.readinessLabel}`,
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
         `- Push/Pull/Legs: ${breakdown.pplSlices.map(s => `${s.label} ${s.value}%`).join(', ')}`,
         `- Body parts: ${breakdown.bodySlices.map(s => `${s.label} ${s.value}%`).join(', ')}`].join('\n')
      : '',
    balance ? `SESSION BALANCE: ${balance.liftPct}% strength, ${balance.runPct}% running` : '',
  ]

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_KEY}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      stream: false,
      max_tokens: 1500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: lines.filter(Boolean).join('\n') },
      ],
    }),
  })
  if (!res.ok) throw new Error(`DeepSeek error: ${res.status}`)
  const json = await res.json()
  return json.choices?.[0]?.message?.content ?? ''
}

export async function GET(req: NextRequest) {
  // Vercel sends CRON_SECRET as "Authorization: Bearer <secret>"
  const auth = req.headers.get('authorization') ?? ''
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
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

      const stats = computeStats(history)
      const reportText = await generateReport(stats)

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
