'use client'

import { Fragment } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'
import { ChevronLeft, Trophy } from 'lucide-react'
import type { ExerciseStat } from '@/lib/progressData'
import { useChartAnimation } from './kit'
import { cardStyle, chartTooltipStyle } from './progressStyle'

const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtShort = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const tick = { fontSize: 11, fill: '#8A8A8A' }

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--color-text-subtle)', fontFamily: 'var(--font-heading)' }}>{children}</p>
}

/** One exercise: progression, per-session volume, strength curve and RM table. */
export default function ExerciseDetail({ ex, bodyweight, onBack }: { ex: ExerciseStat; bodyweight: number; onBack: () => void }) {
  const anim = useChartAnimation()
  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm" style={{ color: '#A0A0A0', cursor: 'pointer' }}>
        <ChevronLeft size={16} /> All exercises
      </button>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>{ex.name}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-1 rounded" style={{ ...cardStyle, color: '#A0A0A0' }}>{ex.category}</span>
          {ex.bodyweightBased && <span className="text-xs px-2 py-1 rounded" style={{ ...cardStyle, color: '#A0A0A0' }}>Bodyweight</span>}
          <span className="text-xs px-2 py-1 rounded" style={{ ...cardStyle, color: '#A0A0A0', fontFamily: 'var(--font-mono)' }}>{ex.totalSets} sets · {ex.setsPerWeek}/wk</span>
          <span className="text-xs px-2 py-1 rounded" style={{ ...cardStyle, color: '#A78BFA', fontFamily: 'var(--font-mono)' }}>{ex.best1RM} kg est. 1RM</span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {ex.pctGain !== null && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: ex.pctGain >= 0 ? 'rgba(0,191,165,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${ex.pctGain >= 0 ? 'rgba(0,191,165,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
            <span className="text-xs font-bold" style={{ color: ex.pctGain >= 0 ? '#00BFA5' : '#EF4444', fontFamily: 'var(--font-mono)' }}>{ex.pctGain >= 0 ? '▲' : '▼'} {Math.abs(ex.pctGain)}%</span>
            <span className="text-xs" style={{ color: '#A0A0A0' }}>est. 1RM · {ex.gainWeeks}wk</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(200,16,46,0.06)', border: '1px solid rgba(200,16,46,0.2)' }}>
          <Trophy size={12} style={{ color: '#C8102E' }} aria-hidden="true" />
          <span className="text-xs" style={{ color: '#A0A0A0' }}>PR <span style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>{ex.prValue} kg</span> · {fmtShort(ex.prDate)}</span>
        </div>
        {ex.plateau && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <span className="text-xs font-bold" style={{ color: '#F59E0B' }}>Plateau — no PR in {Math.round((Date.parse(ex.lastDate) - Date.parse(ex.prDate)) / 86400000)}d</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={cardStyle}>
          <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{ex.realReps} real rep{ex.realReps === 1 ? '' : 's'} logged · rest estimated</span>
        </div>
      </div>

      {ex.bodyweightBased && (
        <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
          Log added weight only (0 = bodyweight). Total load = {ex.bwPct}% of your bodyweight ({bodyweight} kg = {Math.round(bodyweight * ex.bwPct) / 100} kg moved) + added — this movement leaves part of your mass unloaded. Set your bodyweight on the exercise grid.
        </p>
      )}

      <div className="rounded-xl p-5" style={cardStyle}>
        <Label>Est. 1RM Over Time</Label>
        {ex.trend.length < 2 ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--color-text-subtle)' }}>Log this exercise across more sessions to see progression.</p>
        ) : (
          <div className="h-56" data-noswipe>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ex.trend.map(t => ({ ...t, label: fmtShort(t.date) }))} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" />
                <XAxis dataKey="label" tick={tick} stroke="#2E2E2E" minTickGap={16} />
                <YAxis tick={tick} stroke="#2E2E2E" width={40} domain={['dataMin - 5', 'dataMax + 5']} />
                <Tooltip {...chartTooltipStyle} formatter={(v: unknown, n: unknown) => [`${v} kg`, n === 'fit' ? 'Trend' : 'Est. 1RM']} />
                <ReferenceLine y={ex.prValue} stroke="#C8102E" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: `PR ${ex.prValue}`, position: 'insideTopRight', fontSize: 10, fill: '#C8102E' }} />
                <Line type="monotone" dataKey="fit" stroke="#8A8A8A" strokeWidth={1.5} strokeDasharray="5 4" dot={false} {...anim} />
                <Line type="monotone" dataKey="e1rm" stroke="#A78BFA" strokeWidth={2} dot={{ r: 3, fill: '#A78BFA' }} activeDot={{ r: 5 }} {...anim} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-xl p-5" style={cardStyle}>
        <Label>Volume Per Session <span style={{ textTransform: 'none', color: '#8A8A8A' }}>· load × reps</span></Label>
        {ex.volumeTrend.length < 1 ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--color-text-subtle)' }}>No volume data.</p>
        ) : (
          <div className="h-52" data-noswipe>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ex.volumeTrend.map(t => ({ ...t, label: fmtShort(t.date) }))} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
                <XAxis dataKey="label" tick={tick} stroke="#2E2E2E" minTickGap={16} />
                <YAxis tick={tick} stroke="#2E2E2E" width={44} />
                <Tooltip {...chartTooltipStyle} formatter={(v: unknown) => [`${v} kg`, 'Volume']} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="volume" fill="#00BFA5" radius={[3, 3, 0, 0]} {...anim} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-xl p-5" style={cardStyle}>
        <Label>Strength Curve — Predicted vs Best Logged</Label>
        <div className="h-56" data-noswipe>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={ex.curve} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" />
              <XAxis dataKey="rep" tick={tick} stroke="#2E2E2E" label={{ value: 'Reps', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#8A8A8A' }} />
              <YAxis tick={tick} stroke="#2E2E2E" width={40} />
              <Tooltip {...chartTooltipStyle} formatter={(v: unknown, n: unknown) => [`${v} kg`, n === 'predicted' ? 'Predicted' : 'Best logged']} labelFormatter={l => `${l} reps`} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={v => (v === 'predicted' ? 'Predicted' : 'Best logged')} />
              <Line type="monotone" dataKey="predicted" stroke="#8A8A8A" strokeWidth={2} strokeDasharray="4 4" dot={false} {...anim} />
              <Line type="monotone" dataKey="logged" stroke="#00BFA5" strokeWidth={2} dot={{ r: 3, fill: '#00BFA5' }} connectNulls {...anim} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={cardStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 1fr' }}>
          <div className="px-5 py-2.5 text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-subtle)', fontFamily: 'var(--font-heading)', borderBottom: '1px solid #2E2E2E' }}>Reps</div>
          <div className="px-3 py-2.5 text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-subtle)', fontFamily: 'var(--font-heading)', borderBottom: '1px solid #2E2E2E' }}>
            Predicted <span style={{ textTransform: 'none', color: '#8A8A8A', fontFamily: 'var(--font-sans)' }}>· from {fmt(ex.sourceDate)}</span>
          </div>
          <div className="px-3 py-2.5 text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-subtle)', fontFamily: 'var(--font-heading)', borderBottom: '1px solid #2E2E2E' }}>
            Best logged{ex.bodyweightBased ? <span style={{ textTransform: 'none', color: '#8A8A8A', fontFamily: 'var(--font-sans)' }}> · total load</span> : null}
          </div>
          {ex.rows.map(row => {
            const isSource = row.rep === ex.sourceReps
            const italic = row.loggedKind !== 'actual'
            return (
              <Fragment key={row.rep}>
                <div className="px-5 py-2 text-sm" style={{ borderBottom: '1px solid #1F1F1F', color: isSource ? '#00BFA5' : '#A0A0A0', fontWeight: isSource ? 700 : 400, fontFamily: 'var(--font-mono)' }}>{row.rep}</div>
                <div className="px-3 py-2 text-sm" style={{ borderBottom: '1px solid #1F1F1F', color: '#F5F5F5', fontWeight: isSource ? 700 : 400, fontFamily: 'var(--font-mono)' }}>{row.predicted} kg</div>
                <div className="px-3 py-2 text-sm" style={{ borderBottom: '1px solid #1F1F1F', fontFamily: 'var(--font-mono)' }}>
                  {row.logged === null ? <span style={{ color: '#5A5A5A' }}>—</span> : (
                    <span style={{ color: italic ? '#8A8A8A' : '#00BFA5', fontStyle: italic ? 'italic' : 'normal' }}>
                      {row.logged} kg
                      <span style={{ color: '#6A6A6A', fontStyle: 'normal' }}> · {row.loggedDate ? fmt(row.loggedDate) : row.loggedKind === 'interp' ? 'interp' : 'est'}</span>
                    </span>
                  )}
                </div>
              </Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )
}
