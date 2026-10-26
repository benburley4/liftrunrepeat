'use client'

import { useState } from 'react'
import { ChevronLeft, Pencil, Check, X, Trash2 } from 'lucide-react'
import type { SessionData, ActualSet, LoggedRunSegment } from '@/lib/computeStats'
import { activityKind } from '@/lib/progressData'
import WatchWorkoutPanel from '@/components/history/WatchWorkoutPanel'
import { ACTIVITY_COLORS, ACTIVITY_LABELS, cardStyle } from './progressStyle'

const RUN = ACTIVITY_COLORS.run
const HIKE = ACTIVITY_COLORS.hike

function RunRow({ lap, editing, onUpdate }: {
  lap: LoggedRunSegment
  editing: boolean
  onUpdate: (field: 'actualValue' | 'actualPace', value: string) => void
}) {
  const unit = lap.metric === 'distance' ? 'km' : lap.metric === 'time' ? 'min' : ''
  const showPace = lap.metric === 'distance' || lap.metric === 'time'
  const input = { background: '#242424', color: '#F5F5F5', border: '1px solid #00BFA544', fontFamily: 'var(--font-mono)' }
  return (
    <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
      <span className="text-xs font-semibold capitalize px-2 py-0.5 rounded flex-shrink-0" style={{ background: `${RUN}20`, color: RUN }}>{lap.segmentType}</span>
      {lap.plannedValue && (
        <span className="text-xs flex-shrink-0" style={{ color: '#6A6A6A', fontFamily: 'var(--font-mono)' }}>
          plan {lap.plannedValue}{unit ? ' ' + unit : ''}{lap.plannedPace ? ` @ ${lap.plannedPace}/km` : ''}
        </span>
      )}
      <div className="flex items-center gap-1 flex-shrink-0">
        {editing ? (
          <input type={lap.metric === 'time' ? 'text' : 'number'} value={lap.actualValue} aria-label="Actual"
            onChange={e => onUpdate('actualValue', e.target.value)} className="w-16 text-center py-1.5 rounded text-xs outline-none" style={input} />
        ) : (
          <span className="text-sm font-semibold" style={{ color: lap.actualValue ? '#F5F5F5' : '#5A5A5A', fontFamily: 'var(--font-mono)' }}>{lap.actualValue || '—'}</span>
        )}
        {unit && <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{unit}</span>}
      </div>
      {showPace && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {editing ? (
            <input type="text" value={lap.actualPace} onChange={e => onUpdate('actualPace', e.target.value)} aria-label="Pace"
              placeholder="5:30" className="w-16 text-center py-1.5 rounded text-xs outline-none" style={input} />
          ) : (
            <span className="text-sm font-semibold" style={{ color: lap.actualPace ? '#F5F5F5' : '#5A5A5A', fontFamily: 'var(--font-mono)' }}>{lap.actualPace || '—'}</span>
          )}
          <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>/km</span>
        </div>
      )}
    </div>
  )
}

export default function SessionDetail({ session, demo, onBack, onSave, onDelete }: {
  session: SessionData
  demo: boolean
  onBack: () => void
  onSave: (s: SessionData) => Promise<void>
  onDelete: (savedAt: string) => void
}) {
  const [edit, setEdit] = useState<SessionData | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const sess = edit ?? session
  const kind = activityKind(sess)
  const col = ACTIVITY_COLORS[kind]
  const dateLabel = new Date(`${sess.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const btn = { color: '#A0A0A0', border: '1px solid #2E2E2E', cursor: 'pointer' }

  function updateSet(exId: string, si: number, field: keyof ActualSet, value: string) {
    if (!edit) return
    setEdit({ ...edit, exercises: edit.exercises?.map(ex => ex.id !== exId ? ex : { ...ex, actualSets: ex.actualSets.map((s, i) => i === si ? { ...s, [field]: value } : s) }) })
  }
  function updateRun(entryIdx: number, field: 'actualValue' | 'actualPace', value: string, lapIdx?: number) {
    if (!edit) return
    setEdit({ ...edit, run: edit.run?.map((entry, i) => {
      if (i !== entryIdx) return entry
      if ('kind' in entry && entry.kind === 'repeat' && lapIdx !== undefined)
        return { ...entry, laps: entry.laps.map((lap, li) => li === lapIdx ? { ...lap, [field]: value } : lap) }
      return { ...entry, [field]: value }
    }) })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm" style={{ color: '#A0A0A0', cursor: 'pointer' }}>
          <ChevronLeft size={16} /> Back
        </button>
        {!demo && (edit ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setEdit(null)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm" style={btn}><X size={14} /> Cancel</button>
            <button type="button" onClick={async () => { await onSave(edit); setEdit(null) }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold"
              style={{ background: '#00BFA5', color: '#0D0D0D', cursor: 'pointer' }}><Check size={14} /> Save</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {confirmDelete ? (
              <>
                <button type="button" onClick={() => { onDelete(session.savedAt); setConfirmDelete(false) }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold"
                  style={{ background: '#C8102E', color: '#fff', cursor: 'pointer' }}><Trash2 size={13} /> Confirm Delete</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm" style={btn}><X size={13} /> Cancel</button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm" style={btn}><Trash2 size={13} /> Delete</button>
            )}
            <button type="button" onClick={() => setEdit(JSON.parse(JSON.stringify(session)))} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold"
              style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #2E2E2E', cursor: 'pointer' }}><Pencil size={13} /> Edit</button>
          </div>
        ))}
      </div>

      <div className="rounded-xl px-5 py-4" style={{ background: '#1A1A1A', border: `1px solid ${col}40` }}>
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: col }}>{dateLabel}</p>
        <h2 className="text-2xl font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>{sess.name}</h2>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold mt-2 inline-block" style={{ background: `${col}22`, color: col }}>{ACTIVITY_LABELS[kind]}</span>
      </div>

      {(sess.exercises ?? []).map(ex => (
        <div key={ex.id} className="rounded-xl overflow-hidden" style={cardStyle}>
          <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #2E2E2E', background: '#242424' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: ACTIVITY_COLORS.lift }} aria-hidden="true" />
            <span className="font-bold text-sm uppercase" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}>{ex.exerciseName}</span>
          </div>
          <div className="p-4">
            <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: '28px 76px 1fr 1fr 52px' }}>
              {['Set', 'Planned', 'Reps', 'kg', 'RPE'].map(h => <span key={h} className="text-xs text-center" style={{ color: 'var(--color-text-subtle)' }}>{h}</span>)}
            </div>
            {ex.actualSets.map((set, si) => {
              const planned = ex.plannedSets[si]
              return (
                <div key={si} className="grid gap-2 mb-2 items-center" style={{ gridTemplateColumns: '28px 76px 1fr 1fr 52px' }}>
                  <span className="w-6 h-6 rounded text-xs flex items-center justify-center mx-auto" style={{ background: '#242424', color: '#8A8A8A', fontFamily: 'var(--font-mono)' }}>{si + 1}</span>
                  <span className="text-xs text-center" style={{ color: '#6A6A6A', fontFamily: 'var(--font-mono)' }}>{planned ? `${planned.reps}×${planned.weight}` : '—'}</span>
                  {(['reps', 'weight', 'rpe'] as const).map(field => edit ? (
                    <input key={field} type="number" value={set[field]} aria-label={`Set ${si + 1} ${field}`}
                      onChange={e => updateSet(ex.id, si, field, e.target.value)} placeholder={field === 'rpe' ? '—' : '0'}
                      className="w-full text-center py-2 rounded text-sm outline-none"
                      style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #00BFA544', fontFamily: 'var(--font-mono)' }} />
                  ) : (
                    <span key={field} className="text-sm text-center py-2 rounded block"
                      style={{ background: '#242424', color: set[field] ? '#F5F5F5' : '#5A5A5A', fontFamily: 'var(--font-mono)' }}>{set[field] || '—'}</span>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {(sess.run ?? []).map((entry, entryIdx) => {
        if ('kind' in entry && entry.kind === 'repeat') {
          return (
            <div key={entry.id} className="rounded-xl overflow-hidden" style={cardStyle}>
              <div className="px-4 py-2" style={{ background: '#242424', borderBottom: '1px solid #2E2E2E' }}>
                <span className="text-xs font-bold uppercase" style={{ color: RUN, fontFamily: 'var(--font-heading)' }}>×{entry.count} Repeat</span>
              </div>
              {entry.laps.map((lap, lapIdx) => <RunRow key={lap.id} lap={lap} editing={!!edit} onUpdate={(f, v) => updateRun(entryIdx, f, v, lapIdx)} />)}
            </div>
          )
        }
        const seg = entry as LoggedRunSegment
        return (
          <div key={seg.id} className="rounded-xl overflow-hidden" style={cardStyle}>
            <RunRow lap={seg} editing={!!edit} onUpdate={(f, v) => updateRun(entryIdx, f, v)} />
          </div>
        )
      })}

      {(sess.exercises ?? []).length === 0 && (sess.run ?? []).length === 0 && !sess.hikeKm && (
        <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-subtle)' }}>No exercise or run data recorded for this session.</p>
      )}
      {sess.hikeKm != null && (
        <div className="rounded-xl overflow-hidden" style={{ background: '#1A1A1A', border: `1px solid ${HIKE}40` }}>
          <div className="px-4 py-2" style={{ background: `${HIKE}10`, borderBottom: `1px solid ${HIKE}30` }}>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: HIKE, fontFamily: 'var(--font-heading)' }}>{kind === 'walk' ? 'Walk' : 'Hike'}</span>
          </div>
          <div className="grid grid-cols-2">
            <div className="px-4 py-4">
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-subtle)' }}>Distance</p>
              <p className="text-xl font-bold" style={{ color: HIKE, fontFamily: 'var(--font-mono)' }}>{sess.hikeKm} <span className="text-sm font-normal" style={{ color: 'var(--color-text-subtle)' }}>km</span></p>
            </div>
            {sess.hikeElevationM != null && (
              <div className="px-4 py-4" style={{ borderLeft: '1px solid #2E2E2E' }}>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-subtle)' }}>Elevation Gain</p>
                <p className="text-xl font-bold" style={{ color: HIKE, fontFamily: 'var(--font-mono)' }}>{sess.hikeElevationM} <span className="text-sm font-normal" style={{ color: 'var(--color-text-subtle)' }}>m</span></p>
              </div>
            )}
          </div>
        </div>
      )}
      {sess.zepp && <WatchWorkoutPanel zepp={sess.zepp} manualOriginal={sess.manualOriginal} />}
    </div>
  )
}
