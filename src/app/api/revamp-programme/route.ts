import OpenAI from 'openai'

export const maxDuration = 60

const client = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
})

const SYSTEM_PROMPT = `You are an expert hybrid strength & endurance coach with 15+ years experience designing periodised programmes for runners, hikers and lifters.

Your job is to revamp an existing training programme based on AI coach review recommendations. Output the improved programme as valid JSON.

CRITICAL: Respond with ONLY valid JSON — no markdown fences, no explanation, no commentary before or after. Start your response with { and end with }.

Instead of repeating every week individually, output PHASES. Each phase has one representative weekly template that the app will expand across its weeks with progressive overload applied automatically.

The JSON must exactly follow this schema:
{
  "name": "descriptive programme name",
  "weeks": <number — must match original programme weeks>,
  "weightProgressKgPerWeek": <number — kg to add to all main lifts each week, e.g. 2.5>,
  "runProgressMinPerWeek": <number — minutes to add to easy run segments each week, e.g. 2>,
  "phases": [
    {
      "name": "Phase name e.g. Base / Build / Peak / Taper",
      "startWeek": <number>,
      "endWeek": <number>,
      "deloadWeeks": [<week numbers that are deload weeks>],
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
- Keep the same training days as the original programme
- Preserve the same number of weeks as the original
- "exerciseRows" only for lift/hybrid sessions; "runRows" only for run/hybrid sessions — omit the other key entirely
- Weight values are strings in kg; reps are strings (e.g. "5", "8-12", "max")
- Phases must be contiguous: startWeek of first phase = 1, endWeek of last phase = total weeks
- Every 4th week is a deload — list in deloadWeeks
- KEEP OUTPUT COMPACT: max 6 exercises per lift session (3 sets each), max 3 run segments per run session, max 3 phases total

Coaching rules:
- Implement the specific improvements recommended in the AI coach review
- CRITICAL: When CURRENT EXERCISE WEIGHTS are provided, use them as the exact week 1 starting weights — these are real weights the athlete is currently lifting. Never reduce them to conservative estimates.
- Never place two hard sessions (RPE 8+) on consecutive days
- Compound movements (squat, deadlift, bench, row, overhead press) form the strength backbone
- Running: 80% easy pace; long runs on weekends where possible
- CRITICAL for run segments: "value" must always be a non-empty string representing minutes (for time) or km (for distance). Use the CURRENT RUN SESSION VOLUMES as the baseline. Example: warm-up "10", easy "30", cool-down "5". Never output empty string or "0" for value.`

export async function POST(req: Request) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return new Response('DEEPSEEK_API_KEY is not configured', { status: 500 })
  }

  const { programme, review } = await req.json()

  if (!programme || !review) {
    return new Response('programme and review are required', { status: 400 })
  }

  // Derive training days from cells (0-based keys w{w}d{day})
  const cellKeys = Object.keys(programme.cells ?? {})
  const hasW0 = cellKeys.some((k: string) => k.startsWith('w0'))
  const dayBase = hasW0 ? 0 : 1
  const trainingDaySet = new Set<number>()
  for (const key of cellKeys) {
    const m = key.match(/d(\d+)/)
    if (m) trainingDaySet.add(parseInt(m[1]) - dayBase + 1) // convert to 1-based d-index
  }
  const trainingDays = Array.from(trainingDaySet).sort((a, b) => a - b)

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const selectedDays = trainingDays.map((d: number) => dayNames[d - 1]).join(', ')

  // Extract current exercise weights from week 1 cells
  type CellAny = { template?: { exerciseRows?: { exerciseName?: string; sets?: { weight?: string; reps?: string }[] }[]; runRows?: { segmentType?: string; value?: string; metric?: string }[] } }
  const cells = programme.cells as Record<string, CellAny>
  const exerciseWeights: string[] = []
  const runSegments: string[] = []
  const seenExercises = new Set<string>()

  for (const [key, cell] of Object.entries(cells)) {
    // Only look at week 1 (w0... or w1...)
    if (!key.startsWith('w0') && !key.startsWith('w1')) continue
    const weekNum = parseInt(key.replace(/w(\d+).*/, '$1'))
    if (weekNum > 1) continue

    for (const ex of cell.template?.exerciseRows ?? []) {
      if (!ex.exerciseName || seenExercises.has(ex.exerciseName)) continue
      seenExercises.add(ex.exerciseName)
      const set1 = ex.sets?.[0]
      if (set1?.weight) {
        exerciseWeights.push(`  - ${ex.exerciseName}: ${set1.weight}kg × ${set1.reps} reps`)
      }
    }
    for (const row of cell.template?.runRows ?? []) {
      if (row.segmentType && row.value && row.metric) {
        runSegments.push(`  - ${row.segmentType}: ${row.value} ${row.metric === 'time' ? 'min' : 'km'}`)
      }
    }
  }

  const weightsSection = exerciseWeights.length
    ? `\nCURRENT EXERCISE WEIGHTS (use these as exact week 1 starting weights — athlete is already lifting these):\n${exerciseWeights.join('\n')}\n`
    : ''

  const runSection = runSegments.length
    ? `\nCURRENT RUN SESSION VOLUMES (maintain similar volumes):\n${[...new Set(runSegments)].slice(0, 6).join('\n')}\n`
    : ''

  const userMessage = `Revamp this ${programme.weeks}-week training programme based on the AI coach review recommendations below.

ORIGINAL PROGRAMME: ${programme.name}
TRAINING DAYS: ${selectedDays} (d indices: ${trainingDays.join(', ')})
PROGRAMME LENGTH: ${programme.weeks} weeks
${weightsSection}${runSection}
AI COACH REVIEW RECOMMENDATIONS:
${review}

Apply the specific improvements recommended above. Maintain the same training days and programme length.
The revamped programme name should start with "AI Coach Updated — ".

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
    console.error('Revamp programme error:', message)
    return new Response(`Error: ${message}`, { status: 500 })
  }
}
