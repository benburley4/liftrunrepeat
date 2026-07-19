'use client'

import CountUp from './CountUp'

/** Small stat tile: mono accent value over a subtle label. Numeric values count up on scroll. */
export default function StatTile({
  value,
  label,
  accent = '#F5F5F5',
  size = 'md',
  animate = true,
}: {
  value: string | number
  label: string
  accent?: string
  size?: 'md' | 'lg'
  animate?: boolean
}) {
  return (
    <div className="rounded-xl p-3 text-center card-depth" style={{ background: '#1E1E1E', border: '1px solid #2E2E2E' }}>
      <p
        className={`${size === 'lg' ? 'text-2xl' : 'text-xl'} font-black capitalize`}
        style={{ color: accent, fontFamily: 'var(--font-mono)' }}
      >
        {animate ? <CountUp value={value} /> : value}
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-subtle)', fontFamily: 'var(--font-sans)' }}>
        {label}
      </p>
    </div>
  )
}
