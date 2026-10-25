'use client'

import { hrLoad } from '@/lib/activity'
import type { SessionData } from '@/lib/computeStats'
import { cardStyle, fmtDay } from './progressStyle'

/**
 * Recent lifting sessions recorded on the watch: tonnage, minutes, density
 * (kg lifted per minute) and heart rate — work done vs how hard it felt to the body.
 */
export default function LiftingEffort({ sessions, volumeOf, limit = 12 }: {
  sessions: SessionData[]
  volumeOf: (s: SessionData) => number
  limit?: number
}) {
  const rows = sessions
    .filter(s => (s.type === 'lift' || s.type === 'hybrid') && s.zepp?.durationMin && (s.exercises ?? []).length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map(s => {
      const kg = Math.round(volumeOf(s))
      const min = s.zepp!.durationMin!
      return { s, kg, min, density: min ? Math.round(kg / min) : null, hr: s.zepp!.avgHr, load: hrLoad(s) }
    })
  if (!rows.length) return null

  return (
    <div className="rounded-xl p-5" style={cardStyle}>
      <h3 className="text-xl font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>Lifting Effort</h3>
      <p className="text-xs mt-1 mb-4" style={{ color: 'var(--color-text-subtle)' }}>
        Watch-recorded lifting sessions: density (kg per minute) shows work rate; heart rate and HR load show the cost.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
          <thead>
            <tr style={{ color: 'var(--color-text-subtle)' }}>
              {['Session', 'Volume', 'Time', 'kg/min', 'Avg HR', 'HR load'].map((h, i) => (
                <th key={h} className={`text-xs font-normal pb-2 px-2 ${i ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, kg, min, density, hr, load }) => (
              <tr key={s.savedAt} style={{ color: '#F5F5F5', borderTop: '1px solid #242424' }}>
                <td className="py-2 px-2" style={{ fontFamily: 'var(--font-sans)' }}>
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-xs ml-2" style={{ color: 'var(--color-text-subtle)' }}>{fmtDay(s.date)}</span>
                </td>
                <td className="py-2 px-2 text-right">{kg.toLocaleString()} kg</td>
                <td className="py-2 px-2 text-right">{min} min</td>
                <td className="py-2 px-2 text-right">{density ?? '–'}</td>
                <td className="py-2 px-2 text-right">{hr ?? '–'}</td>
                <td className="py-2 px-2 text-right">{load ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
