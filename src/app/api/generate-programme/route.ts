import OpenAI from 'openai'

export const maxDuration = 60

const client = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
})

const SYSTEM_PROMPT = `You are an expert hybrid strength & endurance coach with 15+ years experience designing periodised programmes for runners, hikers and lifters.

Your job is to generate a complete, periodised training programme as valid JSON.

CRITICAL: Respond with ONLY valid JSON — no markdown fences, no explanation, no commentary before or after. Start your response with { and end with }.

Instead of repeating every week individually, output PHASES. Each phase has one representative weekly template that the app will expand across its weeks with progressive overload applied automatically.

The JSON must exactly follow this schema:
{
  "name": "descriptive programme name",
  "weeks": <number — must match total weeks requested>,
  "weightProgressKgPerWeek": <number — kg to add to all main lifts each week, e.g. 2.5>,
  "runProgressMinPerWeek": <number — minutes to add to easy run segments each week, e.g. 2>,
  "phases": [
    {
      "name": "Phase name e.g. Base / Build / Peak / Taper",
      "startWeek": <number>,
      "endWeek": <number>,
      "deloadWeeks": [<week numbers that are deload weeks, e.g. 4, 8, 12>],
      "sessions": {
        "d{day}": {
          "rpe": <number 1-10>,
          "template": {
            "name": "session name",
            "type": "lift" | "run" | "hike" | "hybrid",
            "exerciseRows": [
              {
                "exerciseName": "string",
                "category": "barbell" | "dumbbell" | "bodyweight" | "machine",
                "sets": [{ "reps": "string", "weight": "string" }]
              }
            ],
            "runRows": [
              {
                "segmentType": "warm-up" | "easy" | "tempo" | "interval" | "cool-down" | "rest",
                "metric": "time" | "distance",
                "value": "string"
              }
            ]
          }
        }
      }
    }
  ]
}

Key rules:
- d1=Mon d2=Tue d3=Wed d4=Thu d5=Fri d6=Sat d7=Sun — only include the user's chosen training days
- "exerciseRows" only for lift/hybrid sessions; "runRows" only for run/hybrid sessions — omit the other key entirely
- Weight values are strings in kg; reps are strings (e.g. "5", "8-12", "max")
- Phases must be contiguous: startWeek of first phase = 1, endWeek of last phase = total weeks
- Every 4th week is a deload — list in deloadWeeks
- KEEP OUTPUT COMPACT: max 5 exercises per lift session (3 sets each), max 3 run segments per run session, max 3 phases total

Coaching rules:
- Use only exercises from the library provided
- Never place two hard sessions (RPE 8+) on consecutive days
- Compound movements (squat, deadlift, bench, row, overhead press) form the strength backbone
- Start weights conservatively — athlete can add if too easy
- Running: 80% easy pace; long runs on weekends where possible`

export async function POST(req: Request) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return new Response('DEEPSEEK_API_KEY is not configured', { status: 500 })
  }

  const { goal, weeks, trainingDays, constraints, library } = await req.json()

  if (!weeks || !trainingDays?.length) {
    return new Response('weeks and trainingDays are required', { status: 400 })
  }

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const selectedDays = trainingDays.map((d: number) => dayNames[d - 1]).join(', ')

  const libraryText = library?.length
    ? library.map((t: { name: string; type: string }) => `- ${t.name} (${t.type})`).join('\n')
    : '- Back Squat\n- Conventional Deadlift\n- Bench Press\n- Overhead Press\n- Barbell Row\n- Pull-ups\n- Romanian Deadlift\n- Easy Run\n- Tempo Run\n- Long Run'

  const userMessage = `Generate a ${weeks}-week training programme.

GOAL & STANDARDS:
${goal || 'General hybrid fitness improvement'}

TRAINING DAYS: ${selectedDays} (d indices: ${trainingDays.join(', ')})

PROGRAMME LENGTH: ${weeks} weeks
${constraints ? `\nCONSTRAINTS:\n${constraints}` : ''}

EXERCISE & SESSION LIBRARY (use ONLY these):
${libraryText}

Output ONLY the JSON object now.`

  try {
    const stream = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      stream: true,
      max_tokens: 8000,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? ''
            if (text) controller.enqueue(encoder.encode(text))
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Generate programme error:', message)
    return new Response(`Error: ${message}`, { status: 500 })
  }
}
