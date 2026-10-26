// Date ranges and time buckets shared by every Progress chart.
// Dates are calendar strings (YYYY-MM-DD) handled in UTC so a viewer's time
// zone can never shift a session into the neighbouring week.

import { weekStartOf } from './activity'

export type RangeId = '4w' | '12w' | '6m' | '1y' | 'all'

export const RANGES: { id: RangeId; label: string; weeks: number | null }[] = [
  { id: '4w', label: '4 wks', weeks: 4 },
  { id: '12w', label: '12 wks', weeks: 12 },
  { id: '6m', label: '6 mo', weeks: 26 },
  { id: '1y', label: '1 yr', weeks: 52 },
  { id: 'all', label: 'All', weeks: null },
]

export const DEFAULT_RANGE: RangeId = '12w'

export function isRangeId(v: unknown): v is RangeId {
  return RANGES.some(r => r.id === v)
}

export function rangeLabel(id: RangeId): string {
  return ({ '4w': '4 weeks', '12w': '12 weeks', '6m': '6 months', '1y': '1 year', all: 'all time' } as const)[id]
}

/** A half-open date window [start, end) shown as one bar / point. */
export interface Bucket { key: string; start: string; end: string; label: string }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function shiftDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function shiftMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

/** "2026-10-19" → "19 Oct" */
export function dayLabel(date: string): string {
  const [, m, d] = date.split('-')
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`
}

/** "2026-10" → "Oct 26" */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-')
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`
}

function weekBuckets(firstMonday: string, count: number): Bucket[] {
  return Array.from({ length: count }, (_, i) => {
    const start = shiftDays(firstMonday, i * 7)
    return { key: start, start, end: shiftDays(start, 7), label: dayLabel(start) }
  })
}

function monthBuckets(firstMonth: string, count: number): Bucket[] {
  return Array.from({ length: count }, (_, i) => {
    const m = shiftMonths(firstMonth, i)
    return { key: m, start: `${m}-01`, end: `${shiftMonths(m, 1)}-01`, label: monthLabel(m) }
  })
}

/** Most months the "All" range will show (10 years). */
export const MAX_ALL_MONTHS = 120

/**
 * Buckets ending with the one that contains `today`: weekly (Monday starts) for
 * the fixed ranges, monthly from the first session's month for "all".
 */
export function rangeBuckets(range: RangeId, today: string, firstDate?: string | null): Bucket[] {
  const weeks = RANGES.find(r => r.id === range)?.weeks
  if (weeks) return weekBuckets(shiftDays(weekStartOf(today), -7 * (weeks - 1)), weeks)
  const last = today.slice(0, 7)
  const first = (firstDate ?? today).slice(0, 7)
  const [fy, fm] = first.split('-').map(Number)
  const [ly, lm] = last.split('-').map(Number)
  const span = Math.min(MAX_ALL_MONTHS, Math.max(1, (ly - fy) * 12 + (lm - fm) + 1))
  return monthBuckets(shiftMonths(last, -(span - 1)), span)
}

/** The same number of buckets immediately before `buckets` (for "compare to previous period"). */
export function previousBuckets(buckets: Bucket[]): Bucket[] {
  if (!buckets.length) return []
  const n = buckets.length
  if (buckets[0].key.length === 7) return monthBuckets(shiftMonths(buckets[0].key, -n), n)
  return weekBuckets(shiftDays(buckets[0].start, -7 * n), n)
}

/** Index of the bucket holding `date`, or -1 when outside them all. */
export function bucketIndex(buckets: Bucket[], date: string): number {
  if (!buckets.length || date < buckets[0].start || date >= buckets[buckets.length - 1].end) return -1
  let lo = 0, hi = buckets.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (date < buckets[mid].start) hi = mid - 1
    else if (date >= buckets[mid].end) lo = mid + 1
    else return mid
  }
  return -1
}

/** First and last date covered by a bucket list. */
export function bucketSpan(buckets: Bucket[]): { start: string; end: string } | null {
  return buckets.length ? { start: buckets[0].start, end: buckets[buckets.length - 1].end } : null
}

/** "Week of 19 Oct" / "October 2026" for a bucket. */
export function bucketTitle(b: Bucket): string {
  if (b.key.length === 7) {
    const [y, m] = b.key.split('-')
    return `${new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })} ${y}`
  }
  return `Week of ${b.label}`
}
