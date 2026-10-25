// Pure logic for the Recovery page (zepp_daily rows → readiness call,
// drivers, trends). Thresholds agreed 2026-10-25 — see ZEPP_INSIGHTS_PLAN.md.

import type { ZeppDailyRow } from './zeppDaily'

export type ZeppDay = ZeppDailyRow

export type ReadinessLevel = 'go' | 'planned' | 'easy' | 'rest'

export const READINESS_THRESHOLDS = { go: 75, planned: 55, easy: 40 } as const

export const READINESS_CALL: Record<ReadinessLevel, { label: string; advice: string; color: string }> = {
  go:      { label: 'Go hard',          color: '#00BFA5', advice: 'Well recovered — a good day for heavy lifts, intervals or a long hike.' },
  planned: { label: 'Train as planned', color: '#A78BFA', advice: 'Normal recovery — stick to the plan.' },
  easy:    { label: 'Keep it easy',     color: '#F59E0B', advice: 'Recovery is down — swap max-effort work for Zone 2, technique or mobility.' },
  rest:    { label: 'Rest',             color: '#C8102E', advice: 'Recovery is low — rest or light mobility; today recovery is the training.' },
}

export function readinessLevel(score: number): ReadinessLevel {
  if (score >= READINESS_THRESHOLDS.go) return 'go'
  if (score >= READINESS_THRESHOLDS.planned) return 'planned'
  if (score >= READINESS_THRESHOLDS.easy) return 'easy'
  return 'rest'
}

/** Local calendar date (YYYY-MM-DD) in the viewer's time zone. */
export function localToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Most recent day with a readiness score. Zepp scores a day after the night's
 * sleep syncs, so early in the day this is often yesterday.
 */
export function latestReadiness(rows: ZeppDay[]): ZeppDay | null {
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i].readiness != null) return rows[i]
  return null
}

/** Watch readiness older than this many days is stale — fall back to the log-based estimate. */
export const WATCH_READINESS_MAX_AGE_DAYS = 1

export interface WatchReadiness {
  day: ZeppDay
  score: number
  level: ReadinessLevel
  trend: '↑' | '↓' | '→'   // vs the previous 7 scored days
}

/**
 * The watch readiness to show in place of the training-log estimate, or null
 * when the latest score is older than yesterday (watch not worn / not synced).
 */
export function freshWatchReadiness(rows: ZeppDay[], today: string, maxAgeDays = WATCH_READINESS_MAX_AGE_DAYS): WatchReadiness | null {
  const day = latestReadiness(rows)
  if (!day || day.readiness == null || day.date < shiftDate(today, -maxAgeDays)) return null
  const prev = mean(rows.filter(r => r.date < day.date && r.date >= shiftDate(day.date, -7)).map(r => r.readiness))
  const score = Math.round(day.readiness)
  const trend = prev == null ? '→' : score > prev + 3 ? '↑' : score < prev - 3 ? '↓' : '→'
  return { day, score, level: readinessLevel(score), trend }
}

export type DriverStatus = 'good' | 'neutral' | 'poor'

export interface Driver {
  key: 'hrv' | 'rhr' | 'sleep'
  label: string
  value: string
  detail: string
  status: DriverStatus
}

function mean(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => x != null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

function fmtHours(min: number): string {
  return `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, '0')}m`
}

/** What is pushing readiness up or down on `day`, relative to the athlete's own norms. */
export function readinessDrivers(day: ZeppDay, rows: ZeppDay[]): Driver[] {
  const out: Driver[] = []

  if (day.sleep_hrv_ms != null && day.hrv_baseline_ms) {
    const pct = (day.sleep_hrv_ms - day.hrv_baseline_ms) / day.hrv_baseline_ms
    out.push({
      key: 'hrv', label: 'Overnight HRV',
      value: `${Math.round(day.sleep_hrv_ms)} ms`,
      detail: `${pct >= 0 ? '+' : ''}${Math.round(pct * 100)}% vs baseline ${Math.round(day.hrv_baseline_ms)} ms`,
      status: pct >= 0 ? 'good' : pct >= -0.1 ? 'neutral' : 'poor',
    })
  }

  const rhr = day.sleep_rhr ?? day.resting_hr
  if (rhr != null && day.rhr_baseline) {
    const diff = rhr - day.rhr_baseline
    out.push({
      key: 'rhr', label: 'Resting HR',
      value: `${Math.round(rhr)} bpm`,
      detail: `${diff >= 0 ? '+' : ''}${Math.round(diff)} bpm vs baseline ${Math.round(day.rhr_baseline)}`,
      status: diff <= 0 ? 'good' : diff <= 3 ? 'neutral' : 'poor',
    })
  }

  if (day.sleep_min != null) {
    const prior = rows.filter(r => r.date < day.date && r.date >= shiftDate(day.date, -7))
    const avg = mean(prior.map(r => r.sleep_min))
    out.push({
      key: 'sleep', label: 'Sleep',
      value: fmtHours(day.sleep_min),
      detail: avg != null
        ? `${day.sleep_min - avg >= 0 ? '+' : '−'}${fmtHours(Math.abs(day.sleep_min - avg))} vs 7-day avg${day.sleep_score != null ? ` · score ${day.sleep_score}` : ''}`
        : day.sleep_score != null ? `score ${day.sleep_score}` : '',
      status: day.sleep_min >= 420 ? 'good' : day.sleep_min >= 360 ? 'neutral' : 'poor',
    })
  }

  return out
}

/** Rows within the last `days` days up to `today` (all rows when days is null). */
export function lastDays(rows: ZeppDay[], days: number | null, today: string): ZeppDay[] {
  if (days == null) return rows.filter(r => r.date <= today)
  const from = shiftDate(today, -(days - 1))
  return rows.filter(r => r.date >= from && r.date <= today)
}

/** Trailing mean over the previous `window` rows (including the current one) that have a value. */
export function withRollingMean<K extends keyof ZeppDay>(rows: ZeppDay[], key: K, window = 7): (number | null)[] {
  return rows.map((_, i) => {
    const m = mean(rows.slice(Math.max(0, i - window + 1), i + 1).map(r => r[key] as number | null))
    return m == null ? null : Math.round(m * 10) / 10
  })
}

// ─── Weekly AI coach ─────────────────────────────────────────────────────────

/** The bits of a saved session the coach summary needs. */
export interface CoachSession {
  date: string
  type: string
  zepp?: { durationMin?: number | null; avgHr?: number | null } | null
}

const round1 = (n: number) => Math.round(n * 10) / 10
const pctChange = (cur: number, prev: number) => Math.round(((cur - prev) / prev) * 100)

/**
 * RECOVERY block for the weekly coach prompt: the week ending `weekEnding`
 * (7 days) against the 4 weeks before it, plus watch-measured session effort.
 * Returns '' when the week has no watch data.
 */
export function recoveryToPrompt(rows: ZeppDay[], weekEnding: string, sessions: CoachSession[] = []): string {
  const weekStart = shiftDate(weekEnding, -6)
  const week = rows.filter(r => r.date >= weekStart && r.date <= weekEnding)
  const prior = rows.filter(r => r.date >= shiftDate(weekStart, -28) && r.date < weekStart)
  if (!week.some(r => r.readiness != null || r.sleep_min != null)) return ''

  const avg = (list: ZeppDay[], key: keyof ZeppDay) => mean(list.map(r => r[key] as number | null))
  const lines: string[] = ['RECOVERY (measured by the athlete\'s Zepp watch — this week vs the previous 4 weeks):']

  const rWeek = avg(week, 'readiness'), rPrior = avg(prior, 'readiness')
  if (rWeek != null) {
    const scored = week.filter(r => r.readiness != null)
    const counts = { go: 0, planned: 0, easy: 0, rest: 0 }
    for (const r of scored) counts[readinessLevel(r.readiness!)]++
    const low = scored.reduce((a, b) => (b.readiness! < a.readiness! ? b : a))
    lines.push(`- Watch readiness (0–100): avg **${Math.round(rWeek)}**${rPrior != null ? ` (previous 4 weeks ${Math.round(rPrior)})` : ''}; `
      + `days: ${counts.go} go-hard (≥${READINESS_THRESHOLDS.go}), ${counts.planned} as-planned, ${counts.easy} keep-easy, ${counts.rest} rest (<${READINESS_THRESHOLDS.easy}); `
      + `lowest ${Math.round(low.readiness!)} on ${low.date}`)
  }

  const hrv = avg(week, 'sleep_hrv_ms'), hrvBase = avg(week, 'hrv_baseline_ms')
  if (hrv != null && hrvBase) {
    const below = week.filter(r => r.sleep_hrv_ms != null && r.hrv_baseline_ms && r.sleep_hrv_ms < r.hrv_baseline_ms * 0.9).length
    lines.push(`- Overnight HRV: avg **${Math.round(hrv)} ms** vs personal baseline ${Math.round(hrvBase)} ms (${pctChange(hrv, hrvBase) >= 0 ? '+' : ''}${pctChange(hrv, hrvBase)}%); ${below} night(s) more than 10% below baseline`)
  }

  const rhr = avg(week, 'sleep_rhr'), rhrBase = avg(week, 'rhr_baseline')
  if (rhr != null && rhrBase) {
    const diff = round1(rhr - rhrBase)
    lines.push(`- Sleeping heart rate: avg **${Math.round(rhr)} bpm** vs baseline ${Math.round(rhrBase)} bpm (${diff >= 0 ? '+' : ''}${diff})`)
  }

  const sleep = avg(week, 'sleep_min'), sleepPrior = avg(prior, 'sleep_min')
  if (sleep != null) {
    const short = week.filter(r => r.sleep_min != null && r.sleep_min < 360).length
    const score = avg(week, 'sleep_score')
    lines.push(`- Sleep: avg **${round1(sleep / 60)} h/night**${sleepPrior != null ? ` (previous 4 weeks ${round1(sleepPrior / 60)} h)` : ''}; `
      + `${short} night(s) under 6 h${score != null ? `; avg sleep score ${Math.round(score)}` : ''}`)
  }

  const load = avg(week, 'training_load'), loadPrior = avg(prior, 'training_load')
  if (load != null && loadPrior) {
    lines.push(`- Watch training load: avg ${Math.round(load)} vs ${Math.round(loadPrior)} previous 4 weeks (${pctChange(load, loadPrior) >= 0 ? '+' : ''}${pctChange(load, loadPrior)}%)`)
  }

  const stress = avg(week, 'stress_avg')
  if (stress != null) lines.push(`- Daytime stress (0–100): avg ${Math.round(stress)}`)

  const weights = rows.filter(r => r.weight_kg != null && r.date <= weekEnding)
  const lastW = weights.at(-1)
  const monthAgo = [...weights].reverse().find(r => r.date <= shiftDate(weekEnding, -28))
  if (lastW && lastW.date >= shiftDate(weekEnding, -13)) {
    lines.push(`- Bodyweight (scale): ${lastW.weight_kg} kg${monthAgo ? ` (${round1(lastW.weight_kg! - monthAgo.weight_kg!) >= 0 ? '+' : ''}${round1(lastW.weight_kg! - monthAgo.weight_kg!)} kg over 4 weeks)` : ''}`)
  }

  // Watch-measured effort of this week's logged sessions.
  const groups: Record<string, { n: number; min: number; hrMin: number }> = {}
  for (const s of sessions) {
    if (s.date < weekStart || s.date > weekEnding || !s.zepp?.durationMin) continue
    const g = s.type === 'lift' || s.type === 'hybrid' ? 'Strength/hybrid' : s.type === 'hike' ? 'Hikes/walks' : 'Other cardio'
    groups[g] ??= { n: 0, min: 0, hrMin: 0 }
    groups[g].n++
    groups[g].min += s.zepp.durationMin
    if (s.zepp.avgHr) groups[g].hrMin += s.zepp.avgHr * s.zepp.durationMin
  }
  const parts = Object.entries(groups).map(([g, v]) =>
    `${g} ${v.n} session(s), ${round1(v.min / 60)} h${v.hrMin ? `, avg HR ${Math.round(v.hrMin / v.min)}` : ''}`)
  if (parts.length) lines.push(`- Watch-recorded sessions: ${parts.join('; ')}`)

  // Warning signs the coach should act on.
  const flags: string[] = []
  if (rWeek != null && rPrior != null && load != null && loadPrior && rWeek <= rPrior - 5 && load >= loadPrior * 1.1)
    flags.push('readiness falling while training load rises — classic overreaching pattern')
  const hrvLow = week.filter(r => r.sleep_hrv_ms != null && r.hrv_baseline_ms && r.sleep_hrv_ms < r.hrv_baseline_ms * 0.9).length
  if (hrvLow >= 4) flags.push(`HRV suppressed on ${hrvLow} of 7 nights`)
  const shortNights = week.filter(r => r.sleep_min != null && r.sleep_min < 360).length
  if (shortNights >= 2) flags.push(`${shortNights} short nights (<6 h)`)
  if (rhr != null && rhrBase && rhr - rhrBase >= 3) flags.push(`sleeping HR ${Math.round(rhr - rhrBase)} bpm above baseline`)
  if (flags.length) lines.push(`- ⚠ RECOVERY FLAGS: ${flags.join('; ')}`)

  return lines.join('\n')
}

export interface PeriodChange { current: number | null; previous: number | null; change: number | null }

/** Average of `key` over the last `days` vs the `days` before that. */
export function periodChange<K extends keyof ZeppDay>(rows: ZeppDay[], key: K, days: number, today: string): PeriodChange {
  const cur = lastDays(rows, days, today)
  const prevEnd = shiftDate(today, -days)
  const prev = lastDays(rows, days, prevEnd)
  const current = mean(cur.map(r => r[key] as number | null))
  const previous = mean(prev.map(r => r[key] as number | null))
  const round = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10)
  return {
    current: round(current),
    previous: round(previous),
    change: current != null && previous != null ? round(current - previous) : null,
  }
}
