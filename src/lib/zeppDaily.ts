// Pure builder for the zepp_daily table (scripts/zepp-sync.mjs).
// Pivots ZeppBridge's per-metric daily rows into one row per date, picks the
// main sleep per wake-up date, and derives the scale bodyweight. Dependency-
// free so the Node script can import this .ts file directly.

export interface DailyMetricRow { date: string; metric: string; value: number }

export interface SleepRow {
  startTime: string
  endTime: string
  score?: number | null
  durationMin: number
  deepMin: number
  lightMin: number
  remMin: number
  awakeMin: number
  wakeCount?: number | null
}

export interface WeightReading { timestamp: string; kg: number }

export interface ZeppDailyRow {
  date: string
  readiness: number | null
  hrv_readiness: number | null
  rhr_readiness: number | null
  physical_readiness: number | null
  mental_readiness: number | null
  sleep_hrv_ms: number | null
  hrv_baseline_ms: number | null
  sleep_rhr: number | null
  rhr_baseline: number | null
  resting_hr: number | null
  sleep_min: number | null
  sleep_score: number | null
  deep_min: number | null
  light_min: number | null
  rem_min: number | null
  awake_min: number | null
  wake_count: number | null
  nap_min: number | null
  training_load: number | null
  pai_daily: number | null
  pai_total: number | null
  steps: number | null
  active_min: number | null
  stress_avg: number | null
  spo2_score: number | null
  resp_rate: number | null
  weight_kg: number | null
}

// zepp_daily column ← ZeppBridge daily_metrics name(s), first present wins.
const METRIC_COLUMNS: Record<string, string[]> = {
  readiness:          ['readiness'],
  hrv_readiness:      ['hrv_readiness'],
  rhr_readiness:      ['rhr_readiness'],
  physical_readiness: ['physical_readiness'],
  mental_readiness:   ['mental_readiness'],
  sleep_hrv_ms:       ['sleep_hrv'],
  hrv_baseline_ms:    ['hrv_baseline'],
  sleep_rhr:          ['sleep_rhr'],
  rhr_baseline:       ['rhr_baseline'],
  resting_hr:         ['resting_hr', 'device_resting_hr'],
  training_load:      ['training_load'],
  pai_daily:          ['pai_daily'],
  pai_total:          ['pai_total'],
  steps:              ['steps'],
  active_min:         ['active_minutes'],
  stress_avg:         ['stress'],
  spo2_score:         ['spo2_night_score'],
  resp_rate:          ['respiratory_rate'],
}

export const DEFAULT_TIME_ZONE = 'Asia/Hong_Kong'

function localDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(iso))
}

function emptyRow(date: string): ZeppDailyRow {
  return {
    date,
    readiness: null, hrv_readiness: null, rhr_readiness: null, physical_readiness: null, mental_readiness: null,
    sleep_hrv_ms: null, hrv_baseline_ms: null, sleep_rhr: null, rhr_baseline: null, resting_hr: null,
    sleep_min: null, sleep_score: null, deep_min: null, light_min: null, rem_min: null, awake_min: null,
    wake_count: null, nap_min: null, training_load: null, pai_daily: null, pai_total: null, steps: null,
    active_min: null, stress_avg: null, spo2_score: null, resp_rate: null, weight_kg: null,
  }
}

const overlaps = (a: SleepRow, b: SleepRow) => a.startTime < b.endTime && b.startTime < a.endTime

/**
 * Main sleep per wake-up date: the longest session (ties → the one with a
 * wake count, which ZeppBridge sets on the full night record). Other sessions
 * that don't overlap it count as naps.
 */
export function pickSleep(sleeps: SleepRow[], timeZone = DEFAULT_TIME_ZONE) {
  const byDate = new Map<string, SleepRow[]>()
  for (const s of sleeps) {
    const d = localDate(s.endTime, timeZone)
    if (!byDate.has(d)) byDate.set(d, [])
    byDate.get(d)!.push(s)
  }
  const out = new Map<string, { main: SleepRow; napMin: number }>()
  for (const [date, list] of byDate) {
    const main = list.reduce((a, b) =>
      b.durationMin > a.durationMin || (b.durationMin === a.durationMin && a.wakeCount == null && b.wakeCount != null) ? b : a)
    const napMin = list.filter(s => s !== main && !overlaps(s, main)).reduce((n, s) => n + s.durationMin, 0)
    out.set(date, { main, napMin })
  }
  return out
}

/** Median of the readings in the 7 days up to the latest one, to 0.1 kg. */
export function scaleBodyweight(weights: WeightReading[]): { kg: number; asOf: string } | null {
  if (!weights.length) return null
  const latest = weights.reduce((a, b) => (b.timestamp > a.timestamp ? b : a))
  const cutoff = new Date(new Date(latest.timestamp).getTime() - 7 * 86400e3).toISOString()
  const recent = weights.filter(w => new Date(w.timestamp).toISOString() >= cutoff).map(w => w.kg).sort((a, b) => a - b)
  const mid = Math.floor(recent.length / 2)
  const median = recent.length % 2 ? recent[mid] : (recent[mid - 1] + recent[mid]) / 2
  return { kg: Math.round(median * 10) / 10, asOf: latest.timestamp }
}

export function buildZeppDaily(
  metrics: DailyMetricRow[],
  sleeps: SleepRow[],
  weights: WeightReading[],
  timeZone = DEFAULT_TIME_ZONE,
): ZeppDailyRow[] {
  const rows = new Map<string, ZeppDailyRow>()
  const row = (date: string) => {
    if (!rows.has(date)) rows.set(date, emptyRow(date))
    return rows.get(date)!
  }

  const byDate = new Map<string, Map<string, number>>()
  for (const m of metrics) {
    if (!byDate.has(m.date)) byDate.set(m.date, new Map())
    byDate.get(m.date)!.set(m.metric, m.value)
  }
  for (const [date, values] of byDate) {
    const r = row(date) as unknown as Record<string, number | null>
    for (const [column, names] of Object.entries(METRIC_COLUMNS)) {
      const name = names.find(n => values.has(n))
      if (name) r[column] = Math.round(values.get(name)! * 10) / 10
    }
  }

  for (const [date, { main, napMin }] of pickSleep(sleeps, timeZone)) {
    Object.assign(row(date), {
      sleep_min: main.durationMin,
      sleep_score: main.score ?? null,
      deep_min: main.deepMin,
      light_min: main.lightMin,
      rem_min: main.remMin,
      awake_min: main.awakeMin,
      wake_count: main.wakeCount ?? null,
      nap_min: napMin,
    })
  }

  // Last scale reading of each local day.
  const lastWeight = new Map<string, WeightReading>()
  for (const w of weights) {
    const d = localDate(w.timestamp, timeZone)
    const cur = lastWeight.get(d)
    if (!cur || w.timestamp > cur.timestamp) lastWeight.set(d, w)
  }
  for (const [date, w] of lastWeight) row(date).weight_kg = Math.round(w.kg * 10) / 10

  // Old empty months can come back as a lone zero (e.g. training_load 0) — drop
  // days without a single non-zero value.
  const hasData = (r: ZeppDailyRow) =>
    Object.entries(r).some(([k, v]) => k !== 'date' && typeof v === 'number' && v !== 0)
  return [...rows.values()].filter(hasData).sort((a, b) => a.date.localeCompare(b.date))
}
