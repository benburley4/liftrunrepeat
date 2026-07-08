'use client'

/** Small stat tile: mono accent value over a subtle label. */
export default function StatTile({
  value,
  label,
  accent = '#F5F5F5',
  size = 'md',
}: {
  value: string | number
  label: string
  accent?: string
  size?: 'md' | 'lg'
}) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: '#1E1E1E', border: '1px solid #2E2E2E' }}>
      <p
        className={`${size === 'lg' ? 'text-2xl' : 'text-xl'} font-black capitalize`}
        style={{ color: accent, fontFamily: 'var(--font-mono)' }}
      >
        {value}
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-subtle)', fontFamily: 'var(--font-sans)' }}>
        {label}
      </p>
    </div>
  )
}
