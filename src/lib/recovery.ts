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
