// Pure logic for the Progress Steps / On Foot / Hybrid-load views, built on
// zepp_daily rows and Zepp-enriched sessions. See ZEPP_INSIGHTS_PLAN.md R1–R4.

import { segKm, type SessionData, type LoggedRunSegment } from './computeStats'
import type { ZeppDay } from './recovery'

// ─── Shared date helpers ─────────────────────────────────────────────────────

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Monday of the week containing `date` (YYYY-MM-DD). */
export function weekStartOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  const dow = d.getUTCDay()
  return shiftDate(date, dow === 0 ? -6 : 1 - dow)
}

const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null)
const r0 = (n: number | null) => (n == null ? null : Math.round(n))
const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10)

// ─── Steps ───────────────────────────────────────────────────────────────────

export const DEFAULT_STEP_GOAL = 10000

export interface StepsSummary {
  today: number | null
  avg7: number | null
  avg30: number | null
  monthAvg: number | null
  yearAvg: number | null
  totalSteps: number
  totalKm: number
  daysTracked: number
  goalHitPct: number | null   // share of tracked days at or above that day's goal
  best: { date: string; steps: number } | null
}

const stepDays = (rows: ZeppDay[], today: string) => rows.filter(r => r.steps != null && r.steps > 0 && r.date <= today)

export function stepsSummary(rows: ZeppDay[], today: string): StepsSummary {
  const days = stepDays(rows, today)
  const avgSince = (from: string) => r0(mean(days.filter(r => r.date >= from).map(r => r.steps!)))
  const hits = days.filter(r => r.steps! >= (r.step_goal || DEFAULT_STEP_GOAL)).length
  const best = days.reduce<ZeppDay | null>((a, b) => (!a || b.steps! > a.steps! ? b : a), null)
  return {
    today: days.find(r => r.date === today)?.steps ?? null,
    avg7: avgSince(shiftDate(today, -6)),
    avg30: avgSince(shiftDate(today, -29)),
    monthAvg: avgSince(`${today.slice(0, 7)}-01`),
    yearAvg: avgSince(`${today.slice(0, 4)}-01-01`),
    totalSteps: days.reduce((n, r) => n + r.steps!, 0),
    totalKm: Math.round(days.reduce((n, r) => n + (r.distance_m ?? 0), 0) / 100) / 10,
    daysTracked: days.length,
    goalHitPct: days.length ? Math.round((hits / days.length) * 100) : null,
    best: best ? { date: best.date, steps: best.steps! } : null,
  }
}

export interface StepsPeriod { key: string; avg: number; total: number; km: number; days: number }

function groupSteps(days: ZeppDay[], keyOf: (date: string) => string): StepsPeriod[] {
  const map = new Map<string, ZeppDay[]>()
  for (const r of days) {
    const k = keyOf(r.date)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(r)
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, list]) => {
    const total = list.reduce((n, r) => n + r.steps!, 0)
    return { key, avg: Math.round(total / list.length), total, km: r1(list.reduce((n, r) => n + (r.distance_m ?? 0), 0) / 1000)!, days: list.length }
  })
}

/** Weekly (Monday-start) step averages for the last `weeks` weeks. */
export function weeklySteps(rows: ZeppDay[], today: string, weeks = 26): StepsPeriod[] {
  const from = shiftDate(weekStartOf(today), -7 * (weeks - 1))
  return groupSteps(stepDays(rows, today).filter(r => r.date >= from), weekStartOf)
}

/** Monthly step averages and totals (YYYY-MM keys). */
export function monthlySteps(rows: ZeppDay[], today: string): StepsPeriod[] {
  return groupSteps(stepDays(rows, today), d => d.slice(0, 7))
}

// ─── On foot (runs, hikes, walks) ────────────────────────────────────────────

export type FootKind = 'run' | 'hike' | 'walk'

export const FOOT_KIND_LABEL: Record<FootKind, string> = { run: 'Runs', hike: 'Hikes', walk: 'Walks' }

/** Distance on foot for a session (run segments + hike/walk km). */
export function footKm(s: SessionData): number {
  const runKm = (s.run ?? []).reduce((sum, entry) => {
    if ('kind' in entry && entry.kind === 'repeat')
      return sum + entry.laps.reduce((ls, l) => ls + segKm(l), 0) * (parseInt(entry.count) || 1)
    return sum + segKm(entry as LoggedRunSegment)
  }, 0)
  return runKm + (s.hikeKm ?? 0)
}

/**
 * Runs: run sessions or anything with run segments. Hikes: hike sessions of
 * 5 km+ or 150 m+ climb, or logged by hand. Walks: shorter watch walks.
 */
export function footKind(s: SessionData): FootKind | null {
  if (s.type === 'run' || (s.run ?? []).length > 0) return 'run'
  if (s.type !== 'hike') return null
  if (s.source !== 'zepp') return 'hike'
  return (s.hikeKm ?? 0) >= 5 || (s.hikeElevationM ?? 0) >= 150 ? 'hike' : 'walk'
}

/**
 * Whether a watch recording's timing can be trusted: walks/hikes between 8 and
 * 40 min/km (runs 3–12) on the watch's own distance, at most 10 h, and not a
 * near-zero cadence. Catches recordings left running for hours, GPS jumps or
 * vehicle travel, and manual km paired with a partial watch recording.
 * Untrusted recordings still count for distance/climb, never for time, pace,
 * cadence or HR load.
 */
export function plausibleRecording(s: SessionData): boolean {
  const z = s.zepp
  if (!z?.durationMin) return false
  if (z.durationMin > 600) return false
  if (z.avgCadenceSpm != null && z.avgCadenceSpm < 40 && s.type !== 'lift' && s.type !== 'hybrid') return false
  const kind = footKind(s)
  const km = z.distanceKm
  if (!kind || !km) return true
  const pace = (z.movingMin ?? z.durationMin) / km
  return kind === 'run' ? pace >= 3 && pace <= 12 : pace >= 8 && pace <= 40
}

export interface FootWeek { week: string; run: number; hike: number; walk: number; hours: number; climb: number }

export function weeklyOnFoot(sessions: SessionData[], today: string, weeks = 12): FootWeek[] {
  const first = shiftDate(weekStartOf(today), -7 * (weeks - 1))
  const out = new Map<string, FootWeek>()
  for (let i = 0; i < weeks; i++) {
    const wk = shiftDate(first, 7 * i)
    out.set(wk, { week: wk, run: 0, hike: 0, walk: 0, hours: 0, climb: 0 })
  }
  // Accumulate raw values; round once at the end so rounding errors don't add up.
  for (const s of sessions) {
    const kind = footKind(s)
    const w = kind && out.get(weekStartOf(s.date))
    if (!w) continue
    w[kind!] += footKm(s)
    if (plausibleRecording(s)) w.hours += s.zepp!.durationMin! / 60
    w.climb += s.hikeElevationM ?? 0
  }
  return [...out.values()].map(w => ({ ...w, run: r1(w.run)!, hike: r1(w.hike)!, walk: r1(w.walk)!, hours: r1(w.hours)! }))
}

export interface FootRecord { label: string; value: string; date: string; name: string }

export function footRecords(sessions: SessionData[]): FootRecord[] {
  const foot = sessions.filter(s => footKind(s))
  const best = <T,>(pick: (s: SessionData) => T | null, better: (a: T, b: T) => boolean) => {
    let top: { s: SessionData; v: T } | null = null
    for (const s of foot) {
      const v = pick(s)
      if (v != null && (!top || better(v, top.v))) top = { s, v }
    }
    return top
  }
  const out: FootRecord[] = []
  const longest = best(s => footKm(s) || null, (a, b) => a > b)
  if (longest) out.push({ label: 'Longest distance', value: `${r1(longest.v)} km`, date: longest.s.date, name: longest.s.name })
  const climb = best(s => s.hikeElevationM || null, (a, b) => a > b)
  if (climb) out.push({ label: 'Most climbing', value: `${climb.v} m`, date: climb.s.date, name: climb.s.name })
  const time = best(s => (plausibleRecording(s) && s.zepp?.durationMin) || null, (a, b) => a > b)
  if (time) out.push({ label: 'Longest time', value: `${Math.floor(time.v / 60)}h ${String(time.v % 60).padStart(2, '0')}m`, date: time.s.date, name: time.s.name })
  // Fastest average moving pace over 5 km+ (min/km).
  const pace = best(s => {
    const km = s.zepp?.distanceKm ?? 0, min = s.zepp?.movingMin ?? s.zepp?.durationMin
    return plausibleRecording(s) && km >= 5 && min ? min / km : null
  }, (a, b) => a < b)
  if (pace) out.push({ label: 'Fastest pace (5 km+)', value: `${Math.floor(pace.v)}:${String(Math.round((pace.v % 1) * 60)).padStart(2, '0')} /km`, date: pace.s.date, name: pace.s.name })
  return out
}

export interface FootMonth { month: string; avgHr: number | null; paceMinKm: number | null; cadence: number | null; strideCm: number | null; sessions: number }

/**
 * Monthly efficiency for watch-recorded walks/hikes of 3 km+: average HR,
 * moving pace, cadence and stride (duration-weighted). Same pace at a lower
 * HR over time = a fitter aerobic engine.
 */
export function footEfficiencyByMonth(sessions: SessionData[]): FootMonth[] {
  const map = new Map<string, SessionData[]>()
  for (const s of sessions) {
    const k = footKind(s)
    if ((k !== 'hike' && k !== 'walk') || !plausibleRecording(s) || (s.zepp!.distanceKm ?? 0) < 3) continue
    const m = s.date.slice(0, 7)
    if (!map.has(m)) map.set(m, [])
    map.get(m)!.push(s)
  }
  const weighted = (list: SessionData[], pick: (s: SessionData) => number | null | undefined) => {
    let num = 0, den = 0
    for (const s of list) {
      const v = pick(s), w = s.zepp!.durationMin!
      if (v) { num += v * w; den += w }
    }
    return den ? num / den : null
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, list]) => {
    const km = list.reduce((n, s) => n + s.zepp!.distanceKm!, 0)
    const min = list.reduce((n, s) => n + (s.zepp!.movingMin ?? s.zepp!.durationMin!), 0)
    return {
      month,
      avgHr: r0(weighted(list, s => s.zepp?.avgHr)),
      paceMinKm: km ? r1(min / km) : null,
      cadence: r0(weighted(list, s => s.zepp?.avgCadenceSpm)),
      strideCm: r0(weighted(list, s => s.zepp?.avgStrideCm)),
      sessions: list.length,
    }
  })
}

// ─── Hybrid: one load unit for lifting and cardio ────────────────────────────

/**
 * Heart-rate load: minutes in each watch HR zone × zone weight (1 for the
 * lowest zone … 6 for the highest) — a TRIMP-style score that puts a lifting
 * session and a hike on the same scale.
 */
export function hrLoad(s: SessionData): number | null {
  const zones = s.zepp?.hrZones
  if (!zones?.length) return null
  return Math.round(zones.reduce((n, z, i) => n + (z.seconds / 60) * (i + 1), 0))
}

export interface HybridLoadWeek { week: string; strength: number; cardio: number }

export function weeklyHybridLoad(sessions: SessionData[], today: string, weeks = 12): HybridLoadWeek[] {
  const first = shiftDate(weekStartOf(today), -7 * (weeks - 1))
  const out = new Map<string, HybridLoadWeek>()
  for (let i = 0; i < weeks; i++) {
    const wk = shiftDate(first, 7 * i)
    out.set(wk, { week: wk, strength: 0, cardio: 0 })
  }
  for (const s of sessions) {
    const load = plausibleRecording(s) ? hrLoad(s) : null
    const w = load != null ? out.get(weekStartOf(s.date)) : undefined
    if (!w) continue
    if (s.type === 'lift' || s.type === 'hybrid') w.strength += load!
    else w.cardio += load!
  }
  return [...out.values()]
}

// ─── Prefill values for Tools / Profile (R10, R12) ───────────────────────────

export interface WatchDefaults {
  restingHr: number | null          // 7-day average
  bodyweightKg: number | null       // latest scale reading
  activity: 'light' | 'moderate' | 'heavy' | null  // from 30-day average steps
  avgSteps: number | null
}

export function watchDefaults(rows: ZeppDay[], today: string): WatchDefaults {
  const last = (days: number) => rows.filter(r => r.date > shiftDate(today, -days) && r.date <= today)
  const rhr = mean(last(7).map(r => r.resting_hr ?? r.sleep_rhr).filter((v): v is number => v != null))
  const steps = mean(last(30).map(r => r.steps).filter((v): v is number => v != null && v > 0))
  const weight = [...rows].reverse().find(r => r.weight_kg != null && r.date <= today)
  return {
    restingHr: r0(rhr),
    bodyweightKg: weight?.weight_kg ?? null,
    activity: steps == null ? null : steps < 8000 ? 'light' : steps <= 14000 ? 'moderate' : 'heavy',
    avgSteps: r0(steps),
  }
}

// ─── AI prompts: watch context (R7) ──────────────────────────────────────────

/**
 * WATCH DATA block for the AI programme generator / review / revamp: the last
 * 4 weeks of recovery, typical on-foot volume, steps and scale weight, so
 * plans start from the athlete's real recovery and everyday activity.
 * Returns '' without watch data.
 */
export function watchContextToPrompt(rows: ZeppDay[], sessions: SessionData[], today: string): string {
  const from = shiftDate(today, -27)
  const recent = rows.filter(r => r.date >= from && r.date <= today)
  if (!recent.some(r => r.readiness != null || r.steps != null)) return ''
  const avg = (k: keyof ZeppDay) => mean(recent.map(r => r[k] as number | null).filter((v): v is number => v != null))
  const lines: string[] = ['WATCH DATA (Zepp, last 4 weeks — use it to set realistic starting load):']

  const readiness = avg('readiness')
  const latest = [...recent].reverse().find(r => r.readiness != null)
  if (readiness != null) lines.push(`- Readiness avg ${Math.round(readiness)}/100${latest ? `; latest ${Math.round(latest.readiness!)} (${latest.date})` : ''}`)
  const hrv = avg('sleep_hrv_ms'), hrvBase = avg('hrv_baseline_ms')
  if (hrv != null && hrvBase) lines.push(`- Overnight HRV avg ${Math.round(hrv)} ms vs baseline ${Math.round(hrvBase)} ms`)
  const rhr = avg('sleep_rhr'), rhrBase = avg('rhr_baseline')
  if (rhr != null && rhrBase) lines.push(`- Sleeping HR avg ${Math.round(rhr)} bpm vs baseline ${Math.round(rhrBase)}`)
  const sleep = avg('sleep_min')
  if (sleep != null) lines.push(`- Sleep avg ${r1(sleep / 60)} h/night`)
  const steps = avg('steps')
  if (steps != null) lines.push(`- Daily steps avg ${Math.round(steps).toLocaleString('en-US')}`)

  const weeks = weeklyOnFoot(sessions, today, 4)
  const km = mean(weeks.map(w => w.run + w.hike + w.walk)), hours = mean(weeks.map(w => w.hours))
  const climb = mean(weeks.map(w => w.climb))
  if (km) lines.push(`- On foot (hikes/walks/runs): avg ${r1(km)} km, ${r1(hours)} h and ${Math.round(climb ?? 0)} m climb per week — count this as existing aerobic/leg load`)

  const weight = [...rows].reverse().find(r => r.weight_kg != null && r.date <= today)
  if (weight) lines.push(`- Bodyweight (smart scale): ${weight.weight_kg} kg on ${weight.date}`)
  return lines.join('\n')
}

// ─── Load warning (R3) ───────────────────────────────────────────────────────

export type LoadStatus =
  | { kind: 'none' }
  | { kind: 'warn'; reason: string }        // load up AND recovery down
  | { kind: 'coping'; reason: string }      // load up, recovering fine
  | { kind: 'recovery-low'; reason: string } // recovery down without a load spike

/**
 * Combines the training-log volume spike with watch load and recovery: only a
 * load increase *with* falling recovery is a real warning.
 * Returns null when there is no recent watch data (caller keeps the old rule).
 */
export function assessLoad(rows: ZeppDay[], today: string, volumeSpike: boolean): LoadStatus | null {
  const week = rows.filter(r => r.date > shiftDate(today, -7) && r.date <= today)
  const prior = rows.filter(r => r.date > shiftDate(today, -35) && r.date <= shiftDate(today, -7))
  if (!week.some(r => r.readiness != null)) return null

  const avg = (list: ZeppDay[], k: keyof ZeppDay) => mean(list.map(r => r[k] as number | null).filter((v): v is number => v != null))
  const loadNow = avg(week, 'training_load'), loadBefore = avg(prior, 'training_load')
  const loadRamp = loadNow != null && loadBefore ? loadNow / loadBefore - 1 : null
  const loadUp = volumeSpike || (loadRamp != null && loadRamp >= 0.3)

  const rNow = avg(week, 'readiness'), rBefore = avg(prior, 'readiness')
  const hrvLow = week.filter(r => r.sleep_hrv_ms != null && r.hrv_baseline_ms && r.sleep_hrv_ms < r.hrv_baseline_ms * 0.9).length
  const rhrNow = avg(week, 'sleep_rhr'), rhrBase = avg(week, 'rhr_baseline')
  const signs: string[] = []
  if (rNow != null && rBefore != null && rNow <= rBefore - 5) signs.push(`readiness ${Math.round(rNow)} vs ${Math.round(rBefore)} usual`)
  if (hrvLow >= 3) signs.push(`HRV low on ${hrvLow} of the last 7 nights`)
  if (rhrNow != null && rhrBase && rhrNow - rhrBase >= 3) signs.push(`sleeping HR +${Math.round(rhrNow - rhrBase)} bpm`)
  const recoveryDown = signs.length > 0

  const what = [volumeSpike && 'lifting volume >30% up', loadRamp != null && loadRamp >= 0.3 && `watch load +${Math.round(loadRamp * 100)}%`]
    .filter(Boolean).join(' and ')
  if (loadUp && recoveryDown) return { kind: 'warn', reason: `${what} while recovery is falling (${signs.join('; ')})` }
  if (loadUp) return { kind: 'coping', reason: `${what}, but your watch shows you're recovering well` }
  if (recoveryDown) return { kind: 'recovery-low', reason: `recovery is down without a load spike (${signs.join('; ')}) — check sleep, stress or illness` }
  return { kind: 'none' }
}
