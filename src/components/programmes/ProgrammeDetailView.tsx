'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { getSessions, type StoredSession } from '@/lib/db'
import type { CellData, Programme } from '@/lib/programmeTypes'
import {
  fillForwardCycles, loggedSetsFor, type LoggedSet,
  BARBELL_INCREMENT_KG, DUMBBELL_INCREMENT_KG, LOWER_BODY_INCREMENT_KG, UPPER_BODY_INCREMENT_KG,
} from '@/lib/programmeProgression'
import { pctOfBest, intensityColor } from '@/lib/trainingMaxes'
import { epleyRM } from '@/lib/computeStats'
import { useBestE1RMs } from '@/lib/useExerciseLoad'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import VolumeMultiplierSelect from '@/components/templates/VolumeMultiplierSelect'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const CYCLE = 4
const LABEL_W = 210
const LABEL_CSS = `clamp(120px, 32vw, ${LABEL_W}px)` // narrower on phones
const COL_W = 124
const AMBER = '#F59E0B'
const COLLAPSED_KEY = 'lrr_programme_detail_collapsed'

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const fmtDate = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}`
const norm = (s: string) => s.trim().toLowerCase()

interface Slot {
  day: number
  sfx: '' | '_2'
  title: string
  exercises: { key: string; name: string; category: string; sets: number }[]
}

const slotId = (s: Slot) => `${s.day}${s.sfx}`

/**
 * One table per day (and 2nd-session slot when used): exercise sets down,
 * weeks across. Days with no sets (hikes, runs, rest) get a single session row.
 */
function buildSlots(programme: Programme): Slot[] {
  const suffixes: ('' | '_2')[] = programme.sessionsPerDay === 2 ? ['', '_2'] : ['']
  const slots: Slot[] = []
  for (let d = 0; d < 7; d++) {
    for (const sfx of suffixes) {
      const names: string[] = []
      const exercises: Slot['exercises'] = []
      for (let w = 0; w < programme.weeks; w++) {
        const t = programme.cells[`w${w}d${d}${sfx}`]?.template
        if (!t) continue
        if (!names.includes(t.name)) names.push(t.name)
        for (const r of t.exerciseRows ?? []) {
          const key = norm(r.exerciseName)
          const ex = exercises.find(e => e.key === key)
          if (ex) ex.sets = Math.max(ex.sets, r.sets.length)
          else exercises.push({ key, name: r.exerciseName, category: r.category, sets: r.sets.length })
        }
      }
      // An unused 2nd-session slot is noise; every main day is always shown
      if (sfx && !names.length) continue
      slots.push({ day: d, sfx, title: names.length ? names.join(' / ') : 'Rest', exercises })
    }
  }
  return slots
}

// ─── Editable set (reps × kg) ─────────────────────────────────────────────────

function SetEditor({ reps, weight, label, onCommit }: {
  reps: string
  weight: string
  label: string
  onCommit: (reps: string, weight: string) => void
}) {
  const [r, setR] = useState(reps)
  const [w, setW] = useState(weight)

  const commit = () => { if (r !== reps || w !== weight) onCommit(r.trim(), w.trim()) }
  // Quiet until hovered/focused so the grid reads as numbers, not a wall of boxes
  const cls = 'rounded-md text-center outline-none border border-transparent bg-[#181818] hover:border-[#3E3E3E] focus:border-[#00BFA5] focus:bg-[#1E1E1E] transition-colors'
  const style = (width: number) => ({ width: `${width}px`, padding: '4px 2px', color: '#F5F5F5', fontSize: '14px', fontFamily: 'var(--font-mono)' })
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
    if (e.key === 'Escape') { setR(reps); setW(weight) }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
      <input value={r} onChange={e => setR(e.target.value)} onBlur={commit} onKeyDown={onKeyDown}
        inputMode="numeric" aria-label={`${label} reps`} className={cls} style={style(32)} />
      <span style={{ color: '#606060', fontSize: '12px' }}>×</span>
      <input value={w} onChange={e => setW(e.target.value)} onBlur={commit} onKeyDown={onKeyDown}
        inputMode="decimal" placeholder="BW" aria-label={`${label} kg`} className={cls} style={style(54)} />
    </span>
  )
}

/**
 * Under a set: % of best e1RM and this set's own est. 1RM, then (past weeks
 * only) the logged result. Fixed line heights keep rows even.
 */
function StatusLine({ pct, planned, actual, past, showRM }: {
  pct: number | null
  planned: { reps: string; weight: string }
  actual?: LoggedSet
  past: boolean
  showRM: boolean
}) {
  const w = parseFloat(planned.weight), r = parseInt(planned.reps)
  const setRM = showRM && w > 0 && r > 0 ? epleyRM(w, r) : null
  const hit = !!actual && actual.reps === planned.reps && (parseFloat(actual.weight) || 0) === (parseFloat(planned.weight) || 0)
  const line = { height: '15px', fontSize: '11px', lineHeight: '15px', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' as const }
  return (
    <div style={{ marginTop: '3px' }}>
      <div style={line}>
        {pct !== null && <span title="Weight as % of your best logged est. 1RM" style={{ color: intensityColor(pct) }}>{pct}%</span>}
        {pct !== null && setRM !== null && <span style={{ color: '#3E3E3E' }}> · </span>}
        {setRM !== null && <span title="This set's estimated 1RM (Epley)" style={{ color: '#8A8A8A' }}>1RM {setRM}</span>}
      </div>
      {past && (
        <div style={line}>
          {actual
            ? <span style={{ color: hit ? '#00BFA5' : AMBER }}>{hit ? '✓ done' : `did ${actual.reps || 0}×${actual.weight || 'BW'}`}</span>
            : <span style={{ color: '#606060' }}>not logged</span>}
        </div>
      )}
    </div>
  )
}

// ─── One day's table ──────────────────────────────────────────────────────────

const NAV_H = 64 // fixed site navbar height (h-16) — the week header pins just below it

function DayTable({ slot, open, onToggle, programme, weeks, monday, today, currentWeek, sessions, bests, updateSet }: {
  slot: Slot
  open: boolean
  onToggle: () => void
  programme: Programme
  weeks: number[]
  monday: Date
  today: string
  currentWeek: number | undefined
  sessions: StoredSession[]
  bests: Map<string, number>
  updateSet: (key: string, rowId: string, setIdx: number, reps: string, weight: string) => void
}) {
  const headRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  // Open at the current week, keeping last week in view for comparison
  useEffect(() => {
    if (open && bodyRef.current && currentWeek) bodyRef.current.scrollLeft = (currentWeek - 1) * COL_W
  }, [open, currentWeek])

  const syncHeader = () => { if (headRef.current && bodyRef.current) headRef.current.scrollLeft = bodyRef.current.scrollLeft }
  const step = (dir: 1 | -1) => bodyRef.current?.scrollBy({ left: dir * COL_W, behavior: 'smooth' })

  const tableStyle = { borderCollapse: 'separate' as const, borderSpacing: 0, tableLayout: 'fixed' as const, fontFamily: 'var(--font-sans)', width: `calc(${LABEL_CSS} + ${programme.weeks * COL_W}px)` }
  const cols = (
    <colgroup>
      <col style={{ width: LABEL_CSS }} />
      {weeks.map(w => <col key={w} style={{ width: `${COL_W}px` }} />)}
    </colgroup>
  )
  const navBtn = { width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: '#141414', border: '1px solid #2E2E2E', color: '#A0A0A0', cursor: 'pointer', padding: 0 }

  return (
    <div style={{ marginBottom: open ? '24px' : '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <h3 style={{ margin: 0, flex: 1, minWidth: 0 }}>
          <button onClick={onToggle} aria-expanded={open}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '6px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: 800, color: '#F5F5F5', fontFamily: 'var(--font-heading)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <ChevronDown size={16} style={{ color: '#8A8A8A', flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'none' : 'rotate(-90deg)' }} />
            <span>{DAYS[slot.day]}{slot.sfx ? ' (2nd)' : ''} <span style={{ color: '#00BFA5' }}>· {slot.title}</span></span>
            {!open && slot.exercises.length > 0 && (
              <span style={{ fontSize: '11px', fontWeight: 400, color: '#8A8A8A', fontFamily: 'var(--font-sans)', textTransform: 'none', letterSpacing: 0 }}>
                {slot.exercises.length} {slot.exercises.length === 1 ? 'exercise' : 'exercises'}
              </span>
            )}
          </button>
        </h3>
        {open && (
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <button onClick={() => step(-1)} aria-label="Previous week" title="Previous week" style={navBtn}><ChevronLeft size={16} /></button>
            <button onClick={() => step(1)} aria-label="Next week" title="Next week" style={navBtn}><ChevronRight size={16} /></button>
          </div>
        )}
      </div>

      {open && <div style={{ borderRadius: '12px', border: '1px solid #2E2E2E' }}>
        {/* Week header: its own strip so it can pin under the navbar; scrolls sideways with the body */}
        <div ref={headRef} style={{ position: 'sticky', top: `${NAV_H}px`, zIndex: 5, overflow: 'hidden', background: '#141414', borderRadius: '12px 12px 0 0', borderBottom: '1px solid #2E2E2E' }}>
          <table style={tableStyle}>
            {cols}
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, zIndex: 2, background: '#141414' }} />
                {weeks.map(w => {
                  const deload = programme.deloads?.[w]
                  const isCurrent = w === currentWeek
                  return (
                    <th key={w} style={{ padding: '10px 4px', textAlign: 'center', background: isCurrent ? '#00BFA515' : deload ? 'rgba(245,158,11,0.06)' : '#141414' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: deload ? AMBER : isCurrent ? '#00BFA5' : '#F5F5F5' }}>
                        Wk {w + 1}{deload ? ` · ${deload.pct}%` : ''}
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 400, color: '#8A8A8A' }}>{fmtDate(addDays(monday, w * 7 + slot.day))}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
          </table>
        </div>

        <div ref={bodyRef} onScroll={syncHeader} style={{ overflowX: 'auto', borderRadius: '0 0 12px 12px' }}>
          <table style={tableStyle}>
            {cols}
            <tbody>
              {slot.exercises.length === 0 && (
                <tr>
                  <td style={{ position: 'sticky', left: 0, zIndex: 1, padding: '8px 10px', background: '#0D0D0D', fontSize: '11px', color: '#8A8A8A' }}>Session</td>
                  {weeks.map(w => {
                    const t = programme.cells[`w${w}d${slot.day}${slot.sfx}`]?.template
                    const date = isoDate(addDays(monday, w * 7 + slot.day))
                    const logged = t && date <= today ? loggedSetsFor(sessions, date, t.name) : null
                    return (
                      <td key={w} style={{ padding: '8px 4px', textAlign: 'center', fontSize: '11px', background: w === currentWeek ? '#00BFA508' : 'transparent' }}>
                        <div style={{ color: t ? '#F5F5F5' : '#3E3E3E', fontWeight: t ? 600 : 400 }}>{t?.name ?? 'Rest'}</div>
                        {t?.hikeData?.distanceKm && <div style={{ fontSize: '10px', color: '#8A8A8A' }}>{t.hikeData.distanceKm} km</div>}
                        {logged && <div style={{ fontSize: '10px', color: '#00BFA5' }}>✓ logged</div>}
                      </td>
                    )
                  })}
                </tr>
              )}
              {slot.exercises.flatMap((ex, exIdx) => [
                // Exercise header row: name, best e1RM, volume multiplier
                <tr key={`${ex.key}-head`}>
                  <td style={{ position: 'sticky', left: 0, zIndex: 1, padding: '10px 12px 6px', background: '#141414', borderTop: exIdx ? '1px solid #2E2E2E' : 'none' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#F5F5F5', lineHeight: 1.3 }}>{ex.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {ex.category !== 'bodyweight' && bests.get(ex.key) && (
                        <span title="Best estimated 1RM from your logged sets (10 reps or fewer)" style={{ fontSize: '11px', color: 'var(--color-text-subtle)', fontFamily: 'var(--font-mono)' }}>
                          e1RM {bests.get(ex.key)} kg
                        </span>
                      )}
                      <VolumeMultiplierSelect name={ex.name} category={ex.category} />
                    </div>
                  </td>
                  <td colSpan={programme.weeks} style={{ background: '#141414', borderTop: exIdx ? '1px solid #2E2E2E' : 'none' }} />
                </tr>,
                ...Array.from({ length: ex.sets }, (_, i) => (
                  <tr key={`${ex.key}-${i}`}>
                    <td style={{ position: 'sticky', left: 0, zIndex: 1, padding: '12px 12px 6px', verticalAlign: 'top', background: '#0D0D0D', borderTop: '1px solid #1A1A1A', fontSize: '12px', color: '#8A8A8A', fontFamily: 'var(--font-sans)' }}>
                      Set {i + 1}
                    </td>
                    {weeks.map(w => {
                      const key = `w${w}d${slot.day}${slot.sfx}`
                      const cell = programme.cells[key]
                      const row = cell?.template.exerciseRows?.find(r => norm(r.exerciseName) === ex.key)
                      const set = row?.sets[i]
                      const date = isoDate(addDays(monday, w * 7 + slot.day))
                      const past = date <= today
                      const logged = past && cell ? loggedSetsFor(sessions, date, cell.template.name) : null
                      const deload = !!programme.deloads?.[w]
                      const pct = ex.category !== 'bodyweight' && set ? pctOfBest(set.weight, bests.get(ex.key)) : null
                      return (
                        <td key={w} style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'top', borderTop: '1px solid #1A1A1A', background: w === currentWeek ? '#00BFA508' : deload ? 'rgba(245,158,11,0.04)' : 'transparent', opacity: past && w !== currentWeek ? 0.8 : 1 }}>
                          {row && set ? (
                            <>
                              {/* keyed on the values so external changes (fill forward) reset local edits */}
                              <SetEditor key={`${set.reps}|${set.weight}`} reps={set.reps} weight={set.weight}
                                label={`${ex.name} set ${i + 1} week ${w + 1}`}
                                onCommit={(r, kg) => updateSet(key, row.id, i, r, kg)} />
                              <StatusLine pct={pct} planned={set} past={past} actual={logged?.get(ex.key)?.[i]} showRM={ex.category !== 'bodyweight'} />
                            </>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#3E3E3E' }}>—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      </div>}
    </div>
  )
}

// ─── Detailed view ────────────────────────────────────────────────────────────

export default function ProgrammeDetailView({ programme, monday, onUpdate }: {
  programme: Programme
  monday: Date
  onUpdate: (cells: Record<string, CellData>) => void
}) {
  const [sessions, setSessions] = useState<StoredSession[]>([])
  const bests = useBestE1RMs()
  const [confirmFill, setConfirmFill] = useState(false)
  // Collapsed day tables, remembered per device
  const [collapsed, setCollapsed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '[]') } catch { return [] }
  })

  function setCollapsedSaved(next: string[]) {
    setCollapsed(next)
    try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)) } catch { /* per-device convenience only */ }
  }
  const toggleSlot = (id: string) =>
    setCollapsedSaved(collapsed.includes(id) ? collapsed.filter(x => x !== id) : [...collapsed, id])

  useEffect(() => {
    getSessions().then(setSessions).catch(console.error)
  }, [])

  const slots = useMemo(() => buildSlots(programme), [programme])
  const allCollapsed = slots.every(s => collapsed.includes(slotId(s)))
  const fillPreview = useMemo(() => fillForwardCycles(programme, CYCLE), [programme])
  const today = isoDate(new Date())
  const weeks = Array.from({ length: programme.weeks }, (_, w) => w)
  const weekStart = (w: number) => isoDate(addDays(monday, w * 7))
  const currentWeek = weeks.find(w => weekStart(w) <= today && today <= isoDate(addDays(monday, w * 7 + 6)))

  function updateSet(key: string, rowId: string, setIdx: number, reps: string, weight: string) {
    const cell = programme.cells[key]
    if (!cell) return
    const exerciseRows = (cell.template.exerciseRows ?? []).map(r => r.id !== rowId ? r : {
      ...r, sets: r.sets.map((s, i) => i === setIdx ? { ...s, reps, weight } : s),
    })
    onUpdate({ ...programme.cells, [key]: { ...cell, template: { ...cell.template, exerciseRows } } })
  }

  const human = (ws: number[]) => ws.map(w => w + 1).join(', ')

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', padding: '12px 14px', borderRadius: '12px', background: '#141414', border: '1px solid #2E2E2E' }}>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-subtle)', fontFamily: 'var(--font-sans)', maxWidth: '560px' }}>
          Click any set to change reps × kg; it saves for that week only. Past weeks show what you logged.
          <span style={{ color: AMBER }}> Amber = deload week</span> — edits there are lost if the deload is removed.
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {slots.length > 1 && (
            <Button size="sm" variant="subtle" onClick={() => setCollapsedSaved(allCollapsed ? [] : slots.map(slotId))}>
              {allCollapsed ? 'Expand all' : 'Collapse all'}
            </Button>
          )}
          <Button size="sm" onClick={() => setConfirmFill(true)} disabled={fillPreview.weeksFilled.length === 0}>
            Fill forward
          </Button>
        </div>
      </div>

      {slots.map(slot => (
        <DayTable key={slotId(slot)} slot={slot} open={!collapsed.includes(slotId(slot))} onToggle={() => toggleSlot(slotId(slot))}
          programme={programme} weeks={weeks} monday={monday} today={today} currentWeek={currentWeek}
          sessions={sessions} bests={bests} updateSet={updateSet} />
      ))}

      {confirmFill && (
        <Modal
          onClose={() => setConfirmFill(false)}
          eyebrow="Fill forward"
          title="Repeat weeks 1–3?"
          maxWidth={460}
          footer={<>
            <Button variant="subtle" fullWidth onClick={() => setConfirmFill(false)}>Cancel</Button>
            <Button fullWidth onClick={() => { onUpdate(fillPreview.cells); setConfirmFill(false) }}>Fill forward</Button>
          </>}
        >
          <p style={{ fontSize: '14px', color: '#F5F5F5', fontFamily: 'var(--font-sans)', margin: 0 }}>
            Week 1 → weeks 5 &amp; 9, week 2 → 6 &amp; 10, week 3 → 7 &amp; 11, adding
            <strong> +{BARBELL_INCREMENT_KG} kg barbell</strong> and <strong>+{DUMBBELL_INCREMENT_KG} kg dumbbell</strong> each cycle.
          </p>
          <p style={{ fontSize: '13px', color: 'var(--color-text-subtle)', fontFamily: 'var(--font-sans)', margin: 0 }}>
            Machines and weighted bodyweight moves add +{LOWER_BODY_INCREMENT_KG} kg for legs, +{UPPER_BODY_INCREMENT_KG} kg for upper body.
            Weeks {human(fillPreview.weeksFilled)} will be replaced. Deload weeks are left as they are.
            Bodyweight sets with no kg stay unchanged. You can still edit any set afterwards.
          </p>
        </Modal>
      )}
    </div>
  )
}
