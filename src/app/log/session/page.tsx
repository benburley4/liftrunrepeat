'use client'

import { useState, useEffect, useRef } from 'react'
import { Check, Calendar, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import QuickLogFAB from '@/components/log/QuickLogFAB'
import { upsertSession, getProgrammes, getTemplates, getCustomExercises } from '@/lib/db'
import { exercises as staticExercises } from '@/lib/mockData'
import { formatTimeInput } from '@/lib/utils'

type SessionType = 'lift' | 'run' | 'hybrid' | 'hike'
type TemplateKind = 'lift' | 'run' | 'hybrid' | 'hike'

interface PlannedSet { id: string; reps: string; weight: string }
interface PlannedExercise { id: string; exerciseName: string; sets: PlannedSet[] }
interface PlannedSegment { id: string; segmentType: string; metric: string; value: string; pace?: string }
interface PlannedRepeat { id: string; kind: 'repeat'; count: string; laps: PlannedSegment[] }
type PlannedRunEntry = PlannedSegment | PlannedRepeat

interface HikeSettings { pace: string; surface: string; packWeight: string }

interface StoredTemplate {
  id: string; name: string; type: TemplateKind
  exerciseRows?: PlannedExercise[]
  runRows?: PlannedRunEntry[]
  hikeData?: { distanceKm: string; elevationGainM?: string; settings?: HikeSettings }
}

interface HikeLogData {
  plannedKm: string; plannedElevM: string
  actualKm: string;  actualElevM: string
  settings: HikeSettings | null
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

function findCellForDate(prog: Programme, date: Date, second = false): { cell: CellData; week: number; dayName: string } | null {
  const start = getMonday(prog.startDate)
  const d = new Date(date); d.setHours(0,0,0,0)
  const daysSince = Math.floor((d.getTime() - start.getTime()) / 86400000)
  const suffix = second ? '_2' : ''

  if (daysSince < 0) {
    // Date is before programme start — show week-1 plan for this day-of-week as a preview
    const dow = d.getDay()
    const dayIdx = dow === 0 ? 6 : dow - 1 // Sun=0 → 6, Mon=1 → 0, ...
    const cell = prog.cells[`w0d${dayIdx}${suffix}`]
    return cell ? { cell, week: 1, dayName: DAYS[dayIdx] } : null
  }

  const weekIdx = Math.floor(daysSince / 7)
  const dayIdx = daysSince % 7
  if (weekIdx >= prog.weeks) return null
  const cell = prog.cells[`w${weekIdx}d${dayIdx}${suffix}`]
  return cell ? { cell, week: weekIdx + 1, dayName: DAYS[dayIdx] } : null
}

function typeColor(type: TemplateKind): string {
  return type === 'lift' ? '#00BFA5' : type === 'run' ? '#C8102E' : type === 'hike' ? '#84CC16' : '#a78bfa'
}

function typeLabel(type: TemplateKind): string {
  return type === 'lift' ? 'Lifting' : type === 'run' ? 'Run' : type === 'hike' ? 'Hike' : 'Hybrid'
}


// ─── Naismith helpers ─────────────────────────────────────────────────────────

const HIKE_PACE_MULT:    Record<string, number> = { slow: 1.25, normal: 1.0, fast: 0.82, run: 0.65 }
const HIKE_SURFACE_MULT: Record<string, number> = { easy: 1.0, good: 1.08, rough: 1.22, tough: 1.48 }
const HIKE_PACK_MULT:    Record<string, number> = { light: 1.0, regular: 1.04, heavy: 1.14, 'very-heavy': 1.28 }

function hikeNaismith(km: number, elevM: number, s: HikeSettings | null): number {
  const base = km * 12 + elevM / 10
  if (!s) return base
  return base * (HIKE_PACE_MULT[s.pace] ?? 1) * (HIKE_SURFACE_MULT[s.surface] ?? 1) * (HIKE_PACK_MULT[s.packWeight] ?? 1)
}

function fmtHikeDuration(mins: number): string {
  if (mins <= 0 || !isFinite(mins)) return '—'
  const h = Math.floor(mins / 60), m = Math.round(mins % 60)
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`
}

// ─── Epley 1RM ────────────────────────────────────────────────────────────────

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

const RUN_SEGMENT_TYPES = ['easy','tempo','interval','rest','warmup','cooldown','recovery','hills','long','hike']
const RUN_METRICS = ['distance', 'time', 'pace']

function LoggedRunSegmentRow({ seg, entryIdx, lapIdx, onUpdate, onUpdateMeta }: {
  seg: LoggedRunSegment
  entryIdx: number
  lapIdx?: number
  onUpdate: (entryIdx: number, field: 'actualValue' | 'actualPace', value: string, lapIdx?: number) => void
  onUpdateMeta?: (entryIdx: number, field: 'segmentType' | 'metric', value: string, lapIdx?: number) => void
}) {
  const segColor = seg.segmentType === 'hike' ? '#84CC16' : '#C8102E'
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
          style={{ background: `${segColor}20`, color: segColor, border: `1px solid ${segColor}40`, fontFamily: 'Inter, sans-serif' }}
        >
          {RUN_SEGMENT_TYPES.map(t => <option key={t} value={t} style={{ background: '#1A1A1A', color: '#F5F5F5' }}>{t}</option>)}
        </select>
      ) : (
        <span className="text-xs font-semibold capitalize px-2 py-0.5 rounded flex-shrink-0"
          style={{ background: `${segColor}20`, color: segColor, fontFamily: 'Inter, sans-serif' }}>
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
  const [selectedIso, setSelectedIso] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [loggedExercises, setLoggedExercises] = useState<LoggedExercise[]>([])
  const [loggedRun, setLoggedRun] = useState<LoggedRunEntry[]>([])
  const [loggedHike, setLoggedHike] = useState<HikeLogData | null>(null)
  const [showAddEx, setShowAddEx] = useState(false)
  const [addExSearch, setAddExSearch] = useState('')
  const [allExercises, setAllExercises] = useState<{ id: string; name: string }[]>(staticExercises.map(e => ({ id: e.id, name: e.name })))
  const [library, setLibrary] = useState<StoredTemplate[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [pickerType, setPickerType] = useState<'lift' | 'run'>('lift')
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [templateSearch, setTemplateSearch] = useState('')
  const [secondPlan, setSecondPlan] = useState<{ cell: CellData; week: number; dayName: string; progName: string } | null>(null)
  const [firstPlan, setFirstPlan] = useState<{ cell: CellData; week: number; dayName: string; progName: string } | null>(null)
  const userOverride = useRef(false) // prevents async programme load from overwriting manual template selection
  const savedAtRef = useRef<string | null>(null) // reuse savedAt on re-save to avoid duplicate DB rows

  function todayIso() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  function shiftDay(n: number) {
    const d = new Date(selectedIso + 'T00:00:00')
    d.setDate(d.getDate() + n)
    setSelectedIso(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }

  const selectedDate = new Date(selectedIso + 'T00:00:00')
  const dateStr = selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const dateIso = selectedIso
  const isToday = selectedIso === todayIso()

  useEffect(() => {
    getTemplates().then(data => setLibrary(data as StoredTemplate[])).catch(() => {})
    getCustomExercises().then(data => {
      const custom = (data as { id: string; name: string }[]).map(e => ({ id: e.id, name: e.name }))
      setAllExercises(prev => {
        const ids = new Set(prev.map(e => e.id))
        return [...prev, ...custom.filter(e => !ids.has(e.id))]
      })
    }).catch(() => {})
  }, [])

  useEffect(() => {
    userOverride.current = false // new day navigation resets override
    savedAtRef.current = null    // new day gets a fresh savedAt
    setFirstPlan(null)           // reset session slot tracking
    const isoSnapshot = selectedIso  // capture for async closure — avoids stale date if user navigates again before promise resolves
    loadCurrentProgramme().then(prog => {
      if (userOverride.current) return // user picked a template while we were loading — don't overwrite
      if (!prog) {
        setTodayPlan(null); setSecondPlan(null); setSessionName('')
        setLoggedExercises([]); setLoggedRun([]); setLoggedHike(null)
        return
      }
      const date = new Date(isoSnapshot + 'T00:00:00')
      const found = findCellForDate(prog, date)
      // Also look for second session slot (_2)
      const found2 = findCellForDate(prog, date, true)
      if (!found) {
        if (found2) {
          // Only a _2 session exists for this day — load it directly as the primary session
          const tpl2 = found2.cell.template
          const hike2 = hikeLogFromTemplate(tpl2)
          setTodayPlan({ ...found2, progName: prog.name })
          setSecondPlan(null)
          setSessionName(tpl2.name)
          setSessionType(tpl2.type as SessionType)
          setLoggedExercises(initExercises(tpl2.exerciseRows ?? []))
          setLoggedRun(hike2 ? [] : initRunEntries(tpl2.runRows ?? []))
          setLoggedHike(hike2)
        } else {
          setTodayPlan(null); setSecondPlan(null); setSessionName('')
          setLoggedExercises([]); setLoggedRun([]); setLoggedHike(null)
        }
        return
      }
      setSecondPlan(found2 ? { ...found2, progName: prog.name } : null)
      const tpl = found.cell.template
      const hike = hikeLogFromTemplate(tpl)
      setTodayPlan({ ...found, progName: prog.name })
      setSessionName(tpl.name)
      setSessionType(tpl.type as SessionType)
      setLoggedExercises(initExercises(tpl.exerciseRows ?? []))
      setLoggedRun(hike ? [] : initRunEntries(tpl.runRows ?? []))
      setLoggedHike(hike)
    }).catch(() => {
      if (userOverride.current) return
      setTodayPlan(null); setSecondPlan(null); setSessionName('')
      setLoggedExercises([]); setLoggedRun([]); setLoggedHike(null)
    })
  }, [selectedIso])

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

  function openPicker(type: 'lift' | 'run') {
    setPickerType(type)
    setShowPicker(true)
  }

  function hikeLogFromTemplate(tpl: StoredTemplate): HikeLogData | null {
    if (tpl.type !== 'hike') return null
    const d = tpl.hikeData
    return {
      plannedKm: d?.distanceKm ?? '', plannedElevM: d?.elevationGainM ?? '',
      actualKm: d?.distanceKm ?? '',  actualElevM: d?.elevationGainM ?? '',
      settings: d?.settings ?? null,
    }
  }

  function applyTemplate(tpl: StoredTemplate, opts: { replace: boolean }) {
    const hike = hikeLogFromTemplate(tpl)
    if (opts.replace) {
      setLoggedExercises(initExercises(tpl.exerciseRows ?? []))
      setLoggedRun(hike ? [] : initRunEntries(tpl.runRows ?? []))
      setLoggedHike(hike)
    } else {
      if (tpl.exerciseRows?.length) setLoggedExercises(prev => [...prev, ...initExercises(tpl.exerciseRows!)])
      if (hike) setLoggedHike(hike)
      else if (tpl.runRows?.length) setLoggedRun(prev => [...prev, ...initRunEntries(tpl.runRows!)])
    }
  }

  function loadFromTemplate(tpl: StoredTemplate) {
    applyTemplate(tpl, { replace: false })
    if (!sessionName) setSessionName(tpl.name)
    setSessionType(tpl.type as SessionType)
    setShowPicker(false)
  }

  function replaceFromTemplate(tpl: StoredTemplate) {
    userOverride.current = true // prevent async programme load from overwriting this
    savedAtRef.current = null   // fresh savedAt for the new template session
    setSessionName(tpl.name)
    setSessionType(tpl.type as SessionType)
    applyTemplate(tpl, { replace: true })
    setTodayPlan(null) // clear programme badge — session is now from template
    setSecondPlan(null)
    setShowTemplatePicker(false)
    setTemplateSearch('')
    setSaved(false)
  }

  function loadSecondSession() {
    if (!secondPlan) return
    savedAtRef.current = null // fresh savedAt for session 2
    const tpl = secondPlan.cell.template
    setFirstPlan(todayPlan) // remember session 1 so user can switch back
    setSessionName(tpl.name)
    setSessionType(tpl.type as SessionType)
    applyTemplate(tpl, { replace: true })
    setTodayPlan(secondPlan)
    setSecondPlan(null)
    setSaved(false)
  }

  function loadFirstSession() {
    if (!firstPlan) return
    savedAtRef.current = null // fresh savedAt for session 1
    const tpl = firstPlan.cell.template
    setSecondPlan(todayPlan) // session 2 plan goes back to secondPlan
    setSessionName(tpl.name)
    setSessionType(tpl.type as SessionType)
    applyTemplate(tpl, { replace: true })
    setTodayPlan(firstPlan)
    setFirstPlan(null)
    setSaved(false)
  }

  function removeExercise(exId: string) {
    setLoggedExercises(prev => prev.filter(ex => ex.id !== exId))
  }

  function addExerciseFromLibrary(name: string) {
    if (!name.trim()) return
    setLoggedExercises(prev => [...prev, {
      id: `ex-${Date.now()}`, exerciseName: name.trim(),
      plannedSets: [], actualSets: [{ reps: '', weight: '', rpe: '' }],
    }])
    setAddExSearch(''); setShowAddEx(false)
  }

  function addManualRunSegment() {
    setLoggedRun(prev => [...prev, {
      id: `seg-${Date.now()}`, segmentType: 'easy', metric: 'distance',
      plannedValue: '', plannedPace: '', actualValue: '', actualPace: '',
    }])
  }

  const handleSave = async () => {
    if (saved) return   // prevent double-save
    // For hike sessions, save distance+elevation from loggedHike; run: [] avoids double-counting
    let hikeKm: number | undefined
    let hikeElevationM: number | undefined
    let runToStore: LoggedRunEntry[] = loggedRun
    if (sessionType === 'hike' && loggedHike) {
      hikeKm = parseFloat(loggedHike.actualKm) || 0
      const elev = parseFloat(loggedHike.actualElevM)
      if (!isNaN(elev) && elev > 0) hikeElevationM = elev
      runToStore = []
    }
    // Reuse savedAt on re-save so we upsert the same DB row (no duplicate sessions)
    const savedAt = savedAtRef.current ?? new Date().toISOString()
    savedAtRef.current = savedAt
    const session = {
      type: sessionType,
      name: sessionName || `${sessionType.charAt(0).toUpperCase() + sessionType.slice(1)} Session`,
      date: dateIso,
      savedAt,
      exercises: loggedExercises,
      run: runToStore,
      ...(hikeKm !== undefined ? { hikeKm } : {}),
      ...(hikeElevationM !== undefined ? { hikeElevationM } : {}),
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
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <button
              onClick={() => shiftDay(-1)}
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
              onClick={() => shiftDay(1)}
              className="p-1 rounded"
              style={{ color: '#606060', background: '#1A1A1A', border: '1px solid #2E2E2E' }}
            >
              <ChevronRight size={16} />
            </button>

            {/* Direct date picker */}
            <input
              type="date"
              value={selectedIso}
              onChange={e => e.target.value && setSelectedIso(e.target.value)}
              className="text-xs px-2 py-1 rounded outline-none"
              style={{ background: '#1A1A1A', border: '1px solid #2E2E2E', color: '#606060', colorScheme: 'dark', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}
            />

            {!isToday && (
              <button
                onClick={() => setSelectedIso(todayIso())}
                className="text-xs"
                style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}
              >
                Back to today
              </button>
            )}
          </div>

          <input
            type="text"
            value={sessionName}
            onChange={e => setSessionName(e.target.value)}
            placeholder="Session name..."
            className="w-full bg-transparent outline-none text-3xl font-black uppercase mt-2"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              color: '#F5F5F5',
              borderBottom: '1px solid #2E2E2E',
              paddingBottom: '4px',
            }}
          />
          <div className="flex items-center gap-2 flex-wrap mt-3">
            {/* Session 1 badge — clickable when we're currently on session 2 */}
            {firstPlan ? (
              <button
                onClick={loadFirstSession}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-xs"
                style={{ background: `${typeColor(firstPlan.cell.template.type)}15`, border: `1px solid ${typeColor(firstPlan.cell.template.type)}40`, color: typeColor(firstPlan.cell.template.type), fontFamily: 'Inter, sans-serif', cursor: 'pointer', opacity: 0.7 }}
                title={`Switch back to session 1: ${firstPlan.cell.template.name}`}
              >
                <Calendar size={12} />
                <span>{firstPlan.cell.template.name} — Session 1</span>
              </button>
            ) : todayPlan && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded text-xs"
                style={{ background: `${typeColor(todayPlan.cell.template.type)}15`, border: `1px solid ${typeColor(todayPlan.cell.template.type)}40`, color: typeColor(todayPlan.cell.template.type), fontFamily: 'Inter, sans-serif' }}>
                <Calendar size={12} />
                <span>{todayPlan.progName} · Wk {todayPlan.week} · {todayPlan.dayName}{secondPlan ? ' — Session 1' : ''}</span>
              </div>
            )}
            {/* Session 2 badge — clickable when we're on session 1 with a session 2 available;
                non-clickable indicator when we're currently on session 2 (firstPlan is set) */}
            {firstPlan && todayPlan ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded text-xs"
                style={{ background: '#A78BFA20', border: '1px solid #A78BFA60', color: '#A78BFA', fontFamily: 'Inter, sans-serif' }}>
                <Calendar size={12} />
                <span>{todayPlan.cell.template.name} — Session 2</span>
              </div>
            ) : secondPlan && (
              <button
                onClick={loadSecondSession}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-xs"
                style={{ background: '#A78BFA15', border: '1px solid #A78BFA40', color: '#A78BFA', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}
                title={`Load session 2: ${secondPlan.cell.template.name}`}
              >
                <Calendar size={12} />
                <span>{secondPlan.cell.template.name} — Session 2</span>
              </button>
            )}
            <button
              onClick={() => { setShowTemplatePicker(true); setTemplateSearch('') }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold"
              style={{ background: '#1A1A1A', border: '1px solid #2E2E2E', color: '#9CA3AF', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#00BFA5'; e.currentTarget.style.color = '#00BFA5' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#2E2E2E'; e.currentTarget.style.color = '#9CA3AF' }}
            >
              ↗ Use Template
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* No session planned — manual entry prompt */}
        {!todayPlan && loggedExercises.length === 0 && loggedRun.length === 0 && !loggedHike && (
          <div className="rounded-xl p-6" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: '#F5F5F5', fontFamily: 'Montserrat, sans-serif' }}>No session planned</p>
            <p className="text-xs mb-5" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Log a manual session for this day</p>
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => openPicker('lift')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: 'rgba(0,191,165,0.08)', color: '#00BFA5', border: '1px solid rgba(0,191,165,0.2)', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
                <Plus size={14} /> Add Lifting
              </button>
              <button onClick={() => openPicker('run')}
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
                    <div className="flex items-center gap-3">
                      {maxRM > 0 && (
                        <span className="text-xs" style={{ color: '#00BFA5', fontFamily: 'JetBrains Mono, monospace' }}>Est. 1RM: {maxRM} kg</span>
                      )}
                      <button onClick={() => removeExercise(ex.id)}
                        style={{ background: 'none', border: 'none', color: '#3E3E3E', cursor: 'pointer', padding: '2px', lineHeight: 1, fontSize: 18 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#C8102E')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#3E3E3E')}
                        title="Remove exercise">
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Sets */}
                  <div className="p-4">
                    {/* Column headers */}
                    <div className="set-grid mb-2">
                      <span className="text-xs text-center" style={{ color: '#606060' }}>Set</span>
                      <span className="text-xs text-center set-planned" style={{ color: '#606060' }}>Planned</span>
                      <span className="text-xs text-center" style={{ color: '#606060' }}>Reps</span>
                      <span className="text-xs text-center" style={{ color: '#606060' }}>kg</span>
                      <span className="text-xs text-center" style={{ color: '#606060' }}>RPE</span>
                    </div>

                    {ex.actualSets.map((set, si) => {
                      const planned = ex.plannedSets[si]
                      return (
                        <div key={si} className="set-grid">
                          <button onClick={() => removeSet(ex.id, si)}
                            className="w-6 h-6 rounded text-xs flex items-center justify-center mx-auto"
                            style={{ background: '#242424', color: '#606060', cursor: 'pointer' }}>
                            {si + 1}
                          </button>
                          <div className="text-xs text-center set-planned" style={{ color: '#3E3E3E', fontFamily: 'JetBrains Mono, monospace' }}>
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
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #00BFA544', background: '#1A1A1A' }}>
                <input
                  autoFocus
                  type="text" value={addExSearch} onChange={e => setAddExSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Escape' && (setShowAddEx(false), setAddExSearch(''))}
                  placeholder="Search exercises…"
                  className="w-full px-3 py-2.5 text-sm outline-none"
                  style={{ background: '#242424', color: '#F5F5F5', border: 'none', borderBottom: '1px solid #2E2E2E', fontFamily: 'Inter, sans-serif' }}
                />
                <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                  {allExercises
                    .filter(e => e.name.toLowerCase().includes(addExSearch.toLowerCase()))
                    .slice(0, 20)
                    .map(e => (
                      <button key={e.id} onClick={() => addExerciseFromLibrary(e.name)}
                        className="w-full text-left px-3 py-2 text-sm"
                        style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #2E2E2E', color: '#D0D0D0', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}
                        onMouseEnter={el => (el.currentTarget.style.background = '#00BFA510', el.currentTarget.style.color = '#00BFA5')}
                        onMouseLeave={el => (el.currentTarget.style.background = 'transparent', el.currentTarget.style.color = '#D0D0D0')}>
                        {e.name}
                      </button>
                    ))}
                  {allExercises.filter(e => e.name.toLowerCase().includes(addExSearch.toLowerCase())).length === 0 && (
                    <p className="px-3 py-3 text-xs" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>No exercises found</p>
                  )}
                </div>
                <button onClick={() => { setShowAddEx(false); setAddExSearch('') }}
                  className="w-full py-2 text-xs text-center"
                  style={{ color: '#606060', fontFamily: 'Inter, sans-serif', cursor: 'pointer', background: '#141414', border: 'none', borderTop: '1px solid #2E2E2E' }}>
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

        {/* Hike Block — dedicated card matching the template builder */}
        {loggedHike && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: '#2E2E2E' }} />
              <span className="text-xs uppercase font-bold tracking-widest px-3"
                style={{ color: '#84CC16', fontFamily: 'Montserrat, sans-serif', fontSize: '14px' }}>Hike Block</span>
              <div className="flex-1 h-px" style={{ background: '#2E2E2E' }} />
            </div>
            <div className="rounded-xl overflow-hidden" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
              <div className="grid grid-cols-2" style={{ borderBottom: '1px solid #2E2E2E' }}>
                {/* Distance */}
                <div className="p-4" style={{ borderRight: '1px solid #2E2E2E' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Distance</p>
                  {loggedHike.plannedKm && (
                    <p className="text-xs mb-2" style={{ color: '#3E3E3E', fontFamily: 'JetBrains Mono, monospace' }}>
                      Planned: {loggedHike.plannedKm} km
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="number" inputMode="decimal" min="0" step="0.1"
                      value={loggedHike.actualKm}
                      onChange={e => setLoggedHike(h => h ? { ...h, actualKm: e.target.value } : h)}
                      className="w-20 text-center py-2 rounded text-sm outline-none"
                      style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #84CC1640', fontFamily: 'JetBrains Mono, monospace' }}
                    />
                    <span className="text-xs" style={{ color: '#606060' }}>km</span>
                  </div>
                </div>
                {/* Elevation Gain */}
                <div className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Elevation Gain</p>
                  {loggedHike.plannedElevM && (
                    <p className="text-xs mb-2" style={{ color: '#3E3E3E', fontFamily: 'JetBrains Mono, monospace' }}>
                      Planned: {loggedHike.plannedElevM} m
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="number" inputMode="numeric" min="0"
                      value={loggedHike.actualElevM}
                      onChange={e => setLoggedHike(h => h ? { ...h, actualElevM: e.target.value } : h)}
                      className="w-20 text-center py-2 rounded text-sm outline-none"
                      style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #84CC1640', fontFamily: 'JetBrains Mono, monospace' }}
                    />
                    <span className="text-xs" style={{ color: '#606060' }}>m</span>
                  </div>
                </div>
              </div>
              {/* Naismith estimate */}
              {(() => {
                const km = parseFloat(loggedHike.actualKm) || 0
                const elev = parseFloat(loggedHike.actualElevM) || 0
                if (km <= 0 && elev <= 0) return null
                const mins = hikeNaismith(km, elev, loggedHike.settings)
                return (
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-xs" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Est. Duration (Naismith)</span>
                    <span className="text-sm font-bold" style={{ color: '#84CC16', fontFamily: 'JetBrains Mono, monospace' }}>{fmtHikeDuration(mins)}</span>
                  </div>
                )
              })()}
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
          <div className="flex items-center gap-3">
            {firstPlan && (
              <button
                onClick={loadFirstSession}
                className="px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-2"
                style={{ background: `${typeColor(firstPlan.cell.template.type)}20`, color: typeColor(firstPlan.cell.template.type), border: `1px solid ${typeColor(firstPlan.cell.template.type)}40`, fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}
              >
                ↩ Back to 1st Session
              </button>
            )}
            {secondPlan && (
              <button
                onClick={loadSecondSession}
                className="px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-2"
                style={{ background: '#A78BFA20', color: '#A78BFA', border: '1px solid #A78BFA40', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}
              >
                ↗ Log 2nd Session
              </button>
            )}
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

      {/* Library picker modal */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowPicker(false)}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden"
            style={{ background: '#141414', border: '1px solid #2E2E2E', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #2E2E2E' }}>
              <span className="text-sm font-bold uppercase tracking-wider"
                style={{ color: pickerType === 'lift' ? '#00BFA5' : '#C8102E', fontFamily: 'Montserrat, sans-serif' }}>
                {pickerType === 'lift' ? 'Choose Lifting Template' : 'Choose Run Template'}
              </span>
              <button onClick={() => setShowPicker(false)} style={{ color: '#606060', background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>

            {/* Template list */}
            <div className="overflow-y-auto p-3 space-y-2">
              {library
                .filter(t => pickerType === 'lift' ? (t.type === 'lift' || t.type === 'hybrid') : (t.type === 'run' || t.type === 'hybrid'))
                .length === 0 && (
                <p className="text-sm text-center py-6" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
                  No {pickerType} templates in your library yet.
                </p>
              )}
              {library
                .filter(t => pickerType === 'lift' ? (t.type === 'lift' || t.type === 'hybrid') : (t.type === 'run' || t.type === 'hybrid'))
                .map(tpl => (
                  <button key={tpl.id} onClick={() => loadFromTemplate(tpl)}
                    className="w-full text-left px-4 py-3 rounded-xl transition-all"
                    style={{ background: '#1E1E1E', border: '1px solid #2E2E2E', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = pickerType === 'lift' ? '#00BFA544' : '#C8102E44')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#2E2E2E')}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold" style={{ color: '#F5F5F5', fontFamily: 'Inter, sans-serif' }}>{tpl.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: `${typeColor(tpl.type as TemplateKind)}20`, color: typeColor(tpl.type as TemplateKind), fontFamily: 'Inter, sans-serif' }}>
                        {typeLabel(tpl.type as TemplateKind)}
                      </span>
                    </div>
                    {tpl.exerciseRows && tpl.exerciseRows.length > 0 && (
                      <p className="text-xs mt-1" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
                        {tpl.exerciseRows.slice(0, 4).map(e => e.exerciseName).join(' · ')}{tpl.exerciseRows.length > 4 ? ` +${tpl.exerciseRows.length - 4} more` : ''}
                      </p>
                    )}
                    {tpl.runRows && tpl.runRows.length > 0 && (
                      <p className="text-xs mt-1" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
                        {tpl.runRows.length} segment{tpl.runRows.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </button>
                ))}

              {/* Blank entry fallback */}
              <button onClick={() => { pickerType === 'lift' ? setShowAddEx(true) : addManualRunSegment(); setShowPicker(false) }}
                className="w-full text-left px-4 py-3 rounded-xl"
                style={{ background: 'transparent', border: '1px dashed #2E2E2E', cursor: 'pointer' }}>
                <span className="text-sm flex items-center gap-2" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
                  <Plus size={13} /> Start blank
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Use Template picker modal */}
      {showTemplatePicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={() => { setShowTemplatePicker(false); setTemplateSearch('') }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden"
            style={{ background: '#141414', border: '1px solid #2E2E2E', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>

            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #2E2E2E' }}>
              <span className="text-sm font-bold uppercase tracking-wider"
                style={{ color: '#00BFA5', fontFamily: 'Montserrat, sans-serif' }}>Use Template</span>
              <button onClick={() => { setShowTemplatePicker(false); setTemplateSearch('') }}
                style={{ color: '#606060', background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>

            <div className="px-4 pt-3 pb-2">
              <input
                autoFocus
                value={templateSearch} onChange={e => setTemplateSearch(e.target.value)}
                placeholder="Search templates…"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #2E2E2E', fontFamily: 'Inter, sans-serif' }}
              />
            </div>

            <div className="overflow-y-auto p-3 space-y-2">
              {library
                .filter(t => !templateSearch || t.name.toLowerCase().includes(templateSearch.toLowerCase()))
                .length === 0 && (
                <p className="text-sm text-center py-6" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
                  No templates found.
                </p>
              )}
              {library
                .filter(t => !templateSearch || t.name.toLowerCase().includes(templateSearch.toLowerCase()))
                .map(tpl => (
                  <button key={tpl.id} onClick={() => replaceFromTemplate(tpl)}
                    className="w-full text-left px-4 py-3 rounded-xl transition-all"
                    style={{ background: '#1E1E1E', border: '1px solid #2E2E2E', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#00BFA544')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#2E2E2E')}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold" style={{ color: '#F5F5F5', fontFamily: 'Inter, sans-serif' }}>{tpl.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: `${typeColor(tpl.type as TemplateKind)}20`, color: typeColor(tpl.type as TemplateKind), fontFamily: 'Inter, sans-serif' }}>
                        {typeLabel(tpl.type as TemplateKind)}
                      </span>
                    </div>
                    {tpl.exerciseRows && tpl.exerciseRows.length > 0 && (
                      <p className="text-xs mt-1" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
                        {tpl.exerciseRows.slice(0, 4).map(e => e.exerciseName).join(' · ')}{tpl.exerciseRows.length > 4 ? ` +${tpl.exerciseRows.length - 4} more` : ''}
                      </p>
                    )}
                    {tpl.runRows && tpl.runRows.length > 0 && (
                      <p className="text-xs mt-1" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
                        {tpl.runRows.length} segment{tpl.runRows.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
