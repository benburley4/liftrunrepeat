import { NextRequest } from 'next/server'

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY ?? ''

export async function POST(req: NextRequest) {
  const { overview, totalSessions, strengthSummary, runSummary, breakdown, balance } = await req.json()

  const systemPrompt = `You are an expert hybrid athlete coach specialising in concurrent strength and endurance training. Analyse the athlete's training data and produce a concise, actionable coaching report.

Format your response using EXACTLY these section headers (nothing else before the first ##):
## TRAINING LOAD
## STRENGTH ANALYSIS
## RUNNING ANALYSIS
## HYBRID BALANCE
## KEY RECOMMENDATIONS

Each section must use bullet points starting with "- ". Use **bold** for key terms or numbers. Keep each section to 3–5 bullets. Total response 400–600 words. Be specific and reference the actual numbers provided.`

  const userLines: string[] = [
    `OVERVIEW:`,
    `- Sessions this week: ${overview.sessionsThisWeek}`,
    `- Km run this week: ${overview.kmThisWeek}`,
    `- Total volume lifted (all time): ${overview.totalVolume} kg`,
    `- Readiness score: ${overview.tsb}% — ${overview.readinessLabel}`,
    `- Total sessions logged: ${totalSessions}`,
    ``,
  ]

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
    userLines.push(
      `TRAINING BREAKDOWN:`,
      `- Push/Pull/Legs: ${breakdown.pplSlices.map((s: { label: string; value: number }) => `${s.label} ${s.value}%`).join(', ')}`,
      `- Body parts: ${breakdown.bodySlices.map((s: { label: string; value: number }) => `${s.label} ${s.value}%`).join(', ')}`,
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
        { role: 'system', content: systemPrompt },
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
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  })
}
