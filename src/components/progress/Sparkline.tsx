'use client'

import { useId } from 'react'

/**
 * Tiny inline trend line (SVG, no axes). Nulls break the line; the last
 * point is marked. `kind="bars"` draws mini columns instead.
 */
export default function Sparkline({ values, color, width = 120, height = 32, kind = 'line', label }: {
  values: (number | null)[]
  color: string
  width?: number
  height?: number
  kind?: 'line' | 'bars'
  label?: string
}) {
  const gid = `spark-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const nums = values.filter((v): v is number => v != null)
  if (nums.length < 2) return <div style={{ width, height }} aria-hidden="true" />
  const min = kind === 'bars' ? 0 : Math.min(...nums)
  const max = Math.max(...nums)
  const span = max - min || 1
  const pad = 3
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2)
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2)

  if (kind === 'bars') {
    const w = Math.max(1.5, (width - pad * 2) / values.length - 1.5)
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} style={{ display: 'block' }}>
        {values.map((v, i) => v == null ? null : (
          <rect key={i} x={pad + i * ((width - pad * 2) / values.length)} y={y(v)} width={w} height={Math.max(1, height - pad - y(v))}
            rx={1} fill={color} opacity={i === values.length - 1 ? 1 : 0.45} />
        ))}
      </svg>
    )
  }

  const segments: string[] = []
  let cur = ''
  values.forEach((v, i) => {
    if (v == null) { if (cur) segments.push(cur); cur = ''; return }
    cur += `${cur ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
  })
  if (cur) segments.push(cur)
  const lastIdx = values.map((v, i) => (v == null ? -1 : i)).filter(i => i >= 0).pop()!
  const firstIdx = values.findIndex(v => v != null)
  const area = `${segments.join('')}L${x(lastIdx).toFixed(1)},${height}L${x(firstIdx).toFixed(1)},${height}Z`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {segments.length === 1 && <path d={area} fill={`url(#${gid})`} />}
      {segments.map((d, i) => <path key={i} d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />)}
      <circle cx={x(lastIdx)} cy={y(values[lastIdx]!)} r={2.75} fill={color} />
    </svg>
  )
}
