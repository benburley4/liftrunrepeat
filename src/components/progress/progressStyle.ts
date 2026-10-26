// Shared styling for the Progress tabs.

export { chartTooltipStyle, axisProps, fmtDay } from '@/components/recovery/chartStyle'

/**
 * One colour per activity, used everywhere on Progress: teal = lifting,
 * red = running, purple = both in one session, lime = hiking, blue = walks.
 * Matches the logo (teal barbell, red stride line) and SessionTypeChip.
 */
export const ACTIVITY_COLORS = {
  lift: '#00BFA5',
  run: '#C8102E',
  hybrid: '#A78BFA',
  hike: '#84CC16',
  walk: '#3A86C8',
} as const

export const ACTIVITY_LABELS = { lift: 'Lift', run: 'Run', hybrid: 'Hybrid', hike: 'Hike', walk: 'Walk' } as const

// Validated (dataviz validator, dark #1A1A1A) in this stack order.
export const FOOT_COLORS = { hike: '#65A30D', walk: '#3A86C8', run: '#E0334F' } as const
export const HYBRID_COLORS = { strength: '#00A88F', cardio: '#E0334F' } as const

export const STEPS_COLOR = '#00BFA5'
/** Previous-period ghost series. */
export const GHOST = '#5A5A5A'
export const UP = '#00BFA5'
export const DOWN = '#C8102E'

export const cardStyle = { background: '#1A1A1A', border: '1px solid #2E2E2E' }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-10" → "Oct 26" */
export function fmtMonth(key: string): string {
  const [y, m] = key.split('-')
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`
}

/** "2026-10-24" → "24 Oct 2026" */
export function fmtLongDay(date: string): string {
  const [y, m, d] = date.split('-')
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`
}

/** 12,400 kg → "12.4t", 950 → "950 kg" */
export function fmtTonnes(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${Math.round(kg)} kg`
}
