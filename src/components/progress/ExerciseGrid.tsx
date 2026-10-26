'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { ExerciseStat } from '@/lib/progressData'
import Sparkline from './Sparkline'
import { Pills } from './kit'
import { cardStyle } from './progressStyle'

export const CAT_COLORS: Record<string, string> = { Push: '#C8102E', Pull: '#00BFA5', Legs: '#A78BFA', Core: '#FF9500', Cardio: '#3B82F6' }

export default function ExerciseGrid({ analysis, bodyweight, onBodyweight, onSelect }: {
  analysis: ExerciseStat[]
  bodyweight: number
  onBodyweight: (kg: number) => void
  onSelect: (name: string) => void
}) {
  const [filter, setFilter] = useState('All')
  if (analysis.length === 0) {
    return (
      <div className="rounded-xl p-8 text-center" style={cardStyle}>
        <p className="text-sm" style={{ color: '#A0A0A0' }}>No exercises logged yet.</p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>Lifts saved in Log Session will appear here.</p>
      </div>
    )
  }
  const cats = ['All', ...Array.from(new Set(analysis.map(e => e.category)))]
  const filters = analysis.some(e => e.bodyweightBased) ? [...cats, 'Bodyweight'] : cats
  const shown = analysis.filter(e => filter === 'All' ? true : filter === 'Bodyweight' ? e.bodyweightBased : e.category === filter)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Pills label="Exercise category" options={filters.map(f => ({ id: f, label: f, color: CAT_COLORS[f] }))} value={filter} onChange={setFilter} />
        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-subtle)' }}>
          Bodyweight
          <input type="number" min={30} max={250} defaultValue={bodyweight} key={bodyweight}
            onBlur={e => onBodyweight(parseFloat(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            className="w-16 text-center py-1 rounded outline-none"
            style={{ background: '#1A1A1A', color: '#F5F5F5', border: '1px solid #2E2E2E', fontFamily: 'var(--font-mono)' }} />
          kg
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {shown.map(ex => {
          const catCol = CAT_COLORS[ex.category] ?? '#606060'
          return (
            <button key={ex.name} type="button" onClick={() => onSelect(ex.name)}
              className="rounded-xl p-4 text-left relative lrr-tile" style={{ ...cardStyle, cursor: 'pointer', opacity: ex.stale ? 0.62 : 1 }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-black uppercase leading-tight" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>{ex.name}</h3>
                <ChevronRight size={16} style={{ color: '#606060', flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
              </div>
              <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${catCol}22`, color: catCol }}>{ex.category}</span>
                {ex.bodyweightBased && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#2E2E2E', color: '#A0A0A0' }}>BW</span>}
                {ex.plateau && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>plateau</span>}
                {ex.pctGain !== null && ex.pctGain > 0 && !ex.plateau && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,191,165,0.1)', color: '#00BFA5', fontFamily: 'var(--font-mono)' }}>▲ {ex.pctGain}%</span>}
              </div>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-2xl font-bold" style={{ color: '#A78BFA', fontFamily: 'var(--font-mono)' }}>{ex.best1RM}<span className="text-sm" style={{ color: 'var(--color-text-subtle)' }}> kg</span></p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-subtle)' }}>est. 1RM{ex.bodyweightBased ? ` · incl. ${ex.bwPct}% BW` : ''}</p>
                </div>
                <Sparkline values={ex.trend.slice(-20).map(t => t.e1rm)} color="#A78BFA" width={84} height={32} label={`${ex.name} estimated 1RM trend`} />
              </div>
              <div className="flex justify-between mt-2 text-xs">
                <span style={{ color: '#A0A0A0', fontFamily: 'var(--font-mono)' }}>{ex.setsPerWeek}/wk · {ex.totalSets} sets</span>
                <span style={{ color: ex.stale ? '#F59E0B' : 'var(--color-text-subtle)' }}>{ex.daysSince === 0 ? 'today' : `${ex.daysSince}d ago`}{ex.stale ? ' · stale' : ''}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
