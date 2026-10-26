'use client'

import { ACTIVITY_COLORS } from './progressStyle'
import { useReducedMotion } from './kit'

/**
 * Strength vs endurance split as a two-part ring with the strength share in
 * the middle. A hybrid session counts on both sides.
 */
export default function BalanceRing({ strength, endurance, size = 150 }: { strength: number; endurance: number; size?: number }) {
  const reduced = useReducedMotion()
  const total = strength + endurance
  const pct = total ? Math.round((strength / total) * 100) : 50
  const stroke = Math.round(size * 0.12), r = (size - stroke) / 2, c = 2 * Math.PI * r
  const gap = total && strength && endurance ? 4 : 0
  const sLen = Math.max(0, (pct / 100) * c - gap)
  const eLen = Math.max(0, ((100 - pct) / 100) * c - gap)
  const verdict = !total ? 'No sessions in this range'
    : pct > 70 ? 'Strength-heavy — add run volume'
    : pct < 30 ? 'Endurance-heavy — add strength work'
    : 'Balanced hybrid training'

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
          aria-label={`${pct}% strength sessions, ${100 - pct}% endurance sessions`}>
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#242424" strokeWidth={stroke} />
            {total > 0 && <>
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ACTIVITY_COLORS.lift} strokeWidth={stroke}
                strokeDasharray={`${sLen} ${c}`} strokeDashoffset={-gap / 2} className={reduced ? undefined : 'lrr-ring'}
                style={{ ['--lrr-ring-from' as string]: `0 ${c}` }} />
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ACTIVITY_COLORS.run} strokeWidth={stroke}
                strokeDasharray={`${eLen} ${c}`} strokeDashoffset={-(sLen + gap * 1.5)} className={reduced ? undefined : 'lrr-ring'}
                style={{ ['--lrr-ring-from' as string]: `0 ${c}` }} />
            </>}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black" style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>{total ? `${pct}%` : '–'}</span>
          <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>strength</span>
        </div>
      </div>
      <div className="flex gap-4 mt-3 text-xs" style={{ fontFamily: 'var(--font-sans)' }}>
        <span style={{ color: ACTIVITY_COLORS.lift }}>Strength {strength}</span>
        <span style={{ color: ACTIVITY_COLORS.run }}>Endurance {endurance}</span>
      </div>
      <p className="text-xs mt-1" style={{ color: '#A0A0A0' }}>{verdict}</p>
    </div>
  )
}
