// Pure calculations behind the Progress page. Moved out of
// app/progress/page.tsx so they can be tested and shared by the tab
// components; formulas are unchanged unless a comment says otherwise.

import { epleyRM, classifyPPL, classifyBody, segKm, type SessionData, type LoggedRunSegment } from './computeStats'
import { exerciseVolume, type VolumeMultipliers } from './exerciseLoad'
import { footKind, footKm, hrLoad, plausibleRecording, weekStartOf, DEFAULT_STEP_GOAL } from './activity'
import { isBodyweightExercise, resolveBodyweightPct, type BwOverrides } from './bodyweight'
import { bucketIndex, shiftDays, type Bucket } from './progressRange'
import type { ZeppDay } from './recovery'

// ─── Session helpers ─────────────────────────────────────────────────────────

/** km from logged run segments only (repeats × count). */
export function runKm(s: SessionData): number {
  return (s.run ?? []).reduce((rs, entry) => {
    if ('kind' in entry && entry.kind === 'repeat')
      return rs + entry.laps.reduce((ls, l) => ls + segKm(l), 0) * (parseInt(entry.count) || 1)
    return rs + segKm(entry as LoggedRunSegment)
  }, 0)
}

export function sessionVolume(s: SessionData, mults?: VolumeMultipliers): number {
  return (s.exercises ?? []).reduce((es, ex) => es + exerciseVolume(ex.exerciseName, ex.actualSets, mults), 0)
}

export type ActivityKind = 'lift' | 'run' | 'hike' | 'walk' | 'hybrid'

/** One colour-coded kind per session: hybrid when it mixes lifting and running. */
export function activityKind(s: SessionData): ActivityKind {
  const lifts = (s.exercises ?? []).length > 0 || s.type === 'lift'
  const foot = footKind(s)
  if (s.type === 'hybrid' || (lifts && foot)) return 'hybrid'
  if (lifts) return 'lift'
  return foot ?? 'lift'
}

export const isStrengthSession = (s: SessionData) =>
  s.type === 'lift' || s.type === 'hybrid' || (s.exercises ?? []).length > 0

/** Runs and real hikes; short watch walks are daily life, not endurance training. */
export const isEnduranceSession = (s: SessionData) => {
  const k = footKind(s)
  return k === 'run' || k === 'hike'
}

const r1 = (n: number) => Math.round(n * 10) / 10

function inSpan(date: string, span?: { start: string; end: string } | null) {
  return !span || (date >= span.start && date < span.end)
}

// ─── Overview stats (header tiles + readiness estimate) ──────────────────────

export interface OverviewStats {
  sessionsThisWeek: number
  sessionDiff: number
  kmThisWeek: number
  totalVolume: number
  tsb: number
  tsbFactors: { name: string; points: number }[]
  overtrained: boolean
  readinessLabel: string
  readinessTrend: '↑' | '↓' | '→'
}

/**
 * Header stats and the training-log readiness estimate as of `today`.
 * `today` is a calendar date so the estimate can be replayed for past days
 * (the readiness trend line).
 */
export function computeOverviewStats(history: SessionData[], mults: VolumeMultipliers | undefined, today: string): OverviewStats {
  const monday = weekStartOf(today)
  const lastMonday = shiftDays(monday, -7)
  const upTo = history.filter(s => s.date <= today)

  const thisWeek = upTo.filter(s => s.date >= monday)
  const lastWeek = upTo.filter(s => s.date >= lastMonday && s.date < monday)
  const sessionsThisWeek = thisWeek.length
  const sessionDiff = sessionsThisWeek - lastWeek.length
  // On-foot km (runs + hikes). The old tile also added 1 km per 100 m climbed,
  // which made "km" disagree with every distance chart.
  const kmThisWeek = thisWeek.reduce((sum, s) => sum + footKm(s), 0)
  const totalVolume = upTo.reduce((sum, s) => sum + sessionVolume(s, mults), 0)

  // ── Readiness score: personalised, history-aware ──
  const sessionLiftLoad = (s: SessionData) => sessionVolume(s, mults) / 1000
  const sessionLoad = (s: SessionData) => sessionLiftLoad(s) + runKm(s) + (s.hikeKm ?? 0) + (s.hikeElevationM ?? 0) / 100

  const rmTimeline: Record<string, { date: string; rm: number }[]> = {}
  for (const s of upTo)
    for (const ex of s.exercises ?? [])
      for (const set of ex.actualSets) {
        const w = parseFloat(set.weight), r = parseInt(set.reps)
        if (isNaN(w) || isNaN(r) || r <= 0) continue
        ;(rmTimeline[ex.exerciseName] ??= []).push({ date: s.date, rm: r === 1 ? w : Math.round(w * (1 + r / 30)) })
      }
  for (const key in rmTimeline) rmTimeline[key].sort((a, b) => a.date.localeCompare(b.date))
  const priorBest = (name: string, before: string) => {
    let best = 0
    for (const e of rmTimeline[name] ?? []) { if (e.date >= before) break; if (e.rm > best) best = e.rm }
    return best
  }
  const intensityPct = (sessions: SessionData[]): number | null => {
    let sum = 0, reps = 0
    for (const s of sessions)
      for (const ex of s.exercises ?? []) {
        const best = priorBest(ex.exerciseName, s.date)
        if (best <= 0) continue
        for (const set of ex.actualSets) {
          const w = parseFloat(set.weight), r = parseInt(set.reps)
          if (isNaN(w) || isNaN(r) || r <= 0) continue
          sum += (w / best) * r; reps += r
        }
      }
    return reps > 0 ? (sum / reps) * 100 : null
  }

  const byWeek: Record<string, number> = {}
  for (const s of upTo) byWeek[weekStartOf(s.date)] = (byWeek[weekStartOf(s.date)] ?? 0) + sessionLoad(s)
  const weekLoads = Object.values(byWeek)
  const personalAvg = weekLoads.length ? weekLoads.reduce((a, b) => a + b, 0) / weekLoads.length : 0
  const thisWeekLoad = byWeek[monday] ?? 0
  const lastWeekLoad = byWeek[lastMonday] ?? 0

  const factors: { name: string; points: number }[] = []
  let score = personalAvg > 0 ? Math.round(65 - ((thisWeekLoad / personalAvg) - 1) * 30) : upTo.length === 0 ? 75 : 65

  const consistency = Math.min(10, Math.floor(weekLoads.filter(w => w > 0).length / 2))
  score += consistency
  if (consistency > 0) factors.push({ name: 'Consistency', points: consistency })

  const lastDate = upTo.reduce<string | null>((m, s) => (!m || s.date > m ? s.date : m), null)
  const daysSince = lastDate ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastDate}T00:00:00Z`)) / 86400000) : 0
  const rest = daysSince > 0 ? Math.min(15, daysSince * 4) : 0
  score += rest
  if (rest > 0) factors.push({ name: `${daysSince}d rest`, points: rest })

  const iThis = intensityPct(thisWeek), iLast = intensityPct(lastWeek)
  const intensityDeload = iThis !== null && iLast !== null && iLast > 0 && (iThis - iLast) / iLast < -0.1
  let overtrained = false
  if (lastWeekLoad > 0) {
    const ramp = (thisWeekLoad - lastWeekLoad) / lastWeekLoad
    const volumeDeload = ramp < -0.1
    if (ramp > 0.1 && !intensityDeload) {
      const penalty = -Math.round(Math.min(15, ramp * 30))
      score += penalty
      factors.push({ name: 'Volume spike', points: penalty })
      if (ramp > 0.3) overtrained = true
    } else if (volumeDeload || intensityDeload) {
      const bonus = volumeDeload && intensityDeload ? 8 : 5
      score += bonus
      factors.push({ name: volumeDeload && intensityDeload ? 'Full deload week (volume + intensity)' : intensityDeload ? 'Intensity deload week' : 'Volume deload week', points: bonus })
    }
  }

  const weekAgo = shiftDays(today, -7)
  const recent7 = upTo.filter(s => s.date >= weekAgo)
  const recentTotal = recent7.reduce((n, s) => n + sessionLoad(s), 0)
  const liftRatio = recentTotal > 0 ? recent7.reduce((n, s) => n + sessionLiftLoad(s), 0) / recentTotal : 0.5
  if (liftRatio >= 0.3 && liftRatio <= 0.7) { score += 5; factors.push({ name: 'Balanced training', points: 5 }) }

  const tsb = Math.max(0, Math.min(100, score))
  const lastWeekScore = personalAvg > 0 ? Math.round(65 - ((lastWeekLoad / personalAvg) - 1) * 30) : 65
  return {
    sessionsThisWeek,
    sessionDiff,
    kmThisWeek: r1(kmThisWeek),
    totalVolume: Math.round(totalVolume),
    tsb,
    tsbFactors: factors,
    overtrained,
    readinessLabel: tsb >= 80 ? 'Peak readiness — go for it' : tsb >= 65 ? 'Ready to perform' : tsb >= 45 ? 'Building fitness — keep it steady' : 'Hard week — well earned rest',
    readinessTrend: tsb > lastWeekScore + 3 ? '↑' : tsb < lastWeekScore - 3 ? '↓' : '→',
  }
}

/** Training-log readiness for each of the last `days` days (oldest first). */
export function logReadinessTrend(history: SessionData[], mults: VolumeMultipliers | undefined, today: string, days = 14) {
  return Array.from({ length: days }, (_, i) => {
    const date = shiftDays(today, i - days + 1)
    return { date, value: computeOverviewStats(history, mults, date).tsb }
  })
}

/** Watch readiness for the last `days` days (null where not scored). */
export function watchReadinessTrend(rows: ZeppDay[], today: string, days = 14) {
  const byDate = new Map(rows.map(r => [r.date, r.readiness]))
  return Array.from({ length: days }, (_, i) => {
    const date = shiftDays(today, i - days + 1)
    const v = byDate.get(date)
    return { date, value: v == null ? null : Math.round(v) }
  })
}

// ─── Last 4 weeks vs previous 4 ──────────────────────────────────────────────

export interface ProgressStats {
  sessions: { from: number; to: number; pct: number | null }
  volume: { from: number; to: number; pct: number | null }
  km: { from: number; to: number; pct: number | null }
  lifts: { name: string; from: number; to: number; pct: number | null }[]
}

export function computeProgressStats(history: SessionData[], mults: VolumeMultipliers | undefined, today: string): ProgressStats | null {
  const cut4 = shiftDays(today, -27)
  const cut8 = shiftDays(today, -55)
  const recent = history.filter(s => s.date >= cut4 && s.date <= today)
  const previous = history.filter(s => s.date >= cut8 && s.date < cut4)
  if (previous.length === 0) return null

  const sum = (arr: SessionData[], f: (s: SessionData) => number) => arr.reduce((a, s) => a + f(s), 0)
  const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null)
  const vol = (s: SessionData) => sessionVolume(s, mults)

  function bestRMs(arr: SessionData[]) {
    const out: Record<string, { rm: number; sets: number }> = {}
    for (const s of arr)
      for (const ex of s.exercises ?? []) {
        const name = (ex.exerciseName || '').trim()
        if (!name) continue
        for (const set of ex.actualSets) {
          const w = parseFloat(set.weight), r = parseInt(set.reps)
          if (isNaN(w) || isNaN(r) || w <= 0 || r <= 0) continue
          const e = (out[name] ??= { rm: 0, sets: 0 })
          e.rm = Math.max(e.rm, epleyRM(w, r)); e.sets++
        }
      }
    return out
  }
  const now = bestRMs(recent), before = bestRMs(previous)
  const lifts = Object.keys(now).filter(n => before[n])
    .sort((a, b) => (now[b].sets + before[b].sets) - (now[a].sets + before[a].sets))
    .slice(0, 3)
    .map(name => ({ name, from: Math.round(before[name].rm), to: Math.round(now[name].rm), pct: pct(now[name].rm, before[name].rm) }))

  const recentKm = sum(recent, footKm), prevKm = sum(previous, footKm)
  return {
    sessions: { from: previous.length, to: recent.length, pct: pct(recent.length, previous.length) },
    volume: { from: Math.round(sum(previous, vol)), to: Math.round(sum(recent, vol)), pct: pct(sum(recent, vol), sum(previous, vol)) },
    km: { from: r1(prevKm), to: r1(recentKm), pct: pct(recentKm, prevKm) },
    lifts,
  }
}

// ─── Bucketed series ─────────────────────────────────────────────────────────

/** Sessions grouped into each bucket (same order as `buckets`). */
export function sessionsByBucket(history: SessionData[], buckets: Bucket[]): SessionData[][] {
  const out = buckets.map(() => [] as SessionData[])
  for (const s of history) {
    const i = bucketIndex(buckets, s.date)
    if (i >= 0) out[i].push(s)
  }
  return out
}

export interface ActivityBucket {
  sessions: number
  lift: number          // tonnage, kg
  km: number            // runs + hikes + walks
  run: number; hike: number; walk: number
  hours: number; climb: number
  strengthLoad: number; cardioLoad: number   // watch HR load
  strengthSessions: number; enduranceSessions: number
}

/** Everything the bucketed charts need in one pass. */
export function activityByBucket(history: SessionData[], buckets: Bucket[], mults?: VolumeMultipliers): ActivityBucket[] {
  return sessionsByBucket(history, buckets).map(list => {
    const b: ActivityBucket = { sessions: list.length, lift: 0, km: 0, run: 0, hike: 0, walk: 0, hours: 0, climb: 0, strengthLoad: 0, cardioLoad: 0, strengthSessions: 0, enduranceSessions: 0 }
    for (const s of list) {
      b.lift += sessionVolume(s, mults)
      const kind = footKind(s)
      if (kind) { const km = footKm(s); b[kind] += km; b.km += km }
      if (kind && plausibleRecording(s)) b.hours += s.zepp!.durationMin! / 60
      b.climb += s.hikeElevationM ?? 0
      const load = plausibleRecording(s) ? hrLoad(s) : null
      if (load != null) {
        if (s.type === 'lift' || s.type === 'hybrid') b.strengthLoad += load
        else b.cardioLoad += load
      }
      if (isStrengthSession(s)) b.strengthSessions++
      if (isEnduranceSession(s)) b.enduranceSessions++
    }
    return {
      ...b, lift: Math.round(b.lift), km: r1(b.km), run: r1(b.run), hike: r1(b.hike), walk: r1(b.walk),
      hours: r1(b.hours), climb: Math.round(b.climb), strengthLoad: Math.round(b.strengthLoad), cardioLoad: Math.round(b.cardioLoad),
    }
  })
}

/** Share of strength vs endurance sessions (hybrid counts for both), 0–100, or null with no sessions. */
export function strengthShare(b: Pick<ActivityBucket, 'strengthSessions' | 'enduranceSessions'>): number | null {
  const total = b.strengthSessions + b.enduranceSessions
  return total ? Math.round((b.strengthSessions / total) * 100) : null
}

// ─── Strength ────────────────────────────────────────────────────────────────

/** Exercises ranked by total logged sets (most-trained first). */
export function exerciseRanking(history: SessionData[]): { name: string; sets: number }[] {
  const sets: Record<string, number> = {}
  for (const s of history)
    for (const ex of s.exercises ?? [])
      for (const set of ex.actualSets) {
        const w = parseFloat(set.weight), r = parseInt(set.reps)
        if (!isNaN(w) && !isNaN(r) && r > 0) sets[ex.exerciseName] = (sets[ex.exerciseName] ?? 0) + 1
      }
  return Object.entries(sets).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, sets: n }))
}

/** Best Epley e1RM per bucket for each named exercise (null where not trained). */
export function e1rmByBucket(history: SessionData[], buckets: Bucket[], names: string[]): Record<string, number | null>[] {
  const wanted = new Set(names)
  const rows = buckets.map(() => Object.fromEntries(names.map(n => [n, null as number | null])))
  for (const s of history) {
    const i = bucketIndex(buckets, s.date)
    if (i < 0) continue
    for (const ex of s.exercises ?? []) {
      if (!wanted.has(ex.exerciseName)) continue
      for (const set of ex.actualSets) {
        const w = parseFloat(set.weight), r = parseInt(set.reps)
        if (isNaN(w) || isNaN(r) || r <= 0 || w <= 0) continue
        rows[i][ex.exerciseName] = Math.max(rows[i][ex.exerciseName] ?? 0, epleyRM(w, r))
      }
    }
  }
  return rows
}

export interface LiftRecord {
  exercise: string; savedAt: string; totalSets: number
  weight: number; reps: number; rm: number; date: string
}

/** All-time best set (by Epley e1RM) per exercise, newest record first. */
export function liftRecords(history: SessionData[]): LiftRecord[] {
  const out: Record<string, LiftRecord> = {}
  for (const s of history)
    for (const ex of s.exercises ?? [])
      for (const set of ex.actualSets) {
        const key = ex.exerciseName
        const rec = (out[key] ??= { exercise: key, savedAt: s.savedAt, totalSets: 0, weight: 0, reps: 0, rm: 0, date: s.date })
        rec.totalSets++
        const w = parseFloat(set.weight), r = parseInt(set.reps)
        if (!isNaN(w) && !isNaN(r) && r > 0) {
          const rm = epleyRM(w, r)
          if (rm > rec.rm) Object.assign(rec, { rm, weight: w, reps: r, date: s.date, savedAt: s.savedAt })
        }
      }
  return Object.values(out).filter(r => r.rm > 0).sort((a, b) => b.date.localeCompare(a.date))
}

/** Next round-number target above an e1RM: 10 kg steps to 100, 20 to 200, then 25. */
export function nextMilestone(rm: number): { target: number; pct: number } {
  const step = rm < 100 ? 10 : rm < 200 ? 20 : 25
  const target = (Math.floor(rm / step) + 1) * step
  return { target, pct: Math.round((rm / target) * 100) }
}

/** Sets per body part (Chest/Back/Shoulders/Legs/Arms/Core) within a date span. */
export function bodyPartSets(history: SessionData[], span?: { start: string; end: string } | null): Record<string, number> {
  const out: Record<string, number> = { Chest: 0, Back: 0, Shoulders: 0, Legs: 0, Arms: 0, Core: 0 }
  for (const s of history) {
    if (!inSpan(s.date, span)) continue
    for (const ex of s.exercises ?? []) out[classifyBody(ex.exerciseName)] = (out[classifyBody(ex.exerciseName)] ?? 0) + ex.actualSets.length
  }
  return out
}

/** Push/Pull/Legs and body-part split for the donuts (cardio sessions weighted as before). */
export function sessionBreakdown(history: SessionData[], span?: { start: string; end: string } | null) {
  const ppl: Record<string, number> = { Push: 0, Pull: 0, Legs: 0, Core: 0, Cardio: 0 }
  const body: Record<string, number> = { Chest: 0, Back: 0, Shoulders: 0, Legs: 0, Arms: 0, Core: 0, Cardio: 0 }
  for (const s of history) {
    if (!inSpan(s.date, span)) continue
    if (s.type === 'run' || s.type === 'hike') { ppl.Cardio += 3; body.Cardio += 3; continue }
    for (const ex of s.exercises ?? []) {
      const sets = ex.actualSets?.length || ex.plannedSets?.length || 0
      if (!sets) continue
      ppl[classifyPPL(ex.exerciseName)] = (ppl[classifyPPL(ex.exerciseName)] || 0) + sets
      body[classifyBody(ex.exerciseName)] = (body[classifyBody(ex.exerciseName)] || 0) + sets
    }
    if (s.type === 'hybrid' && (s.run ?? []).length > 0) { ppl.Cardio += 2; body.Cardio += 2 }
  }
  const PPL_COLORS: Record<string, string> = { Push: '#C8102E', Pull: '#00BFA5', Legs: '#A78BFA', Core: '#FF9500', Cardio: '#3B82F6' }
  const BODY_COLORS: Record<string, string> = { Chest: '#C8102E', Back: '#00BFA5', Shoulders: '#FF9500', Legs: '#A78BFA', Arms: '#F472B6', Core: '#6B7280', Cardio: '#3B82F6' }
  const slices = (counts: Record<string, number>, colors: Record<string, string>) =>
    Object.entries(counts).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a).map(([label, value]) => ({ label, value, color: colors[label] ?? '#606060' }))
  return { pplSlices: slices(ppl, PPL_COLORS), bodySlices: slices(body, BODY_COLORS), hasData: Object.values(ppl).some(v => v > 0) }
}

// ─── Per-exercise analysis (History → Exercises) ─────────────────────────────

/**
 * Per-exercise RM table + charts. Estimates are bodyweight- and RPE-aware:
 *  • Bodyweight moves use load = bodyweight × share + added weight.
 *  • RPE is read as reps-in-reserve (RIR = 10 − RPE).
 * Missing rep counts are interpolated between logged points, or extrapolated
 * along the prediction curve.
 */
export function exerciseAnalysis(history: SessionData[], bodyweight: number, bwOverrides: BwOverrides, today: string) {
  const epley = (load: number, effReps: number) => (effReps <= 1 ? load : load * (1 + effReps / 30))
  type RawSet = { reps: number; weight: number; rpe: number; date: string }
  const byExercise: Record<string, RawSet[]> = {}
  for (const s of history)
    for (const ex of s.exercises ?? [])
      for (const set of ex.actualSets) {
        const r = parseInt(set.reps)
        if (isNaN(r) || r <= 0) continue
        ;(byExercise[ex.exerciseName] ??= []).push({ reps: r, weight: parseFloat(set.weight), rpe: parseFloat(set.rpe), date: s.date })
      }

  const REPS = Array.from({ length: 12 }, (_, i) => i + 1)
  const dayIdx = (d: string) => Math.round(Date.parse(`${d}T00:00:00Z`) / 86400000)
  const todayIdx = dayIdx(today)

  return Object.entries(byExercise).map(([name, raws]) => {
    const category = classifyPPL(name)
    const zeroCount = raws.filter(x => isNaN(x.weight) || x.weight <= 0).length
    const bodyweightBased = isBodyweightExercise(name) || zeroCount / raws.length >= 0.5
    const pct = resolveBodyweightPct(name, bwOverrides)
    const sets = raws.flatMap(x => {
      const added = isNaN(x.weight) ? 0 : Math.max(0, x.weight)
      const load = bodyweightBased ? bodyweight * (pct / 100) + added : x.weight
      if (isNaN(load) || load <= 0) return []
      const rir = !isNaN(x.rpe) && x.rpe > 0 && x.rpe < 10 ? Math.max(0, 10 - x.rpe) : 0
      return [{ reps: x.reps, load, date: x.date, est1RM: epley(load, x.reps + rir) }]
    })
    if (sets.length === 0) return null

    let best = sets[0]
    for (const s of sets) if (s.est1RM > best.est1RM) best = s
    const best1RM = best.est1RM
    const predicted = (n: number) => (n === 1 ? best1RM : best1RM / (1 + n / 30))

    const anchorMap: Record<number, { load: number; date: string }> = {}
    for (const s of sets) if (!anchorMap[s.reps] || s.load > anchorMap[s.reps].load) anchorMap[s.reps] = { load: s.load, date: s.date }
    const anchorReps = Object.keys(anchorMap).map(Number).sort((a, b) => a - b)

    const rows = REPS.map(n => {
      const predWeight = Math.round(predicted(n))
      const anchor = anchorMap[n]
      if (anchor) return { rep: n, predicted: predWeight, logged: Math.round(anchor.load), loggedDate: anchor.date as string | null, loggedKind: 'actual' as 'actual' | 'interp' | 'extrap' }
      const lower = [...anchorReps].reverse().find(r => r < n)
      const higher = anchorReps.find(r => r > n)
      let logged: number | null = null
      let loggedKind: 'interp' | 'extrap' = 'interp'
      if (lower !== undefined && higher !== undefined) {
        const wl = anchorMap[lower].load, wh = anchorMap[higher].load
        logged = wl + (wh - wl) * ((n - lower) / (higher - lower))
      } else {
        const nearest = lower ?? higher
        if (nearest !== undefined) { logged = anchorMap[nearest].load * (predicted(n) / predicted(nearest)); loggedKind = 'extrap' }
      }
      return { rep: n, predicted: predWeight, logged: logged === null ? null : Math.round(logged), loggedDate: null as string | null, loggedKind: loggedKind as 'actual' | 'interp' | 'extrap' }
    })

    const byDate: Record<string, number> = {}
    const volByDate: Record<string, number> = {}
    for (const s of sets) {
      byDate[s.date] = Math.max(byDate[s.date] ?? 0, s.est1RM)
      volByDate[s.date] = (volByDate[s.date] ?? 0) + s.load * s.reps
    }
    const trendRaw = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0])).map(([date, e1rm]) => ({ date, e1rm: Math.round(e1rm) }))

    let trend = trendRaw.map(t => ({ ...t, fit: null as number | null }))
    if (trendRaw.length >= 2) {
      const xs = trendRaw.map(t => dayIdx(t.date)), ys = trendRaw.map(t => t.e1rm)
      const x0 = xs[0], n = xs.length
      const sx = xs.reduce((a, x) => a + (x - x0), 0)
      const sy = ys.reduce((a, y) => a + y, 0)
      const sxx = xs.reduce((a, x) => a + (x - x0) ** 2, 0)
      const sxy = xs.reduce((a, x, i) => a + (x - x0) * ys[i], 0)
      const denom = n * sxx - sx * sx
      const slope = denom !== 0 ? (n * sxy - sx * sy) / denom : 0
      const intercept = (sy - slope * sx) / n
      trend = trendRaw.map((t, i) => ({ ...t, fit: Math.round(intercept + slope * (xs[i] - x0)) }))
    }
    const volumeTrend = Object.entries(volByDate).sort((a, b) => a[0].localeCompare(b[0])).map(([date, volume]) => ({ date, volume: Math.round(volume) }))

    const firstDate = trendRaw[0]?.date ?? best.date
    const lastDate = trendRaw.length ? trendRaw[trendRaw.length - 1].date : best.date
    const daysSince = todayIdx - dayIdx(lastDate)
    const spanWeeks = Math.max(1, (dayIdx(lastDate) - dayIdx(firstDate)) / 7)
    const prValue = Math.max(...trendRaw.map(t => t.e1rm))
    const prDate = trendRaw.find(t => t.e1rm === prValue)?.date ?? lastDate
    let pctGain: number | null = null, gainWeeks = 0
    if (trendRaw.length >= 2) {
      const lastIdx = dayIdx(lastDate)
      const base = trendRaw.find(t => lastIdx - dayIdx(t.date) <= 56) ?? trendRaw[0]
      if (base && base.e1rm > 0 && base.date !== lastDate) {
        pctGain = Math.round(((trendRaw[trendRaw.length - 1].e1rm - base.e1rm) / base.e1rm) * 1000) / 10
        gainWeeks = Math.round((lastIdx - dayIdx(base.date)) / 7)
      }
    }
    return {
      name, category, bodyweightBased, bwPct: Math.round(pct),
      totalSets: sets.length, realReps: anchorReps.length,
      best1RM: Math.round(best1RM), sourceReps: best.reps, sourceDate: best.date,
      firstDate, lastDate, daysSince,
      setsPerWeek: Math.round((sets.length / spanWeeks) * 10) / 10,
      stale: daysSince > 21,
      prValue, prDate, pctGain, gainWeeks,
      plateau: trendRaw.length >= 3 && dayIdx(lastDate) - dayIdx(prDate) >= 28,
      rows, trend,
      curve: rows.map(r => ({ rep: r.rep, predicted: r.predicted, logged: r.logged })),
      volumeTrend,
    }
  }).filter((e): e is NonNullable<typeof e> => e !== null).sort((a, b) => b.totalSets - a.totalSets)
}

export type ExerciseStat = ReturnType<typeof exerciseAnalysis>[number]

// ─── Running ─────────────────────────────────────────────────────────────────

export const RUN_TYPE_COLORS: Record<string, string> = {
  easy: '#4CAF50', tempo: '#F59E0B', long: '#00BFA5', interval: '#EF4444', recovery: '#60A5FA',
  warmup: '#A78BFA', cooldown: '#A78BFA', hills: '#F97316', rest: '#606060',
}

/** km per run-segment type in each bucket, as a share of that bucket's total (0–100). */
export function runTypeByBucket(history: SessionData[], buckets: Bucket[]): { types: string[]; rows: Record<string, number>[] } {
  const raw = buckets.map(() => ({} as Record<string, number>))
  const seen = new Set<string>()
  for (const s of history) {
    const i = bucketIndex(buckets, s.date)
    if (i < 0) continue
    for (const entry of s.run ?? []) {
      const segs = 'kind' in entry && entry.kind === 'repeat'
        ? entry.laps.map(l => [l, parseInt(entry.count) || 1] as const)
        : [[entry as LoggedRunSegment, 1] as const]
      for (const [seg, n] of segs) {
        const km = segKm(seg) * n
        if (!km || seg.segmentType === 'rest') continue
        const t = (seg.segmentType || 'easy').toLowerCase()
        raw[i][t] = (raw[i][t] ?? 0) + km
        seen.add(t)
      }
    }
  }
  const order = Object.keys(RUN_TYPE_COLORS)
  const types = [...seen].sort((a, b) => (order.indexOf(a) + 99 * +(order.indexOf(a) < 0)) - (order.indexOf(b) + 99 * +(order.indexOf(b) < 0)))
  const rows = raw.map(r => {
    const total = Object.values(r).reduce((a, b) => a + b, 0)
    return Object.fromEntries(types.map(t => [t, total ? Math.round(((r[t] ?? 0) / total) * 1000) / 10 : 0]))
  })
  return { types, rows }
}

export const KEY_DISTANCES = [
  { label: '1K', km: 1, tol: 0.15 },
  { label: '1.6 km', km: 1.6, tol: 0.2 },
  { label: '5 km', km: 5, tol: 0.6 },
  { label: '10 km', km: 10, tol: 1.0 },
  { label: 'Half Marathon', km: 21.0975, tol: 1.5 },
  { label: 'Marathon', km: 42.195, tol: 2.5 },
]

export function fmtClock(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = Math.round(totalSecs % 60)
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

export function fmtPaceSecs(secsPerKm: number): string {
  const s = Math.round(secsPerKm)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export interface RunRecord {
  label: string; km: number; paceSecs: number; pace: string; timeSecs: number; date: string; savedAt: string
}

const paceToSecs = (pace: string) => {
  const [m, s] = pace.split(':').map(Number)
  return (m || 0) * 60 + (s || 0)
}

/** Fastest logged distance segment near each key distance, plus the longest run. */
export function runRecords(history: SessionData[]): { records: RunRecord[]; longest: RunRecord | null } {
  const segs: { km: number; paceSecs: number; pace: string; date: string; savedAt: string }[] = []
  for (const s of history)
    for (const entry of s.run ?? []) {
      const list = 'kind' in entry && entry.kind === 'repeat'
        ? entry.laps.flatMap(l => Array(parseInt(entry.count) || 1).fill(l) as LoggedRunSegment[])
        : [entry as LoggedRunSegment]
      for (const seg of list) {
        if (seg.metric !== 'distance' || !seg.actualPace || !seg.actualValue) continue
        const km = parseFloat(seg.actualValue)
        const paceSecs = paceToSecs(seg.actualPace)
        if (km && paceSecs) segs.push({ km, paceSecs, pace: seg.actualPace, date: s.date, savedAt: s.savedAt })
      }
    }
  const records: RunRecord[] = []
  for (const kd of KEY_DISTANCES) {
    const matches = segs.filter(r => Math.abs(r.km - kd.km) <= kd.tol)
    if (!matches.length) continue
    const best = matches.reduce((a, b) => (a.paceSecs < b.paceSecs ? a : b))
    records.push({ label: kd.label, km: kd.km, paceSecs: best.paceSecs, pace: best.pace, timeSecs: best.paceSecs * kd.km, date: best.date, savedAt: best.savedAt })
  }
  const long = segs.reduce<(typeof segs)[number] | null>((a, b) => (!a || b.km > a.km ? b : a), null)
  const longest = long ? { label: `Longest (${long.km % 1 === 0 ? long.km : long.km.toFixed(1)} km)`, km: long.km, paceSecs: long.paceSecs, pace: long.pace, timeSecs: long.paceSecs * long.km, date: long.date, savedAt: long.savedAt } : null
  return { records, longest }
}

/**
 * Riegel race-time predictions (T2 = T1 × (D2/D1)^1.06) for each key distance,
 * each from the record whose distance is closest on a log scale.
 */
export function predictRaceTimes(records: RunRecord[]): { label: string; km: number; predictedSecs: number; fromLabel: string }[] {
  if (!records.length) return []
  return KEY_DISTANCES.map(kd => {
    const anchor = records.reduce((a, b) => (Math.abs(Math.log(b.km / kd.km)) < Math.abs(Math.log(a.km / kd.km)) ? b : a))
    return { label: kd.label, km: kd.km, predictedSecs: anchor.timeSecs * Math.pow(kd.km / anchor.km, 1.06), fromLabel: anchor.label }
  })
}

export interface PrEvent { date: string; name: string; kind: 'lift' | 'run'; value: string; pct: number; savedAt: string }

/**
 * Every time a record improved: a lift's best e1RM, or the best pace near a
 * key distance. The first time something is logged is not counted.
 */
export function prEvents(history: SessionData[]): PrEvent[] {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date) || a.savedAt.localeCompare(b.savedAt))
  const liftBest: Record<string, number> = {}
  const runBest: Record<string, number> = {}
  const out: PrEvent[] = []
  for (const s of sorted) {
    const sessionLift: Record<string, number> = {}
    for (const ex of s.exercises ?? [])
      for (const set of ex.actualSets) {
        const w = parseFloat(set.weight), r = parseInt(set.reps)
        if (isNaN(w) || isNaN(r) || r <= 0 || w <= 0) continue
        sessionLift[ex.exerciseName] = Math.max(sessionLift[ex.exerciseName] ?? 0, epleyRM(w, r))
      }
    for (const [name, rm] of Object.entries(sessionLift)) {
      const prev = liftBest[name]
      if (prev !== undefined && rm > prev) out.push({ date: s.date, name, kind: 'lift', value: `${rm} kg e1RM`, pct: Math.round(((rm - prev) / prev) * 1000) / 10, savedAt: s.savedAt })
      if (prev === undefined || rm > prev) liftBest[name] = rm
    }
    const { records } = runRecords([s])
    for (const rec of records) {
      const prev = runBest[rec.label]
      if (prev !== undefined && rec.paceSecs < prev) out.push({ date: s.date, name: rec.label, kind: 'run', value: `${rec.pace}/km`, pct: Math.round(((prev - rec.paceSecs) / prev) * 1000) / 10, savedAt: s.savedAt })
      if (prev === undefined || rec.paceSecs < prev) runBest[rec.label] = rec.paceSecs
    }
  }
  return out
}

/** Pace vs average HR for watch-recorded runs, hikes and walks (1 km+). */
export function paceHrPoints(history: SessionData[], span?: { start: string; end: string } | null) {
  return history.flatMap(s => {
    const kind = footKind(s)
    const z = s.zepp
    if (!kind || !inSpan(s.date, span) || !z?.avgHr || !z.distanceKm || z.distanceKm < 1 || !plausibleRecording(s)) return []
    const pace = (z.movingMin ?? z.durationMin!) / z.distanceKm
    return [{ date: s.date, name: s.name, savedAt: s.savedAt, kind, pace: Math.round(pace * 100) / 100, hr: z.avgHr, km: z.distanceKm }]
  })
}

// ─── Streaks ─────────────────────────────────────────────────────────────────

/** Consecutive weeks with at least one session: current (this week or, if empty so far, from last week) and longest. */
export function weekStreaks(dates: string[], today: string): { current: number; longest: number } {
  const weeks = new Set(dates.filter(d => d <= today).map(weekStartOf))
  let start = weekStartOf(today)
  if (!weeks.has(start)) start = shiftDays(start, -7)
  let current = 0
  for (let w = start; weeks.has(w); w = shiftDays(w, -7)) current++
  let longest = 0, run = 0, prev: string | null = null
  for (const w of [...weeks].sort()) {
    run = prev && shiftDays(prev, 7) === w ? run + 1 : 1
    longest = Math.max(longest, run)
    prev = w
  }
  return { current, longest }
}

/** Consecutive days at the step goal ending today (or yesterday while today is in progress), and the longest run. */
export function goalStreaks(rows: ZeppDay[], today: string): { current: number; longest: number } {
  const hit = new Set(rows.filter(r => r.date <= today && r.steps != null && r.steps >= (r.step_goal || DEFAULT_STEP_GOAL)).map(r => r.date))
  let d = hit.has(today) ? today : shiftDays(today, -1)
  let current = 0
  while (hit.has(d)) { current++; d = shiftDays(d, -1) }
  let longest = 0, run = 0, prev: string | null = null
  for (const day of [...hit].sort()) {
    run = prev && shiftDays(prev, 1) === day ? run + 1 : 1
    longest = Math.max(longest, run)
    prev = day
  }
  return { current, longest }
}

// ─── Weekly summary (Weekly Review card) ─────────────────────────────────────

/** The kind to show for a day with these sessions: walks only count when nothing else was done. */
export function dayKind(kinds: Set<ActivityKind>): ActivityKind | null {
  if (!kinds.size) return null
  if (kinds.has('hybrid')) return 'hybrid'
  const main = [...kinds].filter(k => k !== 'walk')
  if (!main.length) return 'walk'
  if (main.includes('lift') && (main.includes('run') || main.includes('hike'))) return 'hybrid'
  return main.includes('run') ? 'run' : main[0]
}

export interface WeekSummary {
  start: string; end: string
  sessions: number; liftKg: number; km: number; climb: number
  days: (ActivityKind | null)[]       // Mon..Sun, the dominant kind trained that day
  records: PrEvent[]
}

export function weekSummary(history: SessionData[], mults: VolumeMultipliers | undefined, weekStart: string): WeekSummary {
  const end = shiftDays(weekStart, 7)
  const list = history.filter(s => s.date >= weekStart && s.date < end)
  const kinds = Array.from({ length: 7 }, () => new Set<ActivityKind>())
  for (const s of list) {
    const i = Math.round((Date.parse(`${s.date}T00:00:00Z`) - Date.parse(`${weekStart}T00:00:00Z`)) / 86400000)
    if (i >= 0 && i < 7) kinds[i].add(activityKind(s))
  }
  const days = kinds.map(dayKind)
  return {
    start: weekStart, end,
    sessions: list.length,
    liftKg: Math.round(list.reduce((n, s) => n + sessionVolume(s, mults), 0)),
    km: r1(list.reduce((n, s) => n + footKm(s), 0)),
    climb: Math.round(list.reduce((n, s) => n + (s.hikeElevationM ?? 0), 0)),
    days,
    records: prEvents(history).filter(e => e.date >= weekStart && e.date < end),
  }
}
