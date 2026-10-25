'use client'

// Garmin-style training-effect gauges: one ring each for aerobic and
// anaerobic, filled on the 0–5 scale with the benefit label underneath.

const TE_MAX = 5

/** Standard training-effect bands (Firstbeat / Garmin / Zepp share them). */
export function teLabel(value: number): string {
  if (value < 1) return 'No benefit'
  if (value < 2) return 'Minor'
  if (value < 3) return 'Maintaining'
  if (value < 4) return 'Improving'
  if (value < 5) return 'Highly improving'
  return 'Overreaching'
}

function Ring({ value, label, color }: { value: number; label: string; color: string }) {
  const size = 104, stroke = 9
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const frac = Math.min(Math.max(value / TE_MAX, 0), 1)
  return (
    <figure className="flex flex-col items-center gap-2 m-0">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
        aria-label={`${label} training effect ${value.toFixed(1)} of 5, ${teLabel(value)}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2A2A2A" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={`${c * frac} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle"
          style={{ fill: '#F5F5F5', fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700 }}>{value.toFixed(1)}</text>
        <text x="50%" y="68%" textAnchor="middle" dominantBaseline="middle"
          style={{ fill: '#8A8A8A', fontFamily: 'var(--font-sans)', fontSize: 10 }}>/ 5.0</text>
      </svg>
      <figcaption className="text-center">
        <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-subtle)', fontFamily: 'var(--font-sans)' }}>{label}</p>
        <p className="text-sm font-semibold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-sans)' }}>{teLabel(value)}</p>
      </figcaption>
    </figure>
  )
}

export default function TrainingEffectRings({ aerobic, anaerobic }: { aerobic: number | null; anaerobic: number | null }) {
  if (aerobic == null && anaerobic == null) return null
  return (
    <div className="flex flex-wrap justify-center gap-10">
      {aerobic != null && <Ring value={aerobic} label="Aerobic" color="#00BFA5" />}
      {anaerobic != null && <Ring value={anaerobic} label="Anaerobic" color="#A78BFA" />}
    </div>
  )
}
