'use client'

import { useState, useEffect } from 'react'
import { Check, X, Pencil, Sparkles, Loader2 } from 'lucide-react'
import QuickLogFAB from '@/components/log/QuickLogFAB'
import ExerciseBuilder, { ExRow, RunBuilder, RunEntry, segDerivedKm } from '@/components/templates/ExerciseBuilder'
import { getProgrammes, upsertProgramme, deleteProgramme, getTemplates, upsertTemplate, getSetting, upsertSetting } from '@/lib/db'

// ─── Types ────────────────────────────────────────────────────────────────────

type TemplateKind = 'lift' | 'run' | 'hybrid'

// Matches the shape stored in thhl_custom_templates (Templates tab)
interface StoredTemplate {
  id: string
  name: string
  type: TemplateKind
  description?: string
  duration?: string
  exerciseRows?: ExRow[]
  runRows?: RunEntry[]
}

interface CellData {
  template: StoredTemplate
  rpe: number
}

interface Programme {
  id: string
  name: string
  weeks: number
  startDate: string // 'YYYY-MM-DD'
  cells: Record<string, CellData> // key: 'w{week}d{day}'
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEKS_OPTIONS = [4, 6, 8, 10, 12, 16]
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const STORAGE_KEY = 'lrr_programme_v3' // legacy — migrated on first load
const SAVED_KEY = 'lrr_saved_programmes_v1'
const CURRENT_KEY = 'lrr_current_programme_id'
const TEMPLATES_KEY = 'thhl_custom_templates'

// ─── Utils ────────────────────────────────────────────────────────────────────


function getMonday(dateStr: string): Date {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

// Auto-format time inputs
function fmtMmSs(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4)
  if (d.length <= 2) return d
  return d.slice(0, 2) + ':' + d.slice(2)
}

function fmtHMmSs(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 6)
  if (d.length <= 1) return d
  if (d.length <= 3) return d[0] + ':' + d.slice(1)
  return d[0] + ':' + d.slice(1, 3) + ':' + d.slice(3)
}

function fmtDate(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

function nextMonday(): string {
  const d = new Date()
  const day = d.getDay()
  const daysUntil = day === 1 ? 7 : (8 - day) % 7 || 7
  d.setDate(d.getDate() + daysUntil)
  return d.toISOString().split('T')[0]
}

function calcVolume(t: StoredTemplate): { weight: number; distance: number } {
  let weight = 0, distance = 0
  for (const row of t.exerciseRows ?? []) {
    for (const set of row.sets) {
      weight += (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0)
    }
  }
  for (const entry of t.runRows ?? []) {
    if ('kind' in entry) {
      // RepeatBlock
      const count = parseInt(entry.count) || 0
      for (const lap of entry.laps) {
        distance += segDerivedKm(lap) * count
      }
    } else {
      // RunSegment
      distance += segDerivedKm(entry)
    }
  }
  return { weight: Math.round(weight), distance: Math.round(distance * 10) / 10 }
}

function rpeColor(rpe: number): string {
  if (rpe <= 4) return '#22c55e'
  if (rpe <= 7) return '#f59e0b'
  return '#ef4444'
}

function typeColor(type: TemplateKind): string {
  if (type === 'lift')   return '#00BFA5'
  if (type === 'run')    return '#C8102E'
  if (type === 'hybrid') return '#a78bfa'
  return '#6b7280'
}

function typeLabel(type: TemplateKind): string {
  return { lift: 'Lifting', run: 'Run', hybrid: 'Hybrid' }[type] ?? type
}

// ─── Storage ──────────────────────────────────────────────────────────────────

function loadAllProgs(): Programme[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]') } catch { return [] }
}

function saveProgToList(p: Programme): Programme[] {
  const list = loadAllProgs()
  const idx = list.findIndex(x => x.id === p.id)
  const next = idx >= 0 ? list.map(x => x.id === p.id ? p : x) : [...list, p]
  localStorage.setItem(SAVED_KEY, JSON.stringify(next))
  return next
}

function deleteProgById(id: string): Programme[] {
  const next = loadAllProgs().filter(p => p.id !== id)
  localStorage.setItem(SAVED_KEY, JSON.stringify(next))
  if (localStorage.getItem(CURRENT_KEY) === id) localStorage.removeItem(CURRENT_KEY)
  return next
}

function loadCurrentProgId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(CURRENT_KEY)
}

function setCurrentProgId(id: string | null) {
  if (id) localStorage.setItem(CURRENT_KEY, id)
  else localStorage.removeItem(CURRENT_KEY)
}

function migrateAndLoad(): Programme[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const old = JSON.parse(raw) as Omit<Programme, 'id'> & { id?: string }
      if (!old.id) {
        const migrated = { ...old, id: `prog-${Date.now()}` } as Programme
        saveProgToList(migrated)
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  } catch { /* ignore */ }
  return loadAllProgs()
}

// ─── RPE Circle ───────────────────────────────────────────────────────────────

function RpeCircle({ rpe }: { rpe: number }) {
  if (!rpe) return <span style={{ color: '#4B5563', fontSize: '11px' }}>—</span>
  const r = 13, circ = 2 * Math.PI * r
  const filled = (rpe / 10) * circ
  const color = rpeColor(rpe)
  return (
    <svg width="34" height="34" viewBox="0 0 34 34">
      <circle cx="17" cy="17" r={r} fill="none" stroke="#2E2E2E" strokeWidth="3" />
      <circle cx="17" cy="17" r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={`${filled} ${circ - filled}`} strokeLinecap="round"
        transform="rotate(-90 17 17)" />
      <text x="17" y="21" textAnchor="middle" fontSize="9" fill={color} fontWeight="700">{rpe}</text>
    </svg>
  )
}

// ─── CreateTemplateModal ──────────────────────────────────────────────────────

interface CreateTemplateModalProps {
  initial?: StoredTemplate
  onSave: (t: StoredTemplate) => void
  onClose: () => void
}

function CreateTemplateModal({ initial, onSave, onClose }: CreateTemplateModalProps) {
  const [name, setName]           = useState(initial?.name ?? '')
  const [type, setType]           = useState<TemplateKind>(initial?.type ?? 'lift')
  const [exerciseRows, setExRows] = useState<ExRow[]>(initial?.exerciseRows ?? [])
  const [runRows, setRunRows]     = useState<RunEntry[]>(initial?.runRows ?? [])

  const TYPE_OPTIONS: { value: TemplateKind; label: string; color: string; bg: string }[] = [
    { value: 'lift',   label: 'Lifting',  color: '#00BFA5', bg: '#00BFA520' },
    { value: 'run',    label: 'Running',  color: '#C8102E', bg: '#C8102E20' },
    { value: 'hybrid', label: 'Hybrid',   color: '#A78BFA', bg: '#A78BFA20' },
  ]

  function handleSave() {
    if (!name.trim()) return
    const tpl: StoredTemplate = {
      id: initial?.id ?? `tpl-${Date.now()}`,
      name: name.trim(), type, exerciseRows, runRows,
    }
    onSave(tpl)
    upsertTemplate(tpl.id, tpl).catch(err => {
      console.error('Template DB save failed:', err)
      alert(`Failed to save template to database: ${err?.message ?? err}`)
    })
    // Keep localStorage in sync for offline fallback
    try {
      const existing: StoredTemplate[] = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]')
      const isUpdate = existing.some(t => t.id === tpl.id)
      const next = isUpdate ? existing.map(t => t.id === tpl.id ? tpl : t) : [tpl, ...existing]
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next))
    } catch { /* ignore */ }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="flex flex-col rounded-2xl overflow-hidden" style={{ width: 'fit-content', minWidth: '420px', maxWidth: '90vw', maxHeight: '90vh', background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2E2E2E' }}>
          <div>
            <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: '#00BFA5', fontFamily: 'Inter, sans-serif' }}>
              {initial ? 'Edit Template' : 'New Template'}
            </p>
            <h2 className="text-2xl font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
              {initial ? 'Edit Template' : 'Create Template'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: '#606060', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Template Name *</label>
            <input
              type="text" placeholder="e.g. Push Day A"
              value={name} onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: '#242424', border: '1px solid #2E2E2E', color: '#F5F5F5', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }}
              onFocus={e => (e.target.style.borderColor = '#00BFA544')}
              onBlur={e  => (e.target.style.borderColor = '#2E2E2E')}
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Type</label>
            <div className="grid grid-cols-4 gap-2">
              {TYPE_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setType(opt.value)}
                  className="py-2.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: type === opt.value ? opt.bg : '#242424',
                    color: type === opt.value ? opt.color : '#606060',
                    border: type === opt.value ? `1px solid ${opt.color}44` : '1px solid #2E2E2E',
                    fontFamily: 'Inter, sans-serif', cursor: 'pointer',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Exercise builder */}
          {(type === 'lift' || type === 'hybrid') && (
            <div>
              <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Exercises</label>
              <ExerciseBuilder rows={exerciseRows} onChange={setExRows} />
            </div>
          )}

          {/* Run builder */}
          {(type === 'run' || type === 'hybrid') && (
            <div>
              <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Run Structure</label>
              <RunBuilder entries={runRows} onChange={setRunRows} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid #2E2E2E' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: '#606060', fontFamily: 'Inter, sans-serif', background: 'none', border: 'none', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={!name.trim()}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold"
            style={{
              background: name.trim() ? '#00BFA5' : '#1A1A1A',
              color: name.trim() ? '#0D0D0D' : '#606060',
              fontFamily: 'Inter, sans-serif',
              cursor: name.trim() ? 'pointer' : 'not-allowed',
              border: 'none',
            }}>
            <Check size={14} />
            Save to Cell
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SelectTemplateModal ──────────────────────────────────────────────────────

interface SelectTemplateModalProps {
  onSelect: (t: StoredTemplate) => void
  onClose: () => void
}

function SelectTemplateModal({ onSelect, onClose }: SelectTemplateModalProps) {
  const [search, setSearch] = useState('')
  const [templates, setTemplates] = useState<StoredTemplate[]>([])

  useEffect(() => {
    getTemplates()
      .then(tpls => setTemplates(tpls as StoredTemplate[]))
      .catch(() => {
        try {
          const stored: StoredTemplate[] = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]')
          setTemplates(stored)
        } catch { /* ignore */ }
      })
  }, [])

  const filtered = templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full flex flex-col rounded-2xl overflow-hidden" style={{ maxWidth: '480px', maxHeight: '85vh', background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2E2E2E' }}>
          <div>
            <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: '#00BFA5', fontFamily: 'Inter, sans-serif' }}>My Templates</p>
            <h2 className="text-2xl font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>Select Template</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: '#606060', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pt-4 pb-2">
          <input
            value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates…" autoFocus
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: '#242424', border: '1px solid #2E2E2E', color: '#F5F5F5', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }}
          />
        </div>

        {/* Template list */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 flex flex-col gap-3">
          {filtered.length === 0 && (
            <div className="text-center py-12" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
              <p className="text-sm">No templates found.</p>
              <p className="text-xs mt-1">Create templates in the Templates tab first.</p>
            </div>
          )}
          {filtered.map(t => {
            const col = typeColor(t.type)
            const vol = calcVolume(t)
            return (
              <button key={t.id} onClick={() => onSelect(t)}
                className="text-left rounded-xl overflow-hidden transition-all"
                style={{ background: '#242424', border: `1px solid #2E2E2E`, cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = col)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#2E2E2E')}
              >
                {/* Template header */}
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #2E2E2E' }}>
                  <span className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'Inter, sans-serif' }}>{t.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: `${col}22`, color: col }}>{typeLabel(t.type)}</span>
                </div>

                {/* Exercise rows */}
                {(t.exerciseRows ?? []).length > 0 && (
                  <div className="px-4 py-2 space-y-1">
                    {(t.exerciseRows ?? []).map(row => (
                      <div key={row.id} className="flex items-center justify-between text-xs" style={{ color: '#A0A0A0', fontFamily: 'Inter, sans-serif' }}>
                        <span className="font-medium" style={{ color: '#F5F5F5' }}>{row.exerciseName || '—'}</span>
                        <span style={{ color: '#606060', fontFamily: 'JetBrains Mono, monospace' }}>
                          {row.sets.length} sets · {row.sets.map(s => `${s.reps}×${s.weight}kg`).join(', ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Run rows */}
                {(t.runRows ?? []).length > 0 && (
                  <div className="px-4 py-2" style={{ color: '#A0A0A0', fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
                    Run: {(t.runRows ?? []).length} segments
                  </div>
                )}

                {/* Volume footer */}
                {vol.weight > 0 && (
                  <div className="px-4 py-2 text-xs" style={{ borderTop: '1px solid #2E2E2E', color: '#606060', fontFamily: 'JetBrains Mono, monospace' }}>
                    🏋 {vol.weight.toLocaleString()} kg volume
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── EmptyCell ────────────────────────────────────────────────────────────────

interface EmptyCellProps {
  date: Date
  onCreateNew: () => void
  onSelectExisting: () => void
}

function EmptyCell({ date, onCreateNew, onSelectExisting }: EmptyCellProps) {
  return (
    <div style={{ borderRadius: '12px', padding: '10px', minHeight: '120px', display: 'flex', flexDirection: 'column', gap: '6px', background: '#0D0D0D', border: '1px solid #1A1A1A' }}>
      <div style={{ fontSize: '11px', color: '#374151', marginBottom: '2px' }}>{fmtDate(date)}</div>
      <button onClick={onCreateNew}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '8px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: '#00BFA50D', color: '#00BFA5', border: '1px dashed #00BFA530', transition: 'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.background = '#00BFA520'; e.currentTarget.style.borderColor = '#00BFA560' }}
        onMouseLeave={e => { e.currentTarget.style.background = '#00BFA50D'; e.currentTarget.style.borderColor = '#00BFA530' }}
      >
        <span style={{ fontSize: '14px' }}>+</span> Create Template
      </button>
      <button onClick={onSelectExisting}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '8px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: '#C8102E0D', color: '#C8102E', border: '1px dashed #C8102E30', transition: 'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.background = '#C8102E20'; e.currentTarget.style.borderColor = '#C8102E60' }}
        onMouseLeave={e => { e.currentTarget.style.background = '#C8102E0D'; e.currentTarget.style.borderColor = '#C8102E30' }}
      >
        <span style={{ fontSize: '14px' }}>↗</span> Use Template
      </button>
    </div>
  )
}

// ─── PopulatedCell ────────────────────────────────────────────────────────────

interface PopulatedCellProps {
  date: Date
  data: CellData
  onEdit: () => void
  onDelete: () => void
}

function PopulatedCell({ date, data, onEdit, onDelete }: PopulatedCellProps) {
  const { template } = data
  const vol = calcVolume(template)
  const col = typeColor(template.type)

  return (
    <div
      onClick={onEdit}
      role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onEdit()}
      style={{ borderRadius: '12px', padding: '10px', minHeight: '120px', display: 'flex', flexDirection: 'column', gap: '6px', background: '#141414', border: `1px solid ${col}40`, boxShadow: `0 2px 16px ${col}10`, cursor: 'pointer', transition: 'all 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 4px 24px ${col}25`; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 2px 16px ${col}10`; e.currentTarget.style.transform = 'none' }}
    >
      {/* Date + type badge + delete */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', color: '#6B7280' }}>{fmtDate(date)}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '100px', background: `${col}20`, color: col, fontWeight: 600 }}>{typeLabel(template.type)}</span>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            title="Remove template"
            style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(200,16,46,0.15)', border: '1px solid rgba(200,16,46,0.3)', color: '#C8102E', fontSize: '12px', lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          >×</button>
        </div>
      </div>

      {/* Name */}
      <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{template.name}</div>

      {/* Exercise preview */}
      <div style={{ fontSize: '11px', color: '#9CA3AF', flex: 1 }}>
        {(template.exerciseRows ?? []).slice(0, 3).map(r => (
          <div key={r.id} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.exerciseName || '—'} · {r.sets.length} sets
          </div>
        ))}
        {(template.exerciseRows ?? []).length > 3 && (
          <div style={{ color: '#4B5563' }}>+{(template.exerciseRows ?? []).length - 3} more</div>
        )}
        {(template.runRows ?? []).length > 0 && (template.exerciseRows ?? []).length === 0 && (
          <div style={{ color: '#9CA3AF' }}>Run: {(template.runRows ?? []).length} segments</div>
        )}
      </div>

      {/* Volume */}
      {(vol.weight > 0 || vol.distance > 0) && (
        <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#4B5563' }}>
          {vol.weight > 0 && <span>🏋 {vol.weight.toLocaleString()}kg</span>}
          {vol.distance > 0 && <span>🏃 {vol.distance}km</span>}
        </div>
      )}

    </div>
  )
}

// ─── CalendarGrid ─────────────────────────────────────────────────────────────

type ModalState =
  | { type: 'create'; key: string; initial?: StoredTemplate }
  | { type: 'select'; key: string }
  | null

interface CalendarGridProps {
  programme: Programme
  onUpdate: (cells: Record<string, CellData>) => void
  onSave: () => void
  onReset: () => void
  onRename: (name: string) => void
}

function CalendarGrid({ programme, onUpdate, onSave, onReset, onRename }: CalendarGridProps) {
  const [modal, setModal] = useState<ModalState>(null)
  const [saved, setSaved] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(programme.name)
  const monday = getMonday(programme.startDate)

  function handleSave() {
    onSave()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function getDate(week: number, day: number) {
    return addDays(monday, week * 7 + day)
  }

  function saveCell(key: string, template: StoredTemplate) {
    const prev = programme.cells[key]
    onUpdate({ ...programme.cells, [key]: { template, rpe: prev?.rpe ?? 0 } })
    setModal(null)
  }

  function clearCell(key: string) {
    const next = { ...programme.cells }
    delete next[key]
    onUpdate(next)
  }


  function weekTotals(w: number) {
    let weight = 0, distance = 0, rpeSum = 0, rpeCount = 0
    for (let d = 0; d < 7; d++) {
      const cell = programme.cells[`w${w}d${d}`]
      if (cell) {
        const vol = calcVolume(cell.template)
        weight += vol.weight
        distance += vol.distance
        if (cell.rpe > 0) { rpeSum += cell.rpe; rpeCount++ }
      }
    }
    return {
      weight: Math.round(weight),
      distance: Math.round(distance * 10) / 10,
      avgRpe: rpeCount > 0 ? Math.round((rpeSum / rpeCount) * 10) / 10 : 0,
    }
  }

  const totalsArr = Array.from({ length: programme.weeks }, (_, w) => weekTotals(w))
  const grand = totalsArr.reduce(
    (acc, t) => ({ weight: acc.weight + t.weight, distance: acc.distance + t.distance, rpeSum: acc.rpeSum + t.avgRpe, rpeCount: acc.rpeCount + (t.avgRpe > 0 ? 1 : 0) }),
    { weight: 0, distance: 0, rpeSum: 0, rpeCount: 0 }
  )
  const grandRpe = grand.rpeCount > 0 ? Math.round((grand.rpeSum / grand.rpeCount) * 10) / 10 : 0

  const COL = 172 // px per week column
  const LEFT = 90 // px for day label

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          {editingName ? (
            <form onSubmit={e => { e.preventDefault(); const t = nameValue.trim(); if (t) { onRename(t); setEditingName(false) } }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                autoFocus
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                onBlur={() => { const t = nameValue.trim(); if (t) onRename(t); setEditingName(false) }}
                onKeyDown={e => { if (e.key === 'Escape') { setNameValue(programme.name); setEditingName(false) } }}
                style={{ fontSize: '22px', fontWeight: 800, color: '#fff', fontFamily: 'Inter, sans-serif', background: '#242424', border: '1px solid #00BFA544', borderRadius: '8px', padding: '2px 10px', outline: 'none', width: `${Math.max(nameValue.length, 12)}ch` }}
              />
              <button type="submit" style={{ background: 'none', border: 'none', color: '#00BFA5', cursor: 'pointer', padding: 0 }}><Check size={18} /></button>
              <button type="button" onClick={() => { setNameValue(programme.name); setEditingName(false) }} style={{ background: 'none', border: 'none', color: '#606060', cursor: 'pointer', padding: 0 }}><X size={18} /></button>
            </form>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', margin: 0 }}>{programme.name}</h1>
              <button onClick={() => { setNameValue(programme.name); setEditingName(true) }}
                style={{ background: 'none', border: 'none', color: '#3E3E3E', cursor: 'pointer', padding: '2px', lineHeight: 1 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#00BFA5')}
                onMouseLeave={e => (e.currentTarget.style.color = '#3E3E3E')}
                title="Rename programme">
                <Pencil size={14} />
              </button>
            </div>
          )}
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 0 0' }}>
            {programme.weeks} Weeks · Starting {fmtDate(monday)} → {fmtDate(addDays(monday, programme.weeks * 7 - 1))}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleSave}
            style={{ padding: '8px 16px', borderRadius: '10px', background: saved ? '#00BFA520' : '#00BFA5', border: saved ? '1px solid #00BFA5' : 'none', color: saved ? '#00BFA5' : '#0D0D0D', fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
            {saved ? '✓ Saved' : 'Save Programme'}
          </button>
          <button onClick={onReset}
            style={{ padding: '8px 16px', borderRadius: '10px', background: '#1E1E1E', border: '1px solid #2E2E2E', color: '#9CA3AF', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            ← New Programme
          </button>
        </div>
      </div>

      {/* Scrollable calendar */}
      <div style={{ overflowX: 'auto', paddingBottom: '16px' }}>
        <div style={{ minWidth: `${LEFT + programme.weeks * (COL + 8) + COL + 8}px` }}>

          {/* Week column headers */}
          <div style={{ display: 'flex', gap: '8px', paddingLeft: `${LEFT}px`, marginBottom: '8px' }}>
            {Array.from({ length: programme.weeks }, (_, w) => (
              <div key={w} style={{ flexShrink: 0, width: `${COL}px`, textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>Week {w + 1}</div>
                <div style={{ fontSize: '11px', color: '#6B7280' }}>
                  {fmtDate(getDate(w, 0))} – {fmtDate(getDate(w, 6))}
                </div>
              </div>
            ))}
          </div>

          {/* Day rows */}
          {DAYS.map((day, d) => (
            <div key={d} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'flex-start' }}>
              {/* Day label */}
              <div style={{ flexShrink: 0, width: `${LEFT}px`, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '12px', paddingTop: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: d >= 5 ? '#6B7280' : '#9CA3AF' }}>{day}</span>
              </div>
              {/* Week cells */}
              {Array.from({ length: programme.weeks }, (_, w) => {
                const key = `w${w}d${d}`
                const cell = programme.cells[key]
                const date = getDate(w, d)
                return (
                  <div key={w} style={{ flexShrink: 0, width: `${COL}px` }}>
                    {cell
                      ? <PopulatedCell date={date} data={cell}
                          onEdit={() => setModal({ type: 'create', key, initial: cell.template })}
                          onDelete={() => clearCell(key)} />
                      : <EmptyCell date={date}
                          onCreateNew={() => setModal({ type: 'create', key })}
                          onSelectExisting={() => setModal({ type: 'select', key })} />}
                  </div>
                )
              })}
            </div>
          ))}

          {/* Totals row */}
          <div style={{ display: 'flex', gap: '8px', paddingLeft: `${LEFT}px`, marginTop: '12px', paddingTop: '12px', borderTop: '2px solid #1E1E1E' }}>
            {totalsArr.map((t, w) => (
              <div key={w} style={{ flexShrink: 0, width: `${COL}px`, padding: '12px', borderRadius: '12px', background: '#111', border: '1px solid #1E1E1E' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#6B7280', marginBottom: '8px' }}>Week {w + 1}</div>
                {t.weight > 0 && <div style={{ fontSize: '11px', color: '#D1D5DB', marginBottom: '4px' }}>🏋 {t.weight.toLocaleString()} kg</div>}
                {t.distance > 0 && <div style={{ fontSize: '11px', color: '#D1D5DB', marginBottom: '4px' }}>🏃 {t.distance} km</div>}
                {!t.weight && !t.distance && <div style={{ fontSize: '11px', color: '#374151', marginBottom: '4px' }}>—</div>}
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
                  <RpeCircle rpe={t.avgRpe} />
                </div>
              </div>
            ))}

            {/* Grand Total */}
            <div style={{ flexShrink: 0, width: `${COL}px`, padding: '12px', borderRadius: '12px', background: '#00BFA508', border: '1px solid #00BFA530' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#00BFA5', marginBottom: '8px' }}>Grand Total</div>
              {grand.weight > 0 && <div style={{ fontSize: '11px', color: '#D1D5DB', marginBottom: '4px' }}>🏋 {grand.weight.toLocaleString()} kg</div>}
              {grand.distance > 0 && <div style={{ fontSize: '11px', color: '#D1D5DB', marginBottom: '4px' }}>🏃 {grand.distance.toFixed(1)} km</div>}
              {!grand.weight && !grand.distance && <div style={{ fontSize: '11px', color: '#374151', marginBottom: '4px' }}>—</div>}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
                <RpeCircle rpe={grandRpe} />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Modals */}
      {modal?.type === 'create' && (
        <CreateTemplateModal
          initial={modal.initial}
          onSave={t => saveCell(modal.key, t)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'select' && (
        <SelectTemplateModal
          onSelect={t => saveCell(modal.key, t)}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}

// ─── Creation Form ────────────────────────────────────────────────────────────

interface CreationFormProps {
  onGenerate: (p: Programme) => void
}

function CreationForm({ onGenerate }: CreationFormProps) {
  const [name, setName]           = useState('')
  const [weeks, setWeeks]         = useState(12)
  const [startDate, setStartDate] = useState(nextMonday)

  function handleGenerate() {
    if (!name.trim()) return
    onGenerate({ id: '', name: name.trim(), weeks, startDate, cells: {} })
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '100px', background: '#00BFA515', border: '1px solid #00BFA530', marginBottom: '16px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#00BFA5' }}>Programme Builder</span>
        </div>
        <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>Build Your Training Block</h1>
        <p style={{ fontSize: '15px', color: '#6B7280', margin: 0 }}>Plan every session across your full programme with a structured week-by-week calendar</p>
      </div>

      {/* Form card */}
      <div style={{ borderRadius: '20px', padding: '28px', background: '#141414', border: '1px solid #2E2E2E' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6B7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Programme Name</label>
            <input
              value={name} onChange={e => setName(e.target.value)} placeholder="12-Week Strength Block"
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', background: '#1E1E1E', border: '1px solid #2E2E2E', color: '#fff', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6B7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Number of Weeks</label>
            <select
              value={weeks} onChange={e => setWeeks(parseInt(e.target.value))}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', background: '#1E1E1E', border: '1px solid #2E2E2E', color: '#fff', fontSize: '14px', boxSizing: 'border-box' }}
            >
              {WEEKS_OPTIONS.map(w => <option key={w} value={w}>{w} Weeks</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6B7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Start Date</label>
            <input
              type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', background: '#1E1E1E', border: '1px solid #2E2E2E', color: '#fff', fontSize: '14px', boxSizing: 'border-box', colorScheme: 'dark' }}
            />
          </div>
        </div>

        <button
          onClick={handleGenerate} disabled={!name.trim()}
          style={{ width: '100%', padding: '16px', borderRadius: '14px', background: name.trim() ? '#00BFA5' : '#1A2E2A', color: '#0D0D0D', fontWeight: 800, fontSize: '15px', border: 'none', cursor: name.trim() ? 'pointer' : 'not-allowed', opacity: name.trim() ? 1 : 0.5, letterSpacing: '0.01em', transition: 'all 0.2s' }}
        >
          Generate Programme Calendar →
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProgrammesPage() {
  const [programme, setProgramme] = useState<Programme | null>(null)
  const [savedList, setSavedList] = useState<Programme[]>([])
  const [currentProgId, setCurrentProgIdState] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Generate form
  const emptyStandards = { squat: '', deadlift: '', bench: '', pullups: '', run5k: '', run10k: '', runHalf: '', runFull: '' }
  const [genCurrent, setGenCurrent]     = useState(() => {
    try { const s = localStorage.getItem('lrr_standards'); return s ? { ...emptyStandards, ...JSON.parse(s) } : { ...emptyStandards } }
    catch { return { ...emptyStandards } }
  })
  const [genTarget,  setGenTarget]      = useState({ ...emptyStandards })
  const [genWeeks, setGenWeeks]         = useState(12)
  const [genDays, setGenDays]           = useState<number[]>([1, 3, 5, 6]) // Mon Wed Fri Sat
  const [genBalance, setGenBalance]         = useState(50) // 0 = 100% lift, 100 = 100% run
  const [genConstraints, setGenConstraints] = useState('')
  const [genLoading, setGenLoading]     = useState(false)
  const [genError, setGenError]         = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    Promise.all([getProgrammes(), getSetting('current_programme_id'), getSetting('gen_form_state')])
      .then(([progs, dbCurrentId, genFormRaw]) => {
        const list = progs as Programme[]
        setSavedList(list)
        let currentId = dbCurrentId ?? loadCurrentProgId()
        if (list.length === 1 || (currentId && !list.find(p => p.id === currentId))) {
          currentId = list[0]?.id ?? null
        }
        if (currentId) setCurrentProgId(currentId)
        setCurrentProgIdState(currentId)
        if (genFormRaw) {
          try {
            const f = JSON.parse(genFormRaw)
            if (f.weeks)       setGenWeeks(f.weeks)
            if (f.days)        setGenDays(f.days)
            if (f.balance != null) setGenBalance(f.balance)
            if (f.constraints) setGenConstraints(f.constraints)
            if (f.target)      setGenTarget((t: Record<string, string>) => ({ ...t, ...f.target }))
            if (f.current)     setGenCurrent((t: Record<string, string>) => ({ ...t, ...f.current }))
          } catch { /* ignore */ }
        }
        setReady(true)
      })
      .catch(() => {
        const list = migrateAndLoad()
        setSavedList(list)
        let currentId = loadCurrentProgId()
        if (list.length === 1 || (currentId && !list.find(p => p.id === currentId))) {
          currentId = list[0]?.id ?? null
          setCurrentProgId(currentId)
        }
        setCurrentProgIdState(currentId)
        setReady(true)
      })
  }, [])

  useEffect(() => {
    try { localStorage.setItem('lrr_standards', JSON.stringify(genCurrent)) } catch {}
  }, [genCurrent])

  function handleSetCurrent(id: string) {
    const next = currentProgId === id ? null : id
    setCurrentProgId(next)
    setCurrentProgIdState(next)
    upsertSetting('current_programme_id', next).catch(console.error)
  }

  function handleGenerate(p: Programme) {
    const withId = { ...p, id: `prog-${Date.now()}` }
    setSavedList(prev => {
      const next = [...prev, withId]
      if (next.length === 1) {
        setCurrentProgId(withId.id)
        setCurrentProgIdState(withId.id)
        upsertSetting('current_programme_id', withId.id).catch(console.error)
      }
      return next
    })
    setProgramme(withId)
    upsertProgramme(withId.id, withId).catch(console.error)
  }

  async function handleAIGenerate() {
    if (!genDays.length) return
    setGenLoading(true)
    setGenError('')
    upsertSetting('gen_form_state', JSON.stringify({
      weeks: genWeeks, days: genDays, balance: genBalance,
      constraints: genConstraints, target: genTarget, current: genCurrent,
    })).catch(console.error)
    try {
      const templates = await getTemplates()
      const library = (templates as { name: string; type: string }[]).map(t => ({ name: t.name, type: t.type }))

      const fmt = (label: string, curr: string, tgt: string, unit = '') =>
        tgt ? `- ${label}: current ${curr || 'unknown'}${unit}  →  target ${tgt}${unit}` : ''
      const goalLines = [
        fmt('Squat 1RM',       genCurrent.squat,    genTarget.squat,    ' kg'),
        fmt('Deadlift 1RM',    genCurrent.deadlift,  genTarget.deadlift,  ' kg'),
        fmt('Bench Press 1RM', genCurrent.bench,     genTarget.bench,     ' kg'),
        fmt('Pull Ups',        genCurrent.pullups,   genTarget.pullups,   ' reps'),
        fmt('5 km time',       genCurrent.run5k,     genTarget.run5k),
        fmt('10 km time',      genCurrent.run10k,    genTarget.run10k),
        fmt('Half Marathon',   genCurrent.runHalf,   genTarget.runHalf),
        fmt('Full Marathon',   genCurrent.runFull,   genTarget.runFull),
      ].filter(Boolean).join('\n')
      const balanceDesc = genBalance === 50
        ? 'Equal balance between lifting and running'
        : genBalance < 50
          ? `Training split: ${100 - genBalance}% Lifting / ${genBalance}% Running (strength focused)`
          : `Training split: ${100 - genBalance}% Lifting / ${genBalance}% Running (endurance focused)`
      const goal = [goalLines, balanceDesc].filter(Boolean).join('\n')

      const res = await fetch('/api/generate-programme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, weeks: genWeeks, trainingDays: genDays, constraints: genConstraints, library }),
      })
      if (!res.ok) { setGenError(await res.text()); return }

      // Stream the response and accumulate
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let raw = ''
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          raw += decoder.decode(value, { stream: true })
        }
      }

      // Extract JSON (strip any accidental markdown fences)
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) { setGenError('Could not parse AI response — please try again'); return }
      const data = JSON.parse(jsonMatch[0])

      // Expand phase templates into full week-by-week cells with progressive overload
      type AISession = { rpe: number; template: { name: string; type: string; exerciseRows?: { exerciseName: string; category: string; sets: { reps: string; weight: string }[] }[]; runRows?: { segmentType: string; metric: string; value: string }[] } }
      type AIPhase  = { name: string; startWeek: number; endWeek: number; deloadWeeks?: number[]; sessions: Record<string, AISession> }

      const weightProgress = data.weightProgressKgPerWeek ?? 2.5
      const runProgress    = data.runProgressMinPerWeek   ?? 2
      const ts             = Date.now()
      const cells: Record<string, CellData> = {}

      for (const phase of (data.phases ?? []) as AIPhase[]) {
        for (let w = phase.startWeek; w <= phase.endWeek; w++) {
          const weekOffset = w - phase.startWeek
          const isDeload   = (phase.deloadWeeks ?? []).includes(w)
          const liftMult   = isDeload ? 0.7 : 1
          const runMult    = isDeload ? 0.7 : 1

          for (const [dayKey, session] of Object.entries(phase.sessions)) {
            // Grid uses 0-based keys (w0d0 = Week 1 Monday); AI outputs 1-based (w1, d1)
            const dayNum = parseInt(dayKey.replace('d', '')) - 1
            const cellKey = `w${w - 1}d${dayNum}`
            cells[cellKey] = {
              rpe: isDeload ? Math.max(5, session.rpe - 2) : session.rpe,
              template: {
                id: `ai-${cellKey}-${ts}`,
                name: session.template.name + (isDeload ? ' (Deload)' : ''),
                type: session.template.type as TemplateKind,
                exerciseRows: (session.template.exerciseRows ?? []).map((ex, ei) => ({
                  id: `ex-${cellKey}-${ei}`,
                  exerciseId: '',
                  exerciseName: ex.exerciseName,
                  category: ex.category ?? 'barbell',
                  sets: (ex.sets ?? []).map((s, si) => {
                    const base   = parseFloat(s.weight) || 0
                    const added  = base > 0 ? Math.round((base + weekOffset * weightProgress) * liftMult / 2.5) * 2.5 : 0
                    return { id: `s-${cellKey}-${ei}-${si}`, reps: s.reps, weight: added > 0 ? String(added) : s.weight }
                  }),
                })),
                runRows: (session.template.runRows ?? []).map((r, ri) => {
                  let val = r.value
                  if (r.metric === 'time' && r.segmentType === 'easy') {
                    const mins = (parseFloat(r.value) || 0) + weekOffset * runProgress
                    val = String(Math.round(mins * runMult))
                  }
                  return { id: `run-${cellKey}-${ri}`, segmentType: r.segmentType, metric: r.metric as 'time' | 'distance', value: val }
                }),
              },
            }
          }
        }
      }

      const prog: Programme = {
        id: `prog-${Date.now()}`,
        name: data.name ?? `${genWeeks}-Week AI Programme`,
        weeks: data.weeks ?? genWeeks,
        startDate: nextMonday(),
        cells,
      }
      setSavedList(prev => {
        const next = [...prev, prog]
        if (next.length === 1) { setCurrentProgId(prog.id); setCurrentProgIdState(prog.id); upsertSetting('current_programme_id', prog.id).catch(console.error) }
        return next
      })
      setProgramme(prog)
      upsertProgramme(prog.id, prog).catch(console.error)
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setGenLoading(false)
    }
  }

  function handleUpdate(cells: Record<string, CellData>) {
    if (!programme) return
    const updated = { ...programme, cells }
    setProgramme(updated)
    setSavedList(prev => prev.map(p => p.id === updated.id ? updated : p))
    upsertProgramme(updated.id, updated).catch(console.error)
  }

  function handleSave() {
    if (!programme) return
    upsertProgramme(programme.id, programme).catch(console.error)
  }

  function handleReset() {
    setProgramme(null)
  }

  function handleRenameProg(id: string, newName: string) {
    const trimmed = newName.trim()
    if (!trimmed) return
    const next = savedList.map(p => p.id === id ? { ...p, name: trimmed } : p)
    setSavedList(next)
    if (programme?.id === id) setProgramme(prev => prev ? { ...prev, name: trimmed } : prev)
    setRenamingId(null)
    const renamed = next.find(p => p.id === id)
    if (renamed) upsertProgramme(renamed.id, renamed).catch(console.error)
  }

  function handleDeleteProg(id: string) {
    setSavedList(prev => prev.filter(p => p.id !== id))
    if (programme?.id === id) setProgramme(null)
    deleteProgramme(id).catch(console.error)
  }

  if (!ready) return null

  return (
    <div style={{ minHeight: '100vh', padding: '32px 24px', background: '#0D0D0D' }}>
      {programme
        ? <CalendarGrid programme={programme} onUpdate={handleUpdate} onSave={handleSave} onReset={handleReset} onRename={name => handleRenameProg(programme.id, name)} />
        : (
          <div style={{ maxWidth: '720px', margin: '0 auto' }}>
            {/* Saved programmes */}
            {savedList.length > 0 && (
              <div style={{ marginBottom: '40px' }}>
                <p style={{ fontSize: '11px', color: '#606060', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', fontFamily: 'Inter, sans-serif' }}>Saved Programmes</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {savedList.map(p => {
                    const monday = getMonday(p.startDate)
                    const isCurrent = currentProgId === p.id
                    return (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: '14px', background: '#141414', border: `1px solid ${isCurrent ? '#00BFA540' : '#2E2E2E'}`, cursor: 'pointer', transition: 'border-color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = '#00BFA5')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = isCurrent ? '#00BFA540' : '#2E2E2E')}
                        onClick={() => setProgramme(p)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {renamingId === p.id ? (
                                <form onSubmit={e => { e.preventDefault(); handleRenameProg(p.id, renameValue) }}
                                  onClick={e => e.stopPropagation()}
                                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <input
                                    autoFocus
                                    value={renameValue}
                                    onChange={e => setRenameValue(e.target.value)}
                                    onBlur={() => handleRenameProg(p.id, renameValue || p.name)}
                                    onKeyDown={e => e.key === 'Escape' && setRenamingId(null)}
                                    style={{ fontSize: '14px', fontWeight: 700, color: '#F5F5F5', fontFamily: 'Inter, sans-serif', background: '#242424', border: '1px solid #00BFA544', borderRadius: '6px', padding: '2px 8px', outline: 'none', width: `${Math.max(renameValue.length, 10)}ch` }}
                                  />
                                  <button type="submit" style={{ background: 'none', border: 'none', color: '#00BFA5', cursor: 'pointer', padding: 0 }}><Check size={14} /></button>
                                  <button type="button" onClick={e => { e.stopPropagation(); setRenamingId(null) }} style={{ background: 'none', border: 'none', color: '#606060', cursor: 'pointer', padding: 0 }}><X size={14} /></button>
                                </form>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#F5F5F5', fontFamily: 'Inter, sans-serif' }}>{p.name}</span>
                                  <button onClick={e => { e.stopPropagation(); setRenamingId(p.id); setRenameValue(p.name) }}
                                    style={{ background: 'none', border: 'none', color: '#3E3E3E', cursor: 'pointer', padding: '2px', lineHeight: 1 }}
                                    onMouseEnter={e => (e.currentTarget.style.color = '#00BFA5')}
                                    onMouseLeave={e => (e.currentTarget.style.color = '#3E3E3E')}
                                    title="Rename">
                                    <Pencil size={12} />
                                  </button>
                                </div>
                              )}
                              {isCurrent && <span style={{ fontSize: '10px', fontWeight: 700, color: '#00BFA5', background: '#00BFA515', border: '1px solid #00BFA530', borderRadius: '100px', padding: '1px 8px', fontFamily: 'Inter, sans-serif' }}>CURRENT</span>}
                            </div>
                            <div style={{ fontSize: '12px', color: '#606060', marginTop: '2px', fontFamily: 'Inter, sans-serif' }}>
                              {p.weeks} weeks · from {fmtDate(monday)}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button onClick={e => { e.stopPropagation(); handleSetCurrent(p.id) }}
                            style={{ padding: '5px 10px', borderRadius: '8px', background: isCurrent ? '#00BFA520' : '#1A1A1A', border: `1px solid ${isCurrent ? '#00BFA540' : '#2E2E2E'}`, color: isCurrent ? '#00BFA5' : '#606060', cursor: 'pointer', fontSize: '11px', fontWeight: 600, fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}
                            title={isCurrent ? 'Unset as current' : 'Set as current programme'}
                          >{isCurrent ? '✓ Current' : 'Set as Current'}</button>
                          <button onClick={e => { e.stopPropagation(); if (confirm('Delete this programme?')) handleDeleteProg(p.id) }}
                            style={{ padding: '6px', borderRadius: '8px', background: 'none', border: 'none', color: '#3E3E3E', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#C8102E')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#3E3E3E')}
                            title="Delete programme"
                          >×</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <CreationForm onGenerate={handleGenerate} />

            {/* Generate Training Block */}
            <div style={{ marginTop: '32px', padding: '28px', borderRadius: '18px', background: '#141414', border: '1px solid #2E2E2E' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '100px', background: '#A78BFA15', border: '1px solid #A78BFA30', marginBottom: '16px' }}>
                <Sparkles size={12} color="#A78BFA" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#A78BFA' }}>AI Powered</span>
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>Generate Training Block</h2>
              <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 24px' }}>Describe your goal and schedule — AI will build a complete, periodised programme using your exercise library.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Standards */}
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Metric</span>
                    <span style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Current</span>
                    <span style={{ fontSize: '11px', color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Target</span>
                  </div>
                  {([
                    { key: 'squat',    label: 'Squat 1RM',       unit: 'kg',      placeholder: '100',  fmt: null },
                    { key: 'deadlift', label: 'Deadlift 1RM',    unit: 'kg',      placeholder: '140',  fmt: null },
                    { key: 'bench',    label: 'Bench Press 1RM', unit: 'kg',      placeholder: '80',   fmt: null },
                    { key: 'pullups',  label: 'Pull Ups',        unit: 'reps',    placeholder: '8',    fmt: null },
                    { key: 'run5k',    label: '5 km',            unit: 'mm:ss',   placeholder: '25:00', fmt: fmtMmSs },
                    { key: 'run10k',   label: '10 km',           unit: 'mm:ss',   placeholder: '52:00', fmt: fmtMmSs },
                    { key: 'runHalf',  label: 'Half Marathon',   unit: 'h:mm:ss', placeholder: '2:00:00', fmt: fmtHMmSs },
                    { key: 'runFull',  label: 'Full Marathon',   unit: 'h:mm:ss', placeholder: '4:15:00', fmt: fmtHMmSs },
                  ] as { key: string; label: string; unit: string; placeholder: string; fmt: ((v: string) => string) | null }[]).map(row => {
                    const cur = (genCurrent as Record<string, string>)
                    const tgt = (genTarget  as Record<string, string>)
                    return (
                    <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '13px', color: '#F5F5F5', fontWeight: 600 }}>{row.label}</div>
                        <div style={{ fontSize: '11px', color: '#6B7280' }}>{row.unit}</div>
                      </div>
                      <input
                        type="text" placeholder={row.placeholder}
                        value={cur[row.key]}
                        onChange={e => { const v = row.fmt ? row.fmt(e.target.value) : e.target.value; setGenCurrent((p: Record<string, string>) => ({ ...p, [row.key]: v })) }}
                        style={{ padding: '8px 10px', borderRadius: '10px', background: '#1E1E1E', border: '1px solid #2E2E2E', color: '#F5F5F5', fontSize: '13px', outline: 'none', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}
                      />
                      <input
                        type="text" placeholder={row.placeholder}
                        value={tgt[row.key]}
                        onChange={e => { const v = row.fmt ? row.fmt(e.target.value) : e.target.value; setGenTarget(p => ({ ...p, [row.key]: v })) }}
                        style={{ padding: '8px 10px', borderRadius: '10px', background: '#1E1E1E', border: '1px solid #A78BFA33', color: '#A78BFA', fontSize: '13px', outline: 'none', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                    )
                  })}
                </div>

                {/* Balance */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Training Balance</label>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#F5F5F5' }}>
                      {genBalance === 50 ? '50 / 50' : `${100 - genBalance}% Lift · ${genBalance}% Run`}
                    </span>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="range" min={0} max={100} step={5} value={genBalance}
                      onChange={e => setGenBalance(Number(e.target.value))}
                      style={{ width: '100%', accentColor: genBalance < 50 ? '#00BFA5' : genBalance > 50 ? '#C8102E' : '#A78BFA', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#00BFA5', fontWeight: 600 }}>100% Lifting</span>
                      <span style={{ fontSize: '11px', color: '#C8102E', fontWeight: 600 }}>100% Running</span>
                    </div>
                  </div>
                </div>

                {/* Weeks */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#6B7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Programme Length</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {WEEKS_OPTIONS.map(w => (
                      <button key={w} onClick={() => setGenWeeks(w)}
                        style={{ padding: '8px 16px', borderRadius: '10px', border: `1px solid ${genWeeks === w ? '#A78BFA55' : '#2E2E2E'}`, background: genWeeks === w ? '#A78BFA20' : '#1E1E1E', color: genWeeks === w ? '#A78BFA' : '#6B7280', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                        {w}w
                      </button>
                    ))}
                  </div>
                </div>

                {/* Training days */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#6B7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Training Days</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['M','T','W','T','F','S','S'].map((label, i) => {
                      const day = i + 1
                      const active = genDays.includes(day)
                      return (
                        <button key={day} onClick={() => setGenDays(prev => active ? prev.filter(d => d !== day) : [...prev, day].sort())}
                          style={{ width: '40px', height: '40px', borderRadius: '10px', border: `1px solid ${active ? '#A78BFA55' : '#2E2E2E'}`, background: active ? '#A78BFA20' : '#1E1E1E', color: active ? '#A78BFA' : '#6B7280', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Constraints */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#6B7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Constraints & Preferences <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional)</span></label>
                  <textarea
                    value={genConstraints}
                    onChange={e => setGenConstraints(e.target.value)}
                    placeholder="e.g. Max 90 min per session. Old knee injury — no heavy leg work in week 1. Long run must be Sunday."
                    rows={2}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', background: '#1E1E1E', border: '1px solid #2E2E2E', color: '#fff', fontSize: '14px', boxSizing: 'border-box', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>

                {genError && (
                  <p style={{ fontSize: '13px', color: '#C8102E', margin: 0 }}>{genError}</p>
                )}

                <button
                  onClick={handleAIGenerate}
                  disabled={genLoading || !genDays.length}
                  style={{ width: '100%', padding: '16px', borderRadius: '14px', background: (genLoading || !genDays.length) ? '#1A1527' : '#A78BFA', color: (genLoading || !genDays.length) ? '#6B7280' : '#0D0D0D', fontWeight: 800, fontSize: '15px', border: 'none', cursor: (genLoading || !genDays.length) ? 'not-allowed' : 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {genLoading
                    ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Building your programme…</>
                    : <><Sparkles size={16} /> Generate Programme</>}
                </button>
              </div>
            </div>

          </div>
        )
      }
      <QuickLogFAB />
    </div>
  )
}
