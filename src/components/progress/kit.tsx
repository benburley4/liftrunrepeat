'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import { cardStyle } from './progressStyle'

function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

/** True when the viewer asked the OS for less motion (charts then render without animating). */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => true,
  )
}

/** Recharts animation props: a short ease-out, or none for reduced motion. */
export function useChartAnimation() {
  const reduced = useReducedMotion()
  return { isAnimationActive: !reduced, animationDuration: 700, animationEasing: 'ease-out' as const }
}

export function Heading({ children, sub, id }: { children: ReactNode; sub?: ReactNode; id?: string }) {
  return (
    <div className="min-w-0">
      <h3 id={id} className="text-xl font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>{children}</h3>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)', fontFamily: 'var(--font-sans)' }}>{sub}</p>}
    </div>
  )
}

/** Standard chart card: heading + optional controls on the right, then the body. */
export function ChartCard({ title, sub, actions, children, id, className = '' }: {
  title: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; id?: string; className?: string
}) {
  return (
    <section id={id} className={`rounded-xl p-5 lrr-reveal ${className}`} style={cardStyle}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <Heading sub={sub}>{title}</Heading>
        {actions}
      </div>
      {children}
    </section>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl p-12 text-center" style={cardStyle}>
      <p className="text-sm font-semibold" style={{ color: '#A0A0A0', fontFamily: 'var(--font-sans)' }}>{title}</p>
      {hint && <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)', fontFamily: 'var(--font-sans)' }}>{hint}</p>}
    </div>
  )
}

/** Small toggle-button group (single choice). */
export function Pills<T extends string | number>({ options, value, onChange, label, color = '#00BFA5' }: {
  options: { id: T; label: string; color?: string }[]; value: T; onChange: (v: T) => void; label: string; color?: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {options.map(o => {
        const on = value === o.id
        const c = o.color ?? color
        return (
          <button key={String(o.id)} type="button" onClick={() => onChange(o.id)} aria-pressed={on}
            className="rounded-full px-3 py-1 text-xs transition-colors"
            style={{
              background: on ? `${c}1F` : '#242424',
              border: `1px solid ${on ? `${c}66` : '#2E2E2E'}`,
              color: on ? c : '#A0A0A0',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
            }}>{o.label}</button>
        )
      })}
    </div>
  )
}

/** Coloured legend dot + label. */
export function LegendDot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: '#A0A0A0', fontFamily: 'var(--font-sans)' }}>
      <span aria-hidden="true" style={{ width: 10, height: dashed ? 0 : 10, borderRadius: 3, background: dashed ? 'none' : color, borderTop: dashed ? `2px dashed ${color}` : undefined }} />
      {label}
    </span>
  )
}

/** Hint under a chart that clicking a bar opens that period. */
export function ClickHint({ children = 'Click a bar to see those sessions.' }: { children?: ReactNode }) {
  return <p className="text-xs mt-2" style={{ color: 'var(--color-text-subtle)', fontFamily: 'var(--font-sans)' }}>{children}</p>
}
