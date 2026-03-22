// Generates ~6 months of realistic lift + run session history and writes to localStorage

function uid() { return Math.random().toString(36).slice(2, 9) }

const LIFT_SESSIONS = [
  {
    name: 'Lower A — Squat Focus',
    exercises: [
      { name: 'Back Squat',         baseSets: [{ r: 5, w: 100 }, { r: 5, w: 105 }, { r: 3, w: 110 }] },
      { name: 'Romanian Deadlift',  baseSets: [{ r: 8, w: 80  }, { r: 8, w: 82  }, { r: 8, w: 85  }] },
      { name: 'Leg Press',          baseSets: [{ r: 10, w: 120 }, { r: 10, w: 120 }, { r: 10, w: 125 }] },
      { name: 'Calf Raise',         baseSets: [{ r: 15, w: 60 }, { r: 15, w: 60 }, { r: 12, w: 65 }] },
    ],
  },
  {
    name: 'Upper A — Bench Focus',
    exercises: [
      { name: 'Bench Press',        baseSets: [{ r: 5, w: 80 }, { r: 5, w: 85 }, { r: 3, w: 90 }] },
      { name: 'Barbell Row',        baseSets: [{ r: 6, w: 75 }, { r: 6, w: 75 }, { r: 6, w: 78 }] },
      { name: 'Overhead Press',     baseSets: [{ r: 8, w: 55 }, { r: 8, w: 55 }, { r: 6, w: 58 }] },
      { name: 'Pull-Up',            baseSets: [{ r: 6, w: 0  }, { r: 5, w: 0  }, { r: 5, w: 0  }] },
    ],
  },
  {
    name: 'Lower B — Deadlift Focus',
    exercises: [
      { name: 'Conventional Deadlift', baseSets: [{ r: 5, w: 120 }, { r: 3, w: 130 }, { r: 1, w: 140 }] },
      { name: 'Front Squat',           baseSets: [{ r: 6, w: 75  }, { r: 6, w: 78  }, { r: 6, w: 80  }] },
      { name: 'Nordic Curl',           baseSets: [{ r: 5, w: 0   }, { r: 5, w: 0   }, { r: 4, w: 0   }] },
      { name: 'Hip Thrust',            baseSets: [{ r: 10, w: 100 }, { r: 10, w: 100 }, { r: 8, w: 105 }] },
    ],
  },
  {
    name: 'Upper B — OHP Focus',
    exercises: [
      { name: 'Overhead Press',     baseSets: [{ r: 5, w: 58 }, { r: 5, w: 60 }, { r: 3, w: 63 }] },
      { name: 'Weighted Pull-Up',   baseSets: [{ r: 5, w: 10 }, { r: 5, w: 12 }, { r: 4, w: 14 }] },
      { name: 'Incline Bench',      baseSets: [{ r: 8, w: 70 }, { r: 8, w: 72 }, { r: 6, w: 75 }] },
      { name: 'Cable Row',          baseSets: [{ r: 10, w: 60 }, { r: 10, w: 62 }, { r: 10, w: 65 }] },
    ],
  },
]

const RUN_SESSIONS = [
  { name: 'Easy Run',   segments: [{ type: 'easy',   metric: 'distance', dist: 6,  pace: '5:45' }] },
  { name: 'Easy Run',   segments: [{ type: 'easy',   metric: 'distance', dist: 8,  pace: '5:50' }] },
  { name: 'Easy Run',   segments: [{ type: 'easy',   metric: 'distance', dist: 10, pace: '5:40' }] },
  { name: 'Tempo Run',  segments: [
    { type: 'warmup',  metric: 'distance', dist: 2,  pace: '6:00' },
    { type: 'tempo',   metric: 'distance', dist: 5,  pace: '4:45' },
    { type: 'cooldown',metric: 'distance', dist: 1,  pace: '6:00' },
  ]},
  { name: 'Tempo Run',  segments: [
    { type: 'warmup',  metric: 'distance', dist: 2,  pace: '6:00' },
    { type: 'tempo',   metric: 'distance', dist: 6,  pace: '4:40' },
    { type: 'cooldown',metric: 'distance', dist: 2,  pace: '6:10' },
  ]},
  { name: 'Long Run',   segments: [{ type: 'long',   metric: 'distance', dist: 14, pace: '5:55' }] },
  { name: 'Long Run',   segments: [{ type: 'long',   metric: 'distance', dist: 16, pace: '6:00' }] },
  { name: 'Long Run',   segments: [{ type: 'long',   metric: 'distance', dist: 18, pace: '5:50' }] },
  { name: 'Long Run',   segments: [{ type: 'long',   metric: 'distance', dist: 20, pace: '5:55' }] },
  { name: 'Recovery Run', segments: [{ type: 'recovery', metric: 'distance', dist: 5, pace: '6:15' }] },
  { name: 'Interval Session', segments: [
    { type: 'warmup',   metric: 'distance', dist: 2, pace: '6:00' },
    { type: 'interval', metric: 'distance', dist: 1, pace: '4:00' },
    { type: 'interval', metric: 'distance', dist: 1, pace: '4:00' },
    { type: 'interval', metric: 'distance', dist: 1, pace: '4:05' },
    { type: 'interval', metric: 'distance', dist: 1, pace: '4:05' },
    { type: 'cooldown', metric: 'distance', dist: 1, pace: '6:00' },
  ]},
  { name: 'Hill Repeats', segments: [
    { type: 'warmup', metric: 'distance', dist: 2, pace: '6:00' },
    { type: 'hills',  metric: 'distance', dist: 0.4, pace: '4:30' },
    { type: 'hills',  metric: 'distance', dist: 0.4, pace: '4:30' },
    { type: 'hills',  metric: 'distance', dist: 0.4, pace: '4:35' },
    { type: 'hills',  metric: 'distance', dist: 0.4, pace: '4:35' },
    { type: 'cooldown', metric: 'distance', dist: 1, pace: '6:00' },
  ]},
]

function jitter(val: number, pct = 0.05): number {
  return val * (1 + (Math.random() - 0.5) * 2 * pct)
}

function progressWeight(base: number, week: number, totalWeeks: number): number {
  // ~15% total gain over 26 weeks, with slight jitter
  const gain = base * 0.15 * (week / totalWeeks)
  return Math.round((base + gain + (Math.random() - 0.5) * 2) / 2.5) * 2.5
}

function makeLiftSession(
  template: typeof LIFT_SESSIONS[0],
  date: string,
  week: number,
  totalWeeks: number,
) {
  const exercises = template.exercises.map(ex => {
    const sets = ex.baseSets.map(s => {
      const w = progressWeight(s.w, week, totalWeeks)
      const r = s.r + (Math.random() > 0.8 ? 1 : 0)
      const rpe = (7 + Math.random() * 2).toFixed(1)
      return {
        reps: String(r),
        weight: String(w),
        rpe,
      }
    })
    return {
      id: uid(),
      exerciseName: ex.name,
      plannedSets: sets.map(s => ({ reps: s.reps, weight: s.weight })),
      actualSets: sets,
    }
  })
  return {
    type: 'lift',
    name: template.name,
    date,
    savedAt: new Date(date + 'T09:00:00').toISOString(),
    exercises,
    run: [],
  }
}

function makeRunSession(template: typeof RUN_SESSIONS[0], date: string, week: number, totalWeeks: number) {
  // Pace improves slightly over time
  function improvePace(pace: string): string {
    const [m, s] = pace.split(':').map(Number)
    const totalSecs = m * 60 + s
    const improvement = totalSecs * 0.04 * (week / totalWeeks) // up to 4% faster
    const newSecs = Math.max(totalSecs - improvement + (Math.random() - 0.5) * 10, totalSecs * 0.85)
    const nm = Math.floor(newSecs / 60)
    const ns = Math.round(newSecs % 60)
    return `${nm}:${ns.toString().padStart(2, '0')}`
  }

  const run = template.segments.map(seg => ({
    id: uid(),
    segmentType: seg.type,
    metric: seg.metric,
    plannedValue: String(seg.dist),
    plannedPace: seg.pace,
    actualValue: String(Math.round(jitter(seg.dist, 0.03) * 10) / 10),
    actualPace: improvePace(seg.pace),
  }))

  return {
    type: 'run',
    name: template.name,
    date,
    savedAt: new Date(date + 'T07:30:00').toISOString(),
    exercises: [],
    run,
  }
}

export function seedHistory() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - 180)

  const sessions: object[] = []
  const totalWeeks = 26

  // Rotate lift templates A/B/A/B...
  let liftIdx = 0
  let runIdx = 0

  for (let d = 0; d <= 180; d++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + d)
    const week = Math.floor(d / 7)
    const dow = date.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
    const dateStr = date.toISOString().split('T')[0]

    // Skip some sessions randomly (~20% rest days beyond schedule)
    const skip = Math.random() < 0.15

    if (skip) continue

    if (dow === 1 || dow === 3 || dow === 5) {
      // Mon/Wed/Fri → lift
      const tmpl = LIFT_SESSIONS[liftIdx % LIFT_SESSIONS.length]
      sessions.push(makeLiftSession(tmpl, dateStr, week, totalWeeks))
      liftIdx++
    } else if (dow === 2 || dow === 4) {
      // Tue/Thu → run
      const tmpl = RUN_SESSIONS[runIdx % RUN_SESSIONS.length]
      sessions.push(makeRunSession(tmpl, dateStr, week, totalWeeks))
      runIdx++
    } else if (dow === 6) {
      // Saturday → long run (every other week) or rest
      if (week % 2 === 0) {
        const longRuns = RUN_SESSIONS.filter(r => r.name.startsWith('Long'))
        const tmpl = longRuns[Math.floor(week / 2) % longRuns.length]
        sessions.push(makeRunSession(tmpl, dateStr, week, totalWeeks))
        runIdx++
      }
    }
    // Sunday = rest
  }

  // Sort newest first (matching how live saves work)
  sessions.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return sessions
}
