// Shared Recharts styling for the Recovery page (matches progress/page.tsx).

export const chartTooltipStyle = {
  contentStyle: { background: '#242424', border: '1px solid #2E2E2E', borderRadius: '8px', fontFamily: 'var(--font-sans)' },
  labelStyle: { color: '#F5F5F5', fontSize: 11 },
  itemStyle: { fontSize: 11 },
}

export const axisProps = {
  tick: { fontSize: 11, fill: '#8A8A8A' },
  stroke: '#2E2E2E',
}

export const BASELINE_GREY = '#8A8A8A'

// Validated (dataviz validator, dark #141414): stack order deep → REM → light → awake.
export const SLEEP_STAGE_COLORS = {
  deep:  '#7058E8',
  rem:   '#D0607A',
  light: '#2C93B5',
  awake: '#B8860B',
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-10-24" → "24 Oct" */
export function fmtDay(date: string): string {
  const [, m, d] = date.split('-')
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`
}
