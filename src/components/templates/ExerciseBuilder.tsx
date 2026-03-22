'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { exercises, Exercise } from '@/lib/mockData'
import { formatTimeInput } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SetRow {
  id: string
  reps: string
  weight: string   // kg
}

export interface ExRow {
  id: string
  exerciseId: string
  exerciseName: string
  category: string
  sets: SetRow[]
}

interface ExerciseBuilderProps {
  rows: ExRow[]
  onChange: (rows: ExRow[]) => void
}

// ─── Mock stored 1RMs (kg) ── in prod these come from session analytics ───────

const STORED_1RM: Record<string, number> = {
  squat:           142.5,
  bench:           100,
  deadlift:        180,
  ohp:             72.5,
  row:             100,
  rdl:             130,
  'incline-press': 90,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function epley(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30) * 4) / 4
}

const PLATE_SIZES  = [25, 20, 15, 10, 5, 2.5, 1.25]
const BAR_WEIGHT   = 20

const PLATE_COLORS: Record<number, { bg: string; text: string }> = {
  25:   { bg: '#EF4444', text: '#fff' },
  20:   { bg: '#3B82F6', text: '#fff' },
  15:   { bg: '#F59E0B', text: '#0D0D0D' },
  10:   { bg: '#22C55E', text: '#0D0D0D' },
  5:    { bg: '#F5F5F5', text: '#0D0D0D' },
  2.5:  { bg: '#6B7280', text: '#fff' },
  1.25: { bg: '#374151', text: '#A0A0A0' },
}

function calcPlates(totalKg: number) {
  let remaining = Math.max(0, (totalKg - BAR_WEIGHT) / 2)
  const result: { plate: number; count: number }[] = []
  for (const p of PLATE_SIZES) {
    const count = Math.floor(remaining / p)
    if (count > 0) { result.push({ plate: p, count }); remaining = Math.round((remaining - count * p) * 100) / 100 }
  }
  return result
}

function makeSet(): SetRow {
  return { id: `set-${Date.now()}-${Math.random()}`, reps: '', weight: '' }
}

function makeExRow(): ExRow {
  return {
    id: `ex-${Date.now()}-${Math.random()}`,
    exerciseId: '', exerciseName: '', category: '',
    sets: Array.from({ length: 5 }, makeSet),
  }
}

const inputStyle: React.CSSProperties = {
  background: '#0D0D0D', border: '1px solid #2E2E2E',
  color: '#F5F5F5', fontFamily: 'JetBrains Mono, monospace', outline: 'none',
}

// ─── Exercise autocomplete search ─────────────────────────────────────────────

function ExerciseSearch({ value, onSelect }: { value: string; onSelect: (ex: Exercise) => void }) {
  const [query, setQuery] = useState(value)
  const [open, setOpen]   = useState(false)
  const ref               = useRef<HTMLDivElement>(null)

  useEffect(() => { setQuery(value) }, [value])
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtered = query.length < 1
    ? exercises.filter(e => e.category !== 'run-drill' && e.category !== 'mobility')
    : exercises.filter(e =>
        e.name.toLowerCase().includes(query.toLowerCase()) ||
        e.category.toLowerCase().includes(query.toLowerCase()) ||
        e.primaryMuscles.some(m => m.toLowerCase().includes(query.toLowerCase()))
      )

  const catColor: Record<string, string> = {
    barbell: '#00BFA5', dumbbell: '#A78BFA', machine: '#F59E0B',
    bodyweight: '#C8102E', 'run-drill': '#34D399', mobility: '#60A5FA',
  }

  return (
    <div ref={ref} className="relative flex-1">
      <input
        type="text" placeholder="Search exercise…"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{ background: '#0D0D0D', border: '1px solid #2E2E2E', color: '#F5F5F5', fontFamily: 'Inter, sans-serif' }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl overflow-auto"
          style={{ background: '#1A1A1A', border: '1px solid #2E2E2E', maxHeight: '200px', boxShadow: '0 8px 32px rgba(0,0,0,0.7)' }}>
          {filtered.slice(0, 12).map(ex => (
            <button key={ex.id}
              onMouseDown={e => { e.preventDefault(); onSelect(ex); setQuery(ex.name); setOpen(false) }}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left"
              style={{ borderBottom: '1px solid #2E2E2E' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div>
                <p className="text-sm" style={{ color: '#F5F5F5', fontFamily: 'Inter, sans-serif' }}>{ex.name}</p>
                <p className="text-xs" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>{ex.primaryMuscles.slice(0, 2).join(', ')}</p>
              </div>
              <span className="ml-2 px-1.5 py-0.5 rounded text-xs capitalize whitespace-nowrap"
                style={{ background: `${catColor[ex.category] ?? '#606060'}18`, color: catColor[ex.category] ?? '#606060', border: `1px solid ${catColor[ex.category] ?? '#606060'}33`, fontFamily: 'Inter, sans-serif' }}>
                {ex.category}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Plate calculator display ──────────────────────────────────────────────────

function PlateCalc({ totalKg }: { totalKg: number }) {
  if (totalKg < BAR_WEIGHT) return <p className="text-xs" style={{ color: '#606060' }}>Bar only (20 kg)</p>
  const plates = calcPlates(totalKg)
  return (
    <div>
      <p className="text-xs mb-1.5" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
        20 kg bar + {(totalKg - BAR_WEIGHT) / 2} kg per side
      </p>
      <div className="flex flex-wrap gap-1">
        {plates.flatMap(({ plate, count }) =>
          Array.from({ length: count }).map((_, i) => {
            const cfg = PLATE_COLORS[plate] ?? { bg: '#374151', text: '#A0A0A0' }
            return (
              <span key={`${plate}-${i}`}
                className="inline-flex items-center justify-center rounded font-bold"
                style={{ background: cfg.bg, color: cfg.text, fontSize: '10px', fontFamily: 'JetBrains Mono, monospace',
                  minWidth: plate >= 10 ? '34px' : '28px', height: plate >= 20 ? '26px' : plate >= 5 ? '22px' : '18px', padding: '0 5px' }}>
                {plate}
              </span>
            )
          })
        )}
      </div>
      <p className="text-xs mt-1" style={{ color: '#3E3E3E' }}>× each side</p>
    </div>
  )
}

// ─── Single set row ────────────────────────────────────────────────────────────

function SetRowItem({
  set, index, isBarbell, stored1RM, onUpdate, onDelete,
}: {
  set: SetRow
  index: number
  isBarbell: boolean
  stored1RM: number | null
  canDelete: boolean
  onUpdate: (partial: Partial<SetRow>) => void
  onDelete: () => void
}) {
  const w       = parseFloat(set.weight)
  const r       = parseInt(set.reps)
  const est1RM  = (!isNaN(w) && !isNaN(r) && w > 0 && r > 0) ? epley(w, r) : null
  const pct     = (est1RM && stored1RM) ? Math.round((est1RM / stored1RM) * 100) : null
  const isEmpty = !set.reps && !set.weight

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Set label */}
      <span className="text-xs w-12 flex-shrink-0 text-center font-bold px-1.5 py-1.5 rounded"
        style={{ color: '#A0A0A0', background: '#1A1A1A', border: '1px solid #2E2E2E', fontFamily: 'JetBrains Mono, monospace' }}>
        Set {index + 1}
      </span>

      {/* Reps */}
      <div className="flex items-center gap-1">
        <label className="text-xs flex-shrink-0" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Reps</label>
        <input type="text" inputMode="numeric" placeholder="—"
          value={set.reps} onChange={e => onUpdate({ reps: e.target.value })}
          size={Math.max(2, (set.reps || '—').length)}
          className="px-2 py-1.5 rounded-lg text-sm text-center" style={{ ...inputStyle, width: 'auto' }} />
      </div>

      {/* kg */}
      <div className="flex items-center gap-1">
        <label className="text-xs flex-shrink-0" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>kg</label>
        <input type="text" inputMode="decimal" placeholder="—"
          value={set.weight} onChange={e => onUpdate({ weight: e.target.value })}
          size={Math.max(2, (set.weight || '—').length)}
          className="px-2 py-1.5 rounded-lg text-sm text-center" style={{ ...inputStyle, width: 'auto' }} />
      </div>

      {/* 1RM */}
      {isBarbell && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs" style={{ color: '#606060', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
            1RM:{' '}
            <span style={{ color: est1RM ? '#00BFA5' : '#3E3E3E', fontFamily: 'JetBrains Mono, monospace' }}>
              {est1RM ? `${est1RM} kg` : '—'}
            </span>
          </span>
          {pct !== null && (
            <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{
              background: pct >= 90 ? '#EF444420' : pct >= 75 ? '#F59E0B20' : '#00BFA520',
              color: pct >= 90 ? '#EF4444' : pct >= 75 ? '#F59E0B' : '#00BFA5',
              fontFamily: 'JetBrains Mono, monospace',
            }}>{pct}%</span>
          )}
        </div>
      )}

      {/* Plate loader */}
      {isBarbell && !isNaN(w) && w > 0 && (
        <div className="flex-1 min-w-0 px-2 py-1.5 rounded-lg" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
          <PlateCalc totalKg={w} />
        </div>
      )}
      {isBarbell && (isNaN(w) || w <= 0) && (
        <span className="text-xs" style={{ color: '#3E3E3E', fontFamily: 'Inter, sans-serif' }}>Enter weight for plates</span>
      )}

      {/* Delete */}
      <button onClick={onDelete}
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-all ml-auto"
        style={{ background: 'transparent', border: '1px solid transparent', color: '#3E3E3E' }}
        title="Remove set"
        onMouseEnter={e => { e.currentTarget.style.background = '#C8102E20'; e.currentTarget.style.color = '#C8102E' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#3E3E3E' }}>
        <X size={12} />
      </button>
    </div>
  )
}

// ─── Single exercise block ─────────────────────────────────────────────────────

function ExerciseBlock({
  row, index, onUpdate, onRemove,
}: {
  row: ExRow
  index: number
  onUpdate: (partial: Partial<ExRow>) => void
  onRemove: () => void
}) {
  const isBarbell  = row.category === 'barbell'
  const stored1RM  = STORED_1RM[row.exerciseId] ?? null

  function updateSet(si: number, partial: Partial<SetRow>) {
    const next = row.sets.map((s, i) => i === si ? { ...s, ...partial } : s)
    onUpdate({ sets: next })
  }

  function deleteSet(si: number) {
    if (row.sets.length <= 1) return   // keep at least one row
    onUpdate({ sets: row.sets.filter((_, i) => i !== si) })
  }

  function addSet() {
    onUpdate({ sets: [...row.sets, makeSet()] })
  }

  // Total volume across all sets
  const totalVol = row.sets.reduce((acc, s) => {
    const w = parseFloat(s.weight); const r = parseInt(s.reps)
    return acc + ((!isNaN(w) && !isNaN(r) && w > 0 && r > 0) ? w * r : 0)
  }, 0)

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#242424', border: '1px solid #2E2E2E' }}>
      {/* Exercise header */}
      <div className="flex items-center gap-2 px-3 py-3" style={{ borderBottom: '1px solid #1A1A1A' }}>
        <span className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: '#1A1A1A', color: '#606060', fontFamily: 'JetBrains Mono, monospace' }}>
          {index + 1}
        </span>
        <ExerciseSearch
          value={row.exerciseName}
          onSelect={ex => onUpdate({ exerciseId: ex.id, exerciseName: ex.name, category: ex.category })}
        />
        {row.category && (
          <span className="text-xs px-2 py-0.5 rounded capitalize flex-shrink-0"
            style={{
              background: row.category === 'barbell' ? '#00BFA518' : '#A0A0A018',
              color:      row.category === 'barbell' ? '#00BFA5'   : '#606060',
              border:     `1px solid ${row.category === 'barbell' ? '#00BFA530' : '#2E2E2E'}`,
              fontFamily: 'Inter, sans-serif',
            }}>
            {row.category}
          </span>
        )}
        {stored1RM !== null && (
          <span className="text-xs flex-shrink-0" style={{ color: '#3E3E3E', fontFamily: 'JetBrains Mono, monospace' }}>
            Best: {stored1RM} kg
          </span>
        )}
        <button onClick={onRemove}
          className="p-1.5 rounded-lg flex-shrink-0 transition-colors"
          style={{ color: '#3E3E3E' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#C8102E18'; e.currentTarget.style.color = '#C8102E' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#3E3E3E' }}
          title="Remove exercise">
          <Trash2 size={13} />
        </button>
      </div>

      {/* Set rows */}
      <div className="px-3 py-3 space-y-3">
        {row.sets.map((set, si) => (
          <SetRowItem
            key={set.id}
            set={set}
            index={si}
            isBarbell={isBarbell}
            stored1RM={stored1RM}
            canDelete={row.sets.length > 1}
            onUpdate={partial => updateSet(si, partial)}
            onDelete={() => deleteSet(si)}
          />
        ))}

        {/* Add set + volume summary row */}
        <div className="flex items-center justify-between pt-1">
          <button onClick={addSet}
            className="flex items-center gap-1.5 text-xs transition-all"
            style={{ color: '#3E3E3E', fontFamily: 'Inter, sans-serif' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#00BFA5')}
            onMouseLeave={e => (e.currentTarget.style.color = '#3E3E3E')}>
            <Plus size={11} /> Add Set
          </button>
          {totalVol > 0 && (
            <span className="text-xs" style={{ color: '#3E3E3E', fontFamily: 'JetBrains Mono, monospace' }}>
              {row.sets.length} sets · {totalVol} kg total
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main ExerciseBuilder ──────────────────────────────────────────────────────

export default function ExerciseBuilder({ rows, onChange }: ExerciseBuilderProps) {
  function updateRow(i: number, partial: Partial<ExRow>) {
    onChange(rows.map((r, idx) => idx === i ? { ...r, ...partial } : r))
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <div className="rounded-xl flex flex-col items-center justify-center py-8 text-center"
          style={{ border: '2px dashed #2E2E2E' }}>
          <p className="text-sm mb-1" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>No exercises yet</p>
          <p className="text-xs" style={{ color: '#3E3E3E', fontFamily: 'Inter, sans-serif' }}>Add exercises to build your template</p>
        </div>
      )}

      {rows.map((row, i) => (
        <ExerciseBlock
          key={row.id}
          row={row}
          index={i}
          onUpdate={partial => updateRow(i, partial)}
          onRemove={() => onChange(rows.filter((_, idx) => idx !== i))}
        />
      ))}

      <button
        onClick={() => onChange([...rows, makeExRow()])}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all"
        style={{ background: 'transparent', border: '1px dashed #2E2E2E', color: '#606060', fontFamily: 'Inter, sans-serif' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#00BFA544'; e.currentTarget.style.color = '#00BFA5' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#2E2E2E'; e.currentTarget.style.color = '#606060' }}>
        <Plus size={14} /> Add Exercise
      </button>
    </div>
  )
}

// ─── Run Builder ──────────────────────────────────────────────────────────────

export type RunMetric = 'distance' | 'time' | 'pace' | 'hr'

export interface RunSegment {
  id: string
  segmentType: string
  metric: RunMetric
  value: string
  pace?: string   // min/km — used to derive distance (when metric=time) or time (when metric=distance)
}

export interface RepeatBlock {
  id: string
  kind: 'repeat'
  count: string      // number of times to repeat, e.g. "4"
  laps: RunSegment[]
}

export type RunEntry = RunSegment | RepeatBlock

interface RunBuilderProps {
  entries: RunEntry[]
  onChange: (entries: RunEntry[]) => void
}

export const SEGMENT_TYPES: { value: string; label: string; color: string }[] = [
  { value: 'warm-up',   label: 'Warm Up',   color: '#F59E0B' },
  { value: 'easy',      label: 'Easy Run',  color: '#4CAF50' },
  { value: 'tempo',     label: 'Tempo',     color: '#C8102E' },
  { value: 'interval',  label: 'Interval',  color: '#EF4444' },
  { value: 'hills',     label: 'Hills',     color: '#F97316' },
  { value: 'strides',   label: 'Strides',   color: '#A78BFA' },
  { value: 'rest',      label: 'Rest',      color: '#606060' },
  { value: 'cool-down', label: 'Cool Down', color: '#3B82F6' },
  { value: 'custom',    label: 'Custom',    color: '#A0A0A0' },
]

export const METRIC_CONFIG: Record<RunMetric, { label: string; placeholder: string; unit: string; inputType: 'text' | 'number' }> = {
  distance: { label: 'Distance', placeholder: '5',    unit: 'km',   inputType: 'number' },
  time:     { label: 'Time',     placeholder: '30:00', unit: 'min',  inputType: 'text'   },
  pace:     { label: 'Pace',     placeholder: '5:30',  unit: '/km',  inputType: 'text'   },
  hr:       { label: 'HR',       placeholder: '140',   unit: 'bpm',  inputType: 'number' },
}

function uid() { return `${Date.now()}-${Math.random()}` }

// Derive km from a segment (direct distance, or time÷pace, or pace-only)
export function segDerivedKm(seg: RunSegment): number {
  if (seg.metric === 'distance') return parseFloat(seg.value) || 0
  if (seg.metric === 'time' && seg.pace) {
    const secs = parseTimeSecs(seg.value)
    const paceSecs = parseTimeSecs(seg.pace)
    if (secs > 0 && paceSecs > 0) return secs / paceSecs
  }
  return 0
}

// Derive seconds from a segment (direct time, or distance×pace)
export function segDerivedSecs(seg: RunSegment): number {
  if (seg.metric === 'time') return parseTimeSecs(seg.value)
  if (seg.metric === 'distance' && seg.pace) {
    const km = parseFloat(seg.value) || 0
    const paceSecs = parseTimeSecs(seg.pace)
    if (km > 0 && paceSecs > 0) return km * paceSecs
  }
  return 0
}
function makeSegment(type = 'easy'): RunSegment {
  return { id: `seg-${uid()}`, segmentType: type, metric: 'distance', value: '' }
}
function makeRepeat(): RepeatBlock {
  return { id: `rep-${uid()}`, kind: 'repeat', count: '4', laps: [makeSegment('interval'), makeSegment('rest')] }
}

// ── Single segment row ────────────────────────────────────────────────────────

function SegmentRow({ seg, onUpdate, onDelete, canDelete, indent }: {
  seg: RunSegment
  onUpdate: (partial: Partial<RunSegment>) => void
  onDelete: () => void
  canDelete: boolean
  indent?: boolean
}) {
  const typeInfo   = SEGMENT_TYPES.find(t => t.value === seg.segmentType) ?? SEGMENT_TYPES[1]
  const metricConf = METRIC_CONFIG[seg.metric]

  const showPace = seg.metric === 'distance' || seg.metric === 'time'

  // Derived value label shown when both value + pace are filled
  let derivedLabel: string | null = null
  if (showPace && seg.pace) {
    if (seg.metric === 'distance') {
      const secs = segDerivedSecs(seg)
      if (secs > 0) derivedLabel = `→ ${formatSecs(secs)}`
    } else {
      const km = segDerivedKm(seg)
      if (km > 0) derivedLabel = `→ ${km % 1 === 0 ? km : km.toFixed(2)} km`
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap"
      style={{ background: indent ? '#1A1A1A' : '#0D0D0D', border: '1px solid #2E2E2E', borderRadius: '6px', padding: '6px 10px' }}>

      {/* Session type */}
      <select
        value={seg.segmentType}
        onChange={e => onUpdate({ segmentType: e.target.value })}
        className="text-xs font-semibold rounded px-2 py-1 outline-none cursor-pointer flex-shrink-0"
        style={{ background: `${typeInfo.color}18`, color: typeInfo.color, border: `1px solid ${typeInfo.color}44`, fontFamily: 'Inter, sans-serif', minWidth: '88px' }}
      >
        {SEGMENT_TYPES.map(t => (
          <option key={t.value} value={t.value} style={{ background: '#1A1A1A', color: '#F5F5F5' }}>{t.label}</option>
        ))}
      </select>

      {/* Metric selector */}
      <select
        value={seg.metric}
        onChange={e => onUpdate({ metric: e.target.value as RunMetric, value: '', pace: '' })}
        className="text-xs rounded px-2 py-1 outline-none cursor-pointer flex-shrink-0"
        style={{ background: '#242424', color: '#A0A0A0', border: '1px solid #2E2E2E', fontFamily: 'Inter, sans-serif', minWidth: '76px' }}
      >
        {(Object.keys(METRIC_CONFIG) as RunMetric[]).map(m => (
          <option key={m} value={m} style={{ background: '#1A1A1A', color: '#F5F5F5' }}>{METRIC_CONFIG[m].label}</option>
        ))}
      </select>

      {/* Value input + unit */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <input
          type={metricConf.inputType}
          value={seg.value}
          onChange={e => onUpdate({ value: metricConf.inputType === 'text' ? formatTimeInput(e.target.value) : e.target.value })}
          placeholder={metricConf.placeholder}
          className="w-16 px-2 py-1 rounded text-xs text-center outline-none"
          style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace' }}
          {...(metricConf.inputType === 'number' ? { min: '0', step: seg.metric === 'distance' ? '0.1' : '1' } : {})}
        />
        <span className="text-xs flex-shrink-0" style={{ color: '#606060', fontFamily: 'JetBrains Mono, monospace' }}>{metricConf.unit}</span>
      </div>

      {/* Pace input + unit — inline when applicable */}
      {showPace && (
        <>
          <span className="text-xs flex-shrink-0" style={{ color: '#3E3E3E', fontFamily: 'Inter, sans-serif' }}>pace</span>
          <div className="flex items-center gap-1 flex-shrink-0">
            <input
              type="text"
              value={seg.pace ?? ''}
              onChange={e => onUpdate({ pace: formatTimeInput(e.target.value) })}
              placeholder="5:30"
              className="w-16 px-2 py-1 rounded text-xs text-center outline-none"
              style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', borderColor: '#2E2E2E' }}
            />
            <span className="text-xs flex-shrink-0" style={{ color: '#606060', fontFamily: 'JetBrains Mono, monospace' }}>/km</span>
          </div>
          {derivedLabel && (
            <span className="text-xs px-2 py-0.5 rounded flex-shrink-0" style={{ background: '#C8102E15', color: '#C8102E', fontFamily: 'JetBrains Mono, monospace', border: '1px solid #C8102E30' }}>
              {derivedLabel}
            </span>
          )}
        </>
      )}

      <button
        onClick={onDelete}
        disabled={!canDelete}
        className="ml-auto p-1 rounded transition-all flex-shrink-0"
        style={{ color: canDelete ? '#3E3E3E' : '#2E2E2E', cursor: canDelete ? 'pointer' : 'not-allowed' }}
        onMouseEnter={e => { if (canDelete) e.currentTarget.style.color = '#EF4444' }}
        onMouseLeave={e => { e.currentTarget.style.color = canDelete ? '#3E3E3E' : '#2E2E2E' }}
      >
        <X size={13} />
      </button>
    </div>
  )
}

// ── Repeat block row ──────────────────────────────────────────────────────────

function RepeatBlockRow({ block, onUpdate, onDelete }: {
  block: RepeatBlock
  onUpdate: (updated: RepeatBlock) => void
  onDelete: () => void
}) {
  function updateLap(i: number, partial: Partial<RunSegment>) {
    onUpdate({ ...block, laps: block.laps.map((l, idx) => idx === i ? { ...l, ...partial } : l) })
  }
  function removeLap(i: number) {
    onUpdate({ ...block, laps: block.laps.filter((_, idx) => idx !== i) })
  }
  function addLap() {
    onUpdate({ ...block, laps: [...block.laps, makeSegment('interval')] })
  }

  const lapKm  = block.laps.reduce((s, l) => s + segDerivedKm(l), 0)
  const count  = parseInt(block.count) || 0
  const totalKm = lapKm * count

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #EF444433', background: '#EF44440A' }}>
      {/* Block header */}
      <div className="flex items-center gap-3 px-3 py-2.5" style={{ borderBottom: '1px solid #EF444433' }}>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#EF4444', fontFamily: 'Montserrat, sans-serif' }}>
          Repeat ×
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={block.count}
          onChange={e => onUpdate({ ...block, count: e.target.value })}
          size={Math.max(2, (block.count || '4').length)}
          className="px-2 py-1 rounded text-xs text-center outline-none font-bold"
          style={{ background: '#EF444422', border: '1px solid #EF444444', color: '#EF4444', fontFamily: 'JetBrains Mono, monospace', width: 'auto' }}
          placeholder="4"
        />
        {totalKm > 0 && (
          <span className="text-xs" style={{ color: '#606060', fontFamily: 'JetBrains Mono, monospace' }}>
            {totalKm % 1 === 0 ? totalKm : totalKm.toFixed(1)} km total
          </span>
        )}
        <button
          onClick={onDelete}
          className="ml-auto p-1 rounded transition-all"
          style={{ color: '#3E3E3E' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
          onMouseLeave={e => (e.currentTarget.style.color = '#3E3E3E')}
        >
          <X size={13} />
        </button>
      </div>

      {/* Lap rows */}
      <div className="px-3 py-2 space-y-1.5">
        {block.laps.map((lap, i) => (
          <SegmentRow
            key={lap.id}
            seg={lap}
            indent
            onUpdate={partial => updateLap(i, partial)}
            onDelete={() => removeLap(i)}
            canDelete={block.laps.length > 1}
          />
        ))}
        <button
          onClick={addLap}
          className="flex items-center gap-1.5 text-xs mt-1 transition-all"
          style={{ color: '#3E3E3E', fontFamily: 'Inter, sans-serif' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
          onMouseLeave={e => (e.currentTarget.style.color = '#3E3E3E')}
        >
          <Plus size={11} /> Add Lap
        </button>
      </div>
    </div>
  )
}

// ── Main RunBuilder ───────────────────────────────────────────────────────────

function parseTimeSecs(val: string): number {
  if (!val) return 0
  const parts = val.split(':').map(Number)
  if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + (parts[2] || 0)
  if (parts.length === 2) return (parts[0] * 60) + (parts[1] || 0)
  return (parts[0] || 0) * 60  // plain number = minutes
}

function formatSecs(total: number): string {
  if (total <= 0) return '—'
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  if (s > 0) return `${m}m ${s.toString().padStart(2, '0')}s`
  return `${m}m`
}

export function RunBuilder({ entries, onChange }: RunBuilderProps) {
  function updateEntry(i: number, updated: RunEntry) {
    onChange(entries.map((e, idx) => idx === i ? updated : e))
  }

  function totalKmFor(e: RunEntry): number {
    if ('kind' in e) return (parseInt(e.count) || 0) * e.laps.reduce((s, l) => s + segDerivedKm(l), 0)
    return segDerivedKm(e)
  }
  function totalSecsFor(e: RunEntry): number {
    if ('kind' in e) return (parseInt(e.count) || 0) * e.laps.reduce((s, l) => s + segDerivedSecs(l), 0)
    return segDerivedSecs(e)
  }
  const totalKm   = entries.reduce((s, e) => s + totalKmFor(e), 0)
  const totalSecs = entries.reduce((s, e) => s + totalSecsFor(e), 0)

  return (
    <div className="space-y-2">
      {entries.length === 0 && (
        <div className="rounded-xl flex flex-col items-center justify-center py-8 text-center"
          style={{ border: '2px dashed #2E2E2E' }}>
          <p className="text-sm mb-1" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>No segments yet</p>
          <p className="text-xs" style={{ color: '#3E3E3E', fontFamily: 'Inter, sans-serif' }}>Add warm-ups, intervals, repeats and more</p>
        </div>
      )}

      {entries.map((entry, i) => (
        'kind' in entry
          ? <RepeatBlockRow
              key={entry.id}
              block={entry}
              onUpdate={updated => updateEntry(i, updated)}
              onDelete={() => onChange(entries.filter((_, idx) => idx !== i))}
            />
          : <SegmentRow
              key={entry.id}
              seg={entry}
              onUpdate={partial => updateEntry(i, { ...entry, ...partial })}
              onDelete={() => onChange(entries.filter((_, idx) => idx !== i))}
              canDelete={entries.length > 1}
            />
      ))}

      <div className="flex gap-2">
        <button
          onClick={() => onChange([...entries, makeSegment()])}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-medium transition-all flex-1"
          style={{ background: 'transparent', border: '1px dashed #2E2E2E', color: '#606060', fontFamily: 'Inter, sans-serif' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#C8102E44'; e.currentTarget.style.color = '#C8102E' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#2E2E2E'; e.currentTarget.style.color = '#606060' }}>
          <Plus size={13} /> Add Segment
        </button>
        <button
          onClick={() => onChange([...entries, makeRepeat()])}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-medium transition-all flex-1"
          style={{ background: 'transparent', border: '1px dashed #EF444433', color: '#606060', fontFamily: 'Inter, sans-serif' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#EF444466'; e.currentTarget.style.color = '#EF4444' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#EF444433'; e.currentTarget.style.color = '#606060' }}>
          <Plus size={13} /> Add Repeat
        </button>
      </div>
      <div className="flex items-center gap-4 px-1 pt-1" style={{ borderTop: '1px solid #2E2E2E' }}>
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs" style={{ color: '#3E3E3E', fontFamily: 'Inter, sans-serif' }}>Distance</span>
          <span className="text-xs font-bold ml-auto" style={{ color: totalKm > 0 ? '#C8102E' : '#3E3E3E', fontFamily: 'JetBrains Mono, monospace' }}>
            {totalKm > 0 ? `${totalKm % 1 === 0 ? totalKm : totalKm.toFixed(1)} km` : '—'}
          </span>
        </div>
        <div className="w-px self-stretch" style={{ background: '#2E2E2E' }} />
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs" style={{ color: '#3E3E3E', fontFamily: 'Inter, sans-serif' }}>Time</span>
          <span className="text-xs font-bold ml-auto" style={{ color: totalSecs > 0 ? '#C8102E' : '#3E3E3E', fontFamily: 'JetBrains Mono, monospace' }}>
            {formatSecs(totalSecs)}
          </span>
        </div>
      </div>
    </div>
  )
}
