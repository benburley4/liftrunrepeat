'use client'

import { useState, useEffect } from 'react'
import { Check, Calendar, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import QuickLogFAB from '@/components/log/QuickLogFAB'
import { upsertSession, getSessions, getProgrammes } from '@/lib/db'
import { formatTimeInput } from '@/lib/utils'

type SessionType = 'lift' | 'run' | 'hybrid'
type TemplateKind = 'lift' | 'run' | 'hybrid'

interface PlannedSet { id: string; reps: string; weight: string }
interface PlannedExercise { id: string; exerciseName: string; sets: PlannedSet[] }
interface PlannedSegment { id: string; segmentType: string; metric: string; value: string; pace?: string }
interface PlannedRepeat { id: string; kind: 'repeat'; count: string; laps: PlannedSegment[] }
type PlannedRunEntry = PlannedSegment | PlannedRepeat

interface StoredTemplate {
  id: string; name: string; type: TemplateKind
  exerciseRows?: PlannedExercise[]
  runRows?: PlannedRunEntry[]
}

interface CellData { template: StoredTemplate; rpe: number }
interface Programme { id?: string; name: string; weeks: number; startDate: string; cells: Record<string, CellData> }

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const CURRENT_KEY = 'lrr_current_programme_id'

async function loadCurrentProgramme(): Promise<Programme | null> {
  try {
    const progs = await getProgrammes() as Programme[]
    if (progs.length === 0) return null
    if (progs.length === 1) return progs[0]
    const currentId = localStorage.getItem(CURRENT_KEY)
    if (currentId) {
      const found = progs.find(p => p.id === currentId)
      if (found) return found
    }
    return progs[0]
  } catch { return null }
}

function getMonday(dateStr: string): Date {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d
}

function findCellForDate(prog: Programme, date: Date): { cell: CellData; week: number; dayName: string } | null {
  const start = getMonday(prog.startDate)
  const d = new Date(date); d.setHours(0,0,0,0)
  const daysSince = Math.floor((d.getTime() - start.getTime()) / 86400000)
  if (daysSince < 0) return null
  const weekIdx = Math.floor(daysSince / 7)
  const dayIdx = daysSince % 7
  if (weekIdx >= prog.weeks) return null
  const cell = prog.cells[`w${weekIdx}d${dayIdx}`]
  return cell ? { cell, week: weekIdx + 1, dayName: DAYS[dayIdx] } : null
}

function typeColor(type: TemplateKind): string {
  return type === 'lift' ? '#00BFA5' : type === 'run' ? '#C8102E' : '#a78bfa'
}

function typeLabel(type: TemplateKind): string {
  return type === 'lift' ? 'Lifting' : type === 'run' ? 'Run' : 'Hybrid'
}


function epley1RM(weight: number, reps: number): number {
  return reps === 1 ? weight : Math.round(weight * (1 + reps / 30))
}

// ─── Logged session types ─────────────────────────────────────────────────────

interface ActualSet { reps: string; weight: string; rpe: string }

interface LoggedExercise {
  id: string; exerciseName: string
  plannedSets: Array<{ reps: string; weight: string }>
  actualSets: ActualSet[]
}

interface LoggedRunSegment {
  id: string; segmentType: string; metric: string
  plannedValue: string; plannedPace: string
  actualValue: string; actualPace: string
}

interface LoggedRepeat {
  id: string; kind: 'repeat'; count: string
  laps: LoggedRunSegment[]
}

type LoggedRunEntry = LoggedRunSegment | LoggedRepeat

function initExercises(rows: PlannedExercise[]): LoggedExercise[] {
  return rows
    .filter(row => row.exerciseName?.trim())
    .map(row => {
      const validSets = row.sets.filter(s => s.reps?.trim() || s.weight?.trim())
      const sets = validSets.length > 0 ? validSets : [{ id: '', reps: '', weight: '' }]
      return {
        id: row.id, exerciseName: row.exerciseName,
        plannedSets: sets.map(s => ({ reps: s.reps, weight: s.weight })),
        actualSets: sets.map(s => ({ reps: s.reps, weight: s.weight, rpe: '' })),
      }
    })
}

function initRunEntries(rows: PlannedRunEntry[]): LoggedRunEntry[] {
  const result: LoggedRunEntry[] = []
  for (const entry of rows) {
    if ('kind' in entry && entry.kind === 'repeat') {
      const validLaps = entry.laps.filter(lap => lap.value?.trim())
      if (validLaps.length === 0) continue
      result.push({
        id: entry.id, kind: 'repeat' as const, count: entry.count,
        laps: validLaps.map(lap => ({
          id: lap.id, segmentType: lap.segmentType, metric: lap.metric,
          plannedValue: lap.value, plannedPace: lap.pace ?? '',
          actualValue: lap.value, actualPace: lap.pace ?? '',
        })),
      })
    } else {
      const seg = entry as PlannedSegment
      if (!seg.value?.trim()) continue
      result.push({
        id: seg.id, segmentType: seg.segmentType, metric: seg.metric,
        plannedValue: seg.value, plannedPace: seg.pace ?? '',
        actualValue: seg.value, actualPace: seg.pace ?? '',
      })
    }
  }
  return result
}

// ─── Run segment row ──────────────────────────────────────────────────────────

const RUN_SEGMENT_TYPES = ['easy','tempo','interval','rest','warmup','cooldown','recovery','hills','long']
const RUN_METRICS = ['distance', 'time', 'pace']

function LoggedRunSegmentRow({ seg, entryIdx, lapIdx, onUpdate, onUpdateMeta }: {
  seg: LoggedRunSegment
  entryIdx: number
  lapIdx?: number
  onUpdate: (entryIdx: number, field: 'actualValue' | 'actualPace', value: string, lapIdx?: number) => void
  onUpdateMeta?: (entryIdx: number, field: 'segmentType' | 'metric', value: string, lapIdx?: number) => void
}) {
  const unit = seg.metric === 'distance' ? 'km' : seg.metric === 'time' ? 'min' : ''
  const plannedLabel = seg.plannedValue
    ? `${seg.plannedValue}${unit ? ' ' + unit : ''}${seg.plannedPace ? ` @ ${seg.plannedPace}/km` : ''}`
    : ''
  const showPace = seg.metric === 'distance' || seg.metric === 'time'

  return (
    <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
      {onUpdateMeta ? (
        <select
          value={seg.segmentType}
          onChange={e => onUpdateMeta(entryIdx, 'segmentType', e.target.value, lapIdx)}
          className="text-xs font-semibold rounded px-2 py-0.5 outline-none cursor-pointer flex-shrink-0"
          style={{ background: '#C8102E20', color: '#C8102E', border: '1px solid #C8102E40', fontFamily: 'Inter, sans-serif' }}
        >
          {RUN_SEGMENT_TYPES.map(t => <option key={t} value={t} style={{ background: '#1A1A1A', color: '#F5F5F5' }}>{t}</option>)}
        </select>
      ) : (
        <span className="text-xs font-semibold capitalize px-2 py-0.5 rounded flex-shrink-0"
          style={{ background: '#C8102E20', color: '#C8102E', fontFamily: 'Inter, sans-serif' }}>
          {seg.segmentType}
        </span>
      )}
      {onUpdateMeta && (
        <select
          value={seg.metric}
          onChange={e => onUpdateMeta(entryIdx, 'metric', e.target.value, lapIdx)}
          className="text-xs rounded px-2 py-0.5 outline-none cursor-pointer flex-shrink-0"
          style={{ background: '#242424', color: '#A0A0A0', border: '1px solid #2E2E2E', fontFamily: 'Inter, sans-serif' }}
        >
          {RUN_METRICS.map(m => <option key={m} value={m} style={{ background: '#1A1A1A', color: '#F5F5F5' }}>{m}</option>)}
        </select>
      )}
      {plannedLabel && (
        <span className="text-xs flex-shrink-0" style={{ color: '#3E3E3E', fontFamily: 'JetBrains Mono, monospace' }}>
          {plannedLabel}
        </span>
      )}
      {plannedLabel && <span className="text-xs" style={{ color: '#3E3E3E' }}>→</span>}
      <div className="flex items-center gap-1 flex-shrink-0">
        <input
          type={seg.metric === 'time' ? 'text' : 'number'}
          value={seg.actualValue}
          onChange={e => onUpdate(entryIdx, 'actualValue', seg.metric === 'time' ? formatTimeInput(e.target.value) : e.target.value, lapIdx)}
          placeholder={seg.metric === 'distance' ? '0.0' : '0:00'}
          className="w-16 text-center py-1.5 rounded text-xs outline-none"
          style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #2E2E2E', fontFamily: 'JetBrains Mono, monospace' }}
        />
        {unit && <span className="text-xs" style={{ color: '#606060' }}>{unit}</span>}
      </div>
      {showPace && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <input
            type="text"
            value={seg.actualPace}
            onChange={e => onUpdate(entryIdx, 'actualPace', formatTimeInput(e.target.value), lapIdx)}
            placeholder="5:30"
            className="w-16 text-center py-1.5 rounded text-xs outline-none"
            style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #2E2E2E', fontFamily: 'JetBrains Mono, monospace' }}
          />
          <span className="text-xs" style={{ color: '#606060' }}>/km</span>
        </div>
      )}
    </div>
  )
}

export default function LogSessionPage() {
  const [sessionType, setSessionType] = useState<SessionType>('hybrid')
  const [sessionName, setSessionName] = useState('')
  const [saved, setSaved] = useState(false)
  const [transitionTime, setTransitionTime] = useState('15')
  const [todayPlan, setTodayPlan] = useState<{ cell: CellData; week: number; dayName: string; progName: string } | null>(null)
  const [dayOffset, setDayOffset] = useState(0)
  const [loggedExercises, setLoggedExercises] = useState<LoggedExercise[]>([])
  const [loggedRun, setLoggedRun] = useState<LoggedRunEntry[]>([])
  const [showAddEx, setShowAddEx] = useState(false)
  const [addExName, setAddExName] = useState('')

  const now = new Date()
  const selectedDate = new Date(now)
  selectedDate.setDate(now.getDate() + dayOffset)

  const dateStr = selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const dateIso = selectedDate.toISOString().split('T')[0]
  const isToday = dayOffset === 0

  useEffect(() => {
    loadCurrentProgramme().then(prog => {
      if (!prog) {
        setTodayPlan(null); setSessionName('')
        setLoggedExercises([]); setLoggedRun([])
        return
      }
      const found = findCellForDate(prog, selectedDate)
      if (!found) {
        setTodayPlan(null); setSessionName('')
        setLoggedExercises([]); setLoggedRun([])
        return
      }
      setTodayPlan({ ...found, progName: prog.name })
      setSessionName(found.cell.template.name)
      setSessionType(found.cell.template.type as SessionType)
      setLoggedExercises(initExercises(found.cell.template.exerciseRows ?? []))
      setLoggedRun(initRunEntries(found.cell.template.runRows ?? []))
    }).catch(() => {
      setTodayPlan(null); setSessionName('')
      setLoggedExercises([]); setLoggedRun([])
    })
  }, [dayOffset])

  function updateSet(exId: string, si: number, field: keyof ActualSet, value: string) {
    setLoggedExercises(prev => prev.map(ex => ex.id !== exId ? ex : {
      ...ex, actualSets: ex.actualSets.map((s, i) => i === si ? { ...s, [field]: value } : s)
    }))
  }

  function addSet(exId: string) {
    setLoggedExercises(prev => prev.map(ex => ex.id !== exId ? ex : {
      ...ex, actualSets: [...ex.actualSets, { reps: ex.actualSets.at(-1)?.reps ?? '', weight: ex.actualSets.at(-1)?.weight ?? '', rpe: '' }]
    }))
  }

  function removeSet(exId: string, si: number) {
    setLoggedExercises(prev => prev.map(ex => ex.id !== exId ? ex : {
      ...ex, actualSets: ex.actualSets.filter((_, i) => i !== si)
    }))
  }

  function updateRunActual(entryIdx: number, field: 'actualValue' | 'actualPace', value: string, lapIdx?: number) {
    setLoggedRun(prev => prev.map((entry, i) => {
      if (i !== entryIdx) return entry
      if ('kind' in entry && entry.kind === 'repeat' && lapIdx !== undefined) {
        return { ...entry, laps: entry.laps.map((lap, li) => li === lapIdx ? { ...lap, [field]: value } : lap) }
      }
      return { ...entry, [field]: value }
    }))
  }

  function updateRunMeta(entryIdx: number, field: 'segmentType' | 'metric', value: string, lapIdx?: number) {
    setLoggedRun(prev => prev.map((entry, i) => {
      if (i !== entryIdx) return entry
      if ('kind' in entry && entry.kind === 'repeat' && lapIdx !== undefined) {
        return { ...entry, laps: entry.laps.map((lap, li) => li === lapIdx ? { ...lap, [field]: value } : lap) }
      }
      return { ...entry, [field]: value }
    }))
  }

  function addManualExercise() {
    if (!addExName.trim()) return
    setLoggedExercises(prev => [...prev, {
      id: `ex-${Date.now()}`, exerciseName: addExName.trim(),
      plannedSets: [], actualSets: [{ reps: '', weight: '', rpe: '' }],
    }])
    setAddExName(''); setShowAddEx(false)
  }

  function addManualRunSegment() {
    setLoggedRun(prev => [...prev, {
      id: `seg-${Date.now()}`, segmentType: 'easy', metric: 'distance',
      plannedValue: '', plannedPace: '', actualValue: '', actualPace: '',
    }])
  }

  const handleSave = async () => {
    const session = {
      type: sessionType,
      name: sessionName || `${sessionType.charAt(0).toUpperCase() + sessionType.slice(1)} Session`,
      date: dateIso,
      savedAt: now.toISOString(),
      exercises: loggedExercises,
      run: loggedRun,
    }
    // If a session for this date already exists, delete it first then upsert the new one
    const existing = await getSessions()
    const prev = existing.find(s => s.date === dateIso)
    if (prev && prev.savedAt !== session.savedAt) {
      const { deleteSession } = await import('@/lib/db')
      await deleteSession(prev.savedAt).catch(console.error)
    }
    await upsertSession(session)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div style={{ background: '#0D0D0D', minHeight: '100vh' }}>
      <QuickLogFAB />

      {/* Header */}
      <div className="pt-16 pb-6" style={{ background: '#0A0A0A', borderBottom: '1px solid #1A1A1A' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6">

          {/* Date navigation */}
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => setDayOffset(d => d - 1)}
              className="p-1 rounded"
              style={{ color: '#606060', background: '#1A1A1A', border: '1px solid #2E2E2E' }}
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
                {dateStr}
              </span>
              {isToday && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: '#00BFA520', color: '#00BFA5', fontFamily: 'Inter, sans-serif' }}>
                  Today
                </span>
              )}
            </div>
            <button
              onClick={() => setDayOffset(d => d + 1)}
              className="p-1 rounded"
              style={{ color: '#606060', background: '#1A1A1A', border: '1px solid #2E2E2E' }}
            >
              <ChevronRight size={16} />
            </button>
            {dayOffset !== 0 && (
              <button
                onClick={() => setDayOffset(0)}
                className="text-xs ml-2"
                style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}
              >
                Back to today
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-2">
            <input
              type="text"
              value={sessionName}
              onChange={e => setSessionName(e.target.value)}
              placeholder="Session name..."
              className="flex-1 bg-transparent outline-none text-3xl font-black uppercase"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                color: '#F5F5F5',
                borderBottom: '1px solid #2E2E2E',
                paddingBottom: '4px',
              }}
            />
            {todayPlan && (
              <div className="flex items-center gap-2 px-3 py-2 rounded text-sm flex-shrink-0"
                style={{ background: `${typeColor(todayPlan.cell.template.type)}15`, border: `1px solid ${typeColor(todayPlan.cell.template.type)}40`, color: typeColor(todayPlan.cell.template.type), fontFamily: 'Inter, sans-serif' }}>
                <Calendar size={13} />
                <span>{todayPlan.progName} · Wk {todayPlan.week} · {todayPlan.dayName}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* No session planned — manual entry prompt */}
        {!todayPlan && loggedExercises.length === 0 && loggedRun.length === 0 && (
          <div className="rounded-xl p-6" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: '#F5F5F5', fontFamily: 'Montserrat, sans-serif' }}>No session planned</p>
            <p className="text-xs mb-5" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Log a manual session for this day</p>
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => setShowAddEx(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: 'rgba(0,191,165,0.08)', color: '#00BFA5', border: '1px solid rgba(0,191,165,0.2)', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
                <Plus size={14} /> Add Lifting
              </button>
              <button onClick={addManualRunSegment}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: 'rgba(200,16,46,0.08)', color: '#C8102E', border: '1px solid rgba(200,16,46,0.2)', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
                <Plus size={14} /> Add Run
              </button>
            </div>
          </div>
        )}

        {/* Lift Block */}
        {(loggedExercises.length > 0 || showAddEx) && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: '#2E2E2E' }} />
              <span className="text-xs uppercase font-bold tracking-widest px-3"
                style={{ color: '#00BFA5', fontFamily: 'Montserrat, sans-serif', fontSize: '14px' }}>Lift Block</span>
              <div className="flex-1 h-px" style={{ background: '#2E2E2E' }} />
            </div>

            {loggedExercises.map(ex => {
              const maxRM = ex.actualSets.reduce((best, s) => {
                const w = parseFloat(s.weight), r = parseInt(s.reps)
                return (!isNaN(w) && !isNaN(r) && r > 0) ? Math.max(best, epley1RM(w, r)) : best
              }, 0)
              return (
                <div key={ex.id} className="rounded-xl overflow-hidden" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                  {/* Exercise header */}
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #2E2E2E', background: '#242424' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: '#00BFA5' }} />
                      <span className="font-bold text-sm uppercase" style={{ color: '#F5F5F5', fontFamily: 'Montserrat, sans-serif', letterSpacing: '0.05em' }}>{ex.exerciseName}</span>
                    </div>
                    {maxRM > 0 && (
                      <span className="text-xs" style={{ color: '#00BFA5', fontFamily: 'JetBrains Mono, monospace' }}>Est. 1RM: {maxRM} kg</span>
                    )}
                  </div>

                  {/* Sets */}
                  <div className="p-4">
                    {/* Column headers */}
                    <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: '28px 76px 1fr 1fr 52px' }}>
                      <span className="text-xs text-center" style={{ color: '#606060' }}>Set</span>
                      <span className="text-xs text-center" style={{ color: '#606060' }}>Planned</span>
                      <span className="text-xs text-center" style={{ color: '#606060' }}>Reps</span>
                      <span className="text-xs text-center" style={{ color: '#606060' }}>kg</span>
                      <span className="text-xs text-center" style={{ color: '#606060' }}>RPE</span>
                    </div>

                    {ex.actualSets.map((set, si) => {
                      const planned = ex.plannedSets[si]
                      return (
                        <div key={si} className="grid gap-2 mb-2 items-center" style={{ gridTemplateColumns: '28px 76px 1fr 1fr 52px' }}>
                          <button onClick={() => removeSet(ex.id, si)}
                            className="w-6 h-6 rounded text-xs flex items-center justify-center mx-auto"
                            style={{ background: '#242424', color: '#606060', cursor: 'pointer' }}>
                            {si + 1}
                          </button>
                          <div className="text-xs text-center" style={{ color: '#3E3E3E', fontFamily: 'JetBrains Mono, monospace' }}>
                            {planned ? `${planned.reps}×${planned.weight}` : '—'}
                          </div>
                          <input type="number" value={set.reps} onChange={e => updateSet(ex.id, si, 'reps', e.target.value)}
                            placeholder="0" className="w-full text-center py-2 rounded text-sm outline-none"
                            style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #2E2E2E', fontFamily: 'JetBrains Mono, monospace' }} />
                          <input type="number" value={set.weight} onChange={e => updateSet(ex.id, si, 'weight', e.target.value)}
                            placeholder="0" className="w-full text-center py-2 rounded text-sm outline-none"
                            style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #2E2E2E', fontFamily: 'JetBrains Mono, monospace' }} />
                          <input type="number" value={set.rpe} onChange={e => updateSet(ex.id, si, 'rpe', e.target.value)}
                            placeholder="—" min="1" max="10" className="w-full text-center py-2 rounded text-sm outline-none"
                            style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #2E2E2E', fontFamily: 'JetBrains Mono, monospace' }} />
                        </div>
                      )
                    })}

                    <button onClick={() => addSet(ex.id)}
                      className="flex items-center gap-1.5 text-xs mt-1 px-2 py-1.5 rounded"
                      style={{ color: '#00BFA5', fontFamily: 'Inter, sans-serif' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,191,165,0.08)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <Plus size={12} /> Add Set
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Add exercise */}
            {showAddEx ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text" value={addExName} onChange={e => setAddExName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addManualExercise(); if (e.key === 'Escape') { setShowAddEx(false); setAddExName('') } }}
                  placeholder="Exercise name…"
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #00BFA544', fontFamily: 'Inter, sans-serif' }}
                />
                <button onClick={addManualExercise}
                  className="px-3 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: '#00BFA5', color: '#0D0D0D', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
                  Add
                </button>
                <button onClick={() => { setShowAddEx(false); setAddExName('') }}
                  className="px-3 py-2 rounded-lg text-sm"
                  style={{ color: '#606060', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setShowAddEx(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: 'rgba(0,191,165,0.08)', color: '#00BFA5', border: '1px solid rgba(0,191,165,0.2)', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
                <Plus size={14} /> Add Exercise
              </button>
            )}
          </div>
        )}

        {/* Transition time (hybrid) */}
        {loggedExercises.length > 0 && loggedRun.length > 0 && (
          <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#606060' }}>Transition Time</p>
              <p className="text-xs" style={{ color: '#606060' }}>Time between lift and run blocks</p>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" value={transitionTime} onChange={e => setTransitionTime(e.target.value)}
                className="w-16 text-center py-2 rounded outline-none text-sm"
                style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #2E2E2E', fontFamily: 'JetBrains Mono, monospace' }} />
              <span className="text-sm" style={{ color: '#606060' }}>min</span>
            </div>
          </div>
        )}

        {/* Run Block */}
        {loggedRun.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: '#2E2E2E' }} />
              <span className="text-xs uppercase font-bold tracking-widest px-3"
                style={{ color: '#C8102E', fontFamily: 'Montserrat, sans-serif', fontSize: '14px' }}>Run Block</span>
              <div className="flex-1 h-px" style={{ background: '#2E2E2E' }} />
            </div>

            {loggedRun.map((entry, entryIdx) => {
              if ('kind' in entry && entry.kind === 'repeat') {
                return (
                  <div key={entry.id} className="rounded-xl overflow-hidden" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                    <div className="px-4 py-2" style={{ background: '#242424', borderBottom: '1px solid #2E2E2E' }}>
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#C8102E', fontFamily: 'Montserrat, sans-serif' }}>
                        ×{entry.count} Repeat
                      </span>
                    </div>
                    {entry.laps.map((lap, lapIdx) => (
                      <LoggedRunSegmentRow key={lap.id} seg={lap} entryIdx={entryIdx} lapIdx={lapIdx} onUpdate={updateRunActual} onUpdateMeta={updateRunMeta} />
                    ))}
                  </div>
                )
              }
              const seg = entry as LoggedRunSegment
              const isManual = !seg.plannedValue
              return (
                <div key={seg.id} className="rounded-xl overflow-hidden" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                  <LoggedRunSegmentRow seg={seg} entryIdx={entryIdx} onUpdate={updateRunActual} onUpdateMeta={isManual ? updateRunMeta : undefined} />
                </div>
              )
            })}

            <button onClick={addManualRunSegment}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: 'rgba(200,16,46,0.08)', color: '#C8102E', border: '1px solid rgba(200,16,46,0.2)', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
              <Plus size={14} /> Add Segment
            </button>
          </div>
        )}

        {/* Save bar */}
        <div
          className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 flex items-center justify-between gap-4"
          style={{ background: 'rgba(13,13,13,0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid #2E2E2E' }}
        >
          <button className="text-sm" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
            Discard
          </button>
          <button
            onClick={handleSave}
            className="px-8 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
            style={{
              background: saved ? '#1A1A1A' : '#00BFA5',
              color: saved ? '#00BFA5' : '#0D0D0D',
              border: saved ? '1px solid #00BFA5' : 'none',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {saved ? (
              <>
                <Check size={16} />
                Session Saved!
              </>
            ) : (
              'Save Session'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
