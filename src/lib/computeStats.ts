// Shared server-side stats computation — mirrors the useMemo logic in analytics/page.tsx

interface ActualSet { reps: string; weight: string; rpe: string }
interface PlannedSet { reps: string; weight: string }
interface LoggedExercise { id: string; exerciseName: string; plannedSets: PlannedSet[]; actualSets: ActualSet[] }
interface LoggedRunSegment { id: string; segmentType: string; metric: string; plannedValue: string; plannedPace: string; actualValue: string; actualPace: string }
interface LoggedRepeat { id: string; kind: 'repeat'; count: string; laps: LoggedRunSegment[] }
type LoggedRunEntry = LoggedRunSegment | LoggedRepeat

export interface SessionData {
  type: string; name: string; date: string; savedAt: string
  exercises?: LoggedExercise[]
  run?: LoggedRunEntry[]
  hikeKm?: number // distance for hike sessions logged without run segments
}

function segKm(seg: LoggedRunSegment): number {
  if (seg.metric === 'distance') return parseFloat(seg.actualValue) || 0
  if (seg.metric === 'time' && seg.actualPace) {
    const [m, sc] = seg.actualPace.split(':').map(Number)
    const paceMin = m + (sc || 0) / 60
    return paceMin > 0 ? (parseFloat(seg.actualValue) || 0) / paceMin : 0
  }
  return 0
}

function sessionKm(s: SessionData): number {
  const runKm = (s.run ?? []).reduce((rs, entry) => {
    if ('kind' in entry && entry.kind === 'repeat')
      return rs + entry.laps.reduce((ls, l) => ls + segKm(l), 0) * (parseInt(entry.count) || 1)
    return rs + segKm(entry as LoggedRunSegment)
  }, 0)
  return runKm + (s.hikeKm ?? 0)
}

function sessionLoad(s: SessionData): number {
  const liftLoad = (s.exercises ?? []).reduce((sum, ex) =>
    sum + ex.actualSets.reduce((ss, set) =>
      ss + (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0), 0), 0) / 1000
  return liftLoad + sessionKm(s)
}

function epleyRM(w: number, r: number) { return r === 1 ? w : Math.round(w * (1 + r / 30)) }

function weekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d.toISOString().split('T')[0]
}

const PPL_KEYWORDS: [RegExp, string][] = [
  [/bench|push.?up|fly|chest|pec/i,                                          'Push'],
  [/overhead.?press|ohp|shoulder.?press|military|lateral.?raise|front.?raise/i, 'Push'],
  [/tricep|pushdown|skull|extension/i,                                        'Push'],
  [/row|pull.?up|chin.?up|lat\b|pulldown|face.?pull|rear.?delt|shrug/i,    'Pull'],
  [/curl|bicep/i,                                                              'Pull'],
  [/squat|lunge|leg.?press|hip.?thrust|glute|calf|step.?up|hack/i,         'Legs'],
  [/deadlift|rdl|romanian/i,                                                   'Legs'],
  [/plank|crunch|sit.?up|hollow|\bab\b|core|russian|oblique/i,              'Core'],
]

const BODY_KEYWORDS: [RegExp, string][] = [
  [/bench|push.?up|fly|chest|pec/i,                                                              'Chest'],
  [/overhead.?press|ohp|shoulder.?press|military|lateral.?raise|front.?raise|face.?pull|rear.?delt/i, 'Shoulders'],
  [/row|pull.?up|chin.?up|lat\b|pulldown|shrug/i,                                                'Back'],
  [/deadlift|rdl|romanian/i,                                                                      'Back'],
  [/squat|lunge|leg.?press|hip.?thrust|glute|calf|step.?up|hack/i,                              'Legs'],
  [/curl|bicep/i,                                                                                  'Arms'],
  [/tricep|pushdown|skull|extension/i,                                                             'Arms'],
  [/plank|crunch|sit.?up|hollow|\bab\b|core|russian|oblique/i,                                   'Core'],
]

function classifyPPL(name: string) { for (const [re, cat] of PPL_KEYWORDS) if (re.test(name)) return cat; return 'Push' }
function classifyBody(name: string) { for (const [re, bp] of BODY_KEYWORDS) if (re.test(name)) return bp; return 'Back' }

function sessionLiftLoad(s: SessionData): number {
  return (s.exercises ?? []).reduce((sum, ex) =>
    sum + ex.actualSets.reduce((ss, set) =>
      ss + (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0), 0), 0) / 1000
}

export function computeStats(history: SessionData[]) {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const dow = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() + (dow === 0 ? -6 : 1 - dow))

  const thisWeek = history.filter(s => new Date(s.date + 'T00:00:00') >= monday)
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7)
  const fourWeeksAgo = new Date(now); fourWeeksAgo.setDate(now.getDate() - 28)
  const recent7  = history.filter(s => new Date(s.date + 'T00:00:00') >= sevenDaysAgo)

  // Group all history by week
  const byWeek: Record<string, { total: number; lift: number }> = {}
  for (const s of history) {
    const wk = weekStart(s.date)
    if (!byWeek[wk]) byWeek[wk] = { total: 0, lift: 0 }
    const load = sessionLoad(s); const liftL = sessionLiftLoad(s)
    byWeek[wk].total += load; byWeek[wk].lift += liftL
  }
  const allWeekLoads = Object.values(byWeek)
  const personalWeeklyAvg = allWeekLoads.length > 0
    ? allWeekLoads.reduce((s, w) => s + w.total, 0) / allWeekLoads.length : 0

  const thisWk = weekStart(now.toISOString().split('T')[0])
  const lastWkDate = new Date(now); lastWkDate.setDate(now.getDate() - 7)
  const lastWk = weekStart(lastWkDate.toISOString().split('T')[0])
  const thisWeekLoad = byWeek[thisWk]?.total ?? 0
  const lastWeekLoad = byWeek[lastWk]?.total ?? 0

  // 1. Personalised base score
  let score = personalWeeklyAvg > 0
    ? Math.round(65 - ((thisWeekLoad / personalWeeklyAvg) - 1) * 30)
    : history.length === 0 ? 75 : 65

  // 2. Consistency bonus (max +10)
  const weeksActive = allWeekLoads.filter(w => w.total > 0).length
  score += Math.min(10, Math.floor(weeksActive / 2))

  // 3. Days since last session (max +15)
  const lastSessionDate = [...history].sort((a, b) => b.date.localeCompare(a.date))[0]?.date
  const daysSinceLast = lastSessionDate
    ? Math.floor((now.getTime() - new Date(lastSessionDate + 'T00:00:00').getTime()) / 86400000)
    : 0
  if (daysSinceLast > 0) score += Math.min(15, daysSinceLast * 4)

  // 4. Ramp rate
  if (lastWeekLoad > 0) {
    const ramp = (thisWeekLoad - lastWeekLoad) / lastWeekLoad
    if (ramp > 0.1) score -= Math.round(Math.min(15, ramp * 30))
    else if (ramp < -0.1) score += 5
  }

  // 5. Cross-sport freshness
  const recentLiftTotal = recent7.reduce((s, sess) => s + sessionLiftLoad(sess), 0)
  const recentTotal = recent7.reduce((s, sess) => s + sessionLoad(sess), 0)
  const liftRatio = recentTotal > 0 ? recentLiftTotal / recentTotal : 0.5
  if (liftRatio < 0.2 || liftRatio > 0.8) score += 5

  const tsb = Math.max(0, Math.min(100, score))

  // 6. Trend
  const lastWeekScore = personalWeeklyAvg > 0
    ? Math.round(65 - ((lastWeekLoad / personalWeeklyAvg) - 1) * 30) : 65
  const readinessTrend = tsb > lastWeekScore + 3 ? '↑' : tsb < lastWeekScore - 3 ? '↓' : '→'

  // 7. Positive labels
  const readinessLabel = tsb >= 80 ? 'Peak readiness — go for it'
    : tsb >= 65 ? 'Ready to perform'
    : tsb >= 45 ? 'Building fitness — keep it steady'
    : 'Hard week — well earned rest'

  const kmThisWeek = thisWeek.reduce((sum, s) => sum + sessionKm(s), 0)
  const totalVolume = history.reduce((sum, s) =>
    sum + (s.exercises ?? []).reduce((es, ex) =>
      es + ex.actualSets.reduce((ss, set) =>
        ss + (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0), 0), 0), 0)

  // Strength PRs
  const exStats: Record<string, { totalSets: number; rm: number; weight: number; reps: number; date: string }> = {}
  const liftSessions = history.filter(s => (s.exercises ?? []).length > 0)
  for (const s of liftSessions)
    for (const ex of s.exercises ?? [])
      for (const set of ex.actualSets) {
        const w = parseFloat(set.weight), r = parseInt(set.reps)
        if (!exStats[ex.exerciseName]) exStats[ex.exerciseName] = { totalSets: 0, rm: 0, weight: 0, reps: 0, date: s.date }
        exStats[ex.exerciseName].totalSets++
        if (!isNaN(w) && !isNaN(r) && r > 0) {
          const rm = epleyRM(w, r)
          if (rm > exStats[ex.exerciseName].rm)
            exStats[ex.exerciseName] = { ...exStats[ex.exerciseName], rm, weight: w, reps: r, date: s.date }
        }
      }

  const topExercises = Object.entries(exStats)
    .sort((a, b) => b[1].totalSets - a[1].totalSets)
    .slice(0, 5).map(([name]) => name)

  const prs = Object.entries(exStats)
    .filter(([, v]) => v.rm > 0)
    .sort((a, b) => b[1].date.localeCompare(a[1].date))
    .slice(0, 5)
    .map(([exercise, { rm, weight, date }]) => ({
      exercise,
      rm: `${rm} kg est. 1RM`,
      pr: `${weight} kg`,
      date: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    }))

  // Run/hike weekly km (last 12 weeks)
  const runSessions = history.filter(s => (s.run ?? []).length > 0 || s.type === 'hike' || s.type === 'run')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const weeks: string[] = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (11 - i) * 7)
    const day = d.getDay()
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
    return d.toISOString().split('T')[0]
  })
  const byWeekRun: Record<string, SessionData[]> = {}
  for (const s of runSessions) { const wk = weekStart(s.date); (byWeekRun[wk] ??= []).push(s) }
  const weeklyKm = weeks.map(wk => ({
    week: new Date(wk + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    km: Math.round(byWeekRun[wk]?.reduce((sum, s) => sum + sessionKm(s), 0) ?? 0),
  }))

  // Run/hike type mix
  const TYPE_COLORS: Record<string, string> = {
    easy: '#4CAF50', tempo: '#F59E0B', long: '#00BFA5', interval: '#EF4444',
    recovery: '#60A5FA', warmup: '#A78BFA', cooldown: '#A78BFA', hills: '#F97316', rest: '#606060',
    hike: '#84CC16',
  }
  const typeCounts: Record<string, number> = {}
  for (const s of runSessions) {
    for (const entry of s.run ?? []) {
      if ('kind' in entry && entry.kind === 'repeat') {
        for (const lap of entry.laps) typeCounts[lap.segmentType] = (typeCounts[lap.segmentType] ?? 0) + segKm(lap) * (parseInt(entry.count) || 1)
      } else {
        const seg = entry as LoggedRunSegment
        typeCounts[seg.segmentType] = (typeCounts[seg.segmentType] ?? 0) + segKm(seg)
      }
    }
    // Count hikeKm for hike sessions that don't use run segments
    if (s.type === 'hike' && s.hikeKm && (s.run ?? []).length === 0) {
      typeCounts['hike'] = (typeCounts['hike'] ?? 0) + s.hikeKm
    }
  }
  const totalRunKm = Object.values(typeCounts).reduce((a, b) => a + b, 0)
  const runTypeMix = totalRunKm > 0
    ? Object.entries(typeCounts)
        .map(([name, km]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value: Math.round((km / totalRunKm) * 100), color: TYPE_COLORS[name] ?? '#606060' }))
        .filter(d => d.value > 0).sort((a, b) => b.value - a.value)
    : []

  // PPL / body breakdown
  const ppl:  Record<string, number> = { Push: 0, Pull: 0, Legs: 0, Core: 0, Cardio: 0 }
  const body: Record<string, number> = { Chest: 0, Back: 0, Shoulders: 0, Legs: 0, Arms: 0, Core: 0, Cardio: 0 }
  for (const s of history) {
    if (s.type === 'run' || s.type === 'hike') { ppl.Cardio += 3; body.Cardio += 3; continue }
    for (const ex of s.exercises ?? []) {
      const sets = ex.actualSets?.length || ex.plannedSets?.length || 0
      if (sets === 0) continue
      ppl[classifyPPL(ex.exerciseName)]  = (ppl[classifyPPL(ex.exerciseName)]  || 0) + sets
      body[classifyBody(ex.exerciseName)] = (body[classifyBody(ex.exerciseName)] || 0) + sets
    }
    if (s.type === 'hybrid' && (s.run ?? []).length > 0) { ppl.Cardio += 2; body.Cardio += 2 }
  }
  const PPL_COLORS:  Record<string, string> = { Push: '#C8102E', Pull: '#00BFA5', Legs: '#A78BFA', Core: '#FF9500', Cardio: '#3B82F6' }
  const BODY_COLORS: Record<string, string> = { Chest: '#C8102E', Back: '#00BFA5', Shoulders: '#FF9500', Legs: '#A78BFA', Arms: '#F472B6', Core: '#6B7280', Cardio: '#3B82F6' }
  function toSlices(counts: Record<string, number>, colors: Record<string, string>) {
    return Object.entries(counts).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a)
      .map(([label, value]) => ({ label, value, color: colors[label] ?? '#606060' }))
  }

  const liftCount = history.filter(s => (s.exercises ?? []).length > 0).length
  const runCount  = history.filter(s => (s.run ?? []).length > 0).length
  const total = liftCount + runCount || 1

  return {
    overview: {
      sessionsThisWeek: thisWeek.length,
      kmThisWeek: Math.round(kmThisWeek * 10) / 10,
      totalVolume: Math.round(totalVolume),
      tsb,
      readinessLabel,
      readinessTrend,
    },
    totalSessions: history.length,
    strengthSummary: liftSessions.length > 0 ? { topExercises, prs } : null,
    runSummary: runSessions.length > 0 || history.some(s => s.type === 'hike') ? { weeklyKm, runTypeMix } : null,
    breakdown: { pplSlices: toSlices(ppl, PPL_COLORS), bodySlices: toSlices(body, BODY_COLORS), hasData: Object.values(ppl).some(v => v > 0) },
    balance: { liftPct: Math.round((liftCount / total) * 100), runPct: Math.round((runCount / total) * 100) },
  }
}
