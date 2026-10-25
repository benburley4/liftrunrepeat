// Shared styling for the watch-data Progress tabs (Steps, On Foot, Hybrid load).

export { chartTooltipStyle, axisProps, fmtDay } from '@/components/recovery/chartStyle'

// Validated (dataviz validator, dark #1A1A1A) in this stack order.
export const FOOT_COLORS = { hike: '#65A30D', walk: '#3A86C8', run: '#E0334F' } as const
export const HYBRID_COLORS = { strength: '#00A88F', cardio: '#E0334F' } as const

export const STEPS_COLOR = '#00BFA5'

export const cardStyle = { background: '#1A1A1A', border: '1px solid #2E2E2E' }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-10" → "Oct 26" */
export function fmtMonth(key: string): string {
  const [y, m] = key.split('-')
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`
}
