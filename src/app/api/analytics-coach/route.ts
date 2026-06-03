import { NextRequest } from 'next/server'
import { COACH_SYSTEM_PROMPT } from '@/lib/coachPrompt'

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY ?? ''

export async function POST(req: NextRequest) {
  const { overview, totalSessions, strengthSummary, runSummary, breakdown, balance } = await req.json()

  const factorStr = (overview.tsbFactors ?? []).map((f: { name: string; points: number }) => `${f.name} ${f.points > 0 ? '+' : ''}${f.points}`).join(', ')
  const userLines: string[] = [
    `OVERVIEW:`,
    `- Sessions this week: ${overview.sessionsThisWeek}`,
    `- Km run this week: ${overview.kmThisWeek}`,
    `- Volume lifted this week: ${overview.volumeThisWeek} kg`,
    `- Total volume lifted (all time): ${overview.totalVolume} kg`,
    `- Readiness score: ${overview.tsb}% — ${overview.readinessLabel}${factorStr ? ` (factors: ${factorStr})` : ''}`,
    overview.overtrained ? `- ⚠ HIGH LOAD WARNING: volume >30% above last week — injury risk elevated` : '',
    `- Total sessions logged: ${totalSessions}`,
    ``,
  ].filter(l => l !== '')

  if (strengthSummary) {
    userLines.push(
      `STRENGTH:`,
      `- Top exercises: ${strengthSummary.topExercises.join(', ')}`,
      `- Recent PRs: ${strengthSummary.prs.map((p: { exercise: string; rm: string; date: string }) => `${p.exercise}: ${p.rm} (${p.date})`).join('; ')}`,
      ``,
    )
  } else {
    userLines.push(`STRENGTH: No strength sessions logged yet.`, ``)
  }

  if (runSummary) {
    userLines.push(
      `RUNNING:`,
      `- Weekly km (last 12 weeks): ${runSummary.weeklyKm.map((w: { week: string; km: number }) => `${w.week}: ${w.km}km`).join(', ')}`,
      `- Run type mix: ${runSummary.runTypeMix.map((t: { name: string; value: number }) => `${t.name} ${t.value}%`).join(', ')}`,
      ``,
    )
  } else {
    userLines.push(`RUNNING: No run sessions logged yet.`, ``)
  }

  if (breakdown?.hasData) {
    const pplTotal = breakdown.pplSlices.reduce((s: number, sl: { value: number }) => s + sl.value, 0) || 1
    const bodyTotal = breakdown.bodySlices.reduce((s: number, sl: { value: number }) => s + sl.value, 0) || 1
    userLines.push(
      `TRAINING BREAKDOWN:`,
      `- Push/Pull/Legs: ${breakdown.pplSlices.map((s: { label: string; value: number }) => `${s.label} ${Math.round((s.value / pplTotal) * 100)}%`).join(', ')}`,
      `- Body parts: ${breakdown.bodySlices.map((s: { label: string; value: number }) => `${s.label} ${Math.round((s.value / bodyTotal) * 100)}%`).join(', ')}`,
      ``,
    )
  }

  if (balance) {
    userLines.push(`SESSION BALANCE: ${balance.liftPct}% strength sessions, ${balance.runPct}% running sessions`)
  }

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      stream: true,
      max_tokens: 1500,
      messages: [
        { role: 'system', content: COACH_SYSTEM_PROMPT },
        { role: 'user', content: userLines.join('\n') },
      ],
    }),
  })

  if (!response.ok || !response.body) {
    return new Response('Failed to contact AI', { status: 500 })
  }

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          for (const line of chunk.split('\n')) {
            const t = line.replace(/^data: /, '').trim()
            if (!t || t === '[DONE]') continue
            try {
              const j = JSON.parse(t)
              const text = j.choices?.[0]?.delta?.content ?? ''
              if (text) controller.enqueue(encoder.encode(text))
            } catch { /* skip malformed chunks */ }
          }
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  })
}
