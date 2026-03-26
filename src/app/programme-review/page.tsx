'use client'

import { useState, useEffect, useRef } from 'react'
import { Sparkles, ChevronDown, ChevronUp, AlertCircle, Clock } from 'lucide-react'
import QuickLogFAB from '@/components/log/QuickLogFAB'
import { getProgrammes, getAIReports, upsertAIReport, deleteAIReport, getSetting, upsertProgramme } from '@/lib/db'
import { usePremium } from '@/hooks/usePremium'
import { FEATURES } from '@/lib/features'

// ─── Types (mirrored from programmes page) ────────────────────────────────────

interface SetRow  { id?: string; reps: string; weight: string }
interface ExRow   { id?: string; exerciseId?: string; exerciseName: string; category?: string; sets: SetRow[] }
interface RunSegment { id?: string; segmentType: string; metric: string; value: string; pace?: string }
interface RepeatBlock { kind: 'repeat'; count: string; laps: RunSegment[] }
type RunEntry = RunSegment | RepeatBlock

interface StoredTemplate {
  id?: string
  name: string
  type: string
  exerciseRows?: ExRow[]
  runRows?: RunEntry[]
}
interface CellData { template: StoredTemplate; rpe: number }
interface Programme {
  id: string
  name: string
  weeks: number
  startDate: string
  sessionsPerDay?: 1 | 2
  cells: Record<string, CellData>
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
interface SavedReport {
  id: string
  programmeName: string
  date: string  // ISO
  review: string
}

// ─── Run pace helpers (shared with programmes page) ──────────────────────────

function parseMmSs(t: string): number {
  const parts = t.split(':').map(Number)
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0)
  if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0)
  return 0
}
function secsToMmSs(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.round(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
function paceForSegment(segType: string, run5k: string, run10k: string): string {
  const pace5k  = parseMmSs(run5k)  > 0 ? parseMmSs(run5k)  / 5  : 0
  const pace10k = parseMmSs(run10k) > 0 ? parseMmSs(run10k) / 10 : 0
  if (!pace5k && !pace10k) return ''
  const base5k  = pace5k  || pace10k * 1.3
  const base10k = pace10k || pace5k  * 1.1
  switch (segType) {
    case 'easy': case 'warm-up': case 'cool-down': case 'long': return secsToMmSs(base5k * 1.35)
    case 'tempo':    return secsToMmSs(base10k)
    case 'interval': return secsToMmSs(base5k * 0.97)
    default:         return secsToMmSs(base5k * 1.25)
  }
}
function thisOrNextMonday(): string {
  const d = new Date()
  const day = d.getDay()
  const daysUntil = day === 1 ? 0 : (8 - day) % 7 || 7
  d.setDate(d.getDate() + daysUntil)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Format programme into readable text for AI ───────────────────────────────

function formatProgramme(prog: Programme): string {
  const lines: string[] = []
  lines.push(`Programme: ${prog.name}`)
  lines.push(`Duration: ${prog.weeks} weeks`)
  lines.push(`Start date: ${prog.startDate}`)
  lines.push('')

  // Detect whether cells use 0-based (w0d0) or 1-based (w1d1) week keys
  const cellKeys = Object.keys(prog.cells)
  const hasW0 = cellKeys.some(k => k.startsWith('w0'))
  const weekBase = hasW0 ? 0 : 1
  const dayBase  = hasW0 ? 0 : 1

  const sessionsPerDay = prog.sessionsPerDay ?? 1
  if (sessionsPerDay === 2) lines.push(`Note: ${sessionsPerDay} sessions per day`)
  lines.push('Weekly Schedule (Week 1 as representative):')

  function formatCell(t: StoredTemplate, label: string, rpe: number) {
    lines.push(`  ${label}: ${t.name} (${t.type})${rpe ? ` — RPE ${rpe}` : ''}`)
    if (t.exerciseRows?.length) {
      for (const ex of t.exerciseRows) {
        const setStr = ex.sets
          .filter(s => s.reps || s.weight)
          .map(s => `${s.reps || '?'} reps${s.weight ? ` @ ${s.weight}kg` : ''}`)
          .join(', ')
        lines.push(`    • ${ex.exerciseName}${setStr ? `: ${setStr}` : ''}`)
      }
    }
    if ((t as { hikeData?: { distanceKm: string } }).hikeData?.distanceKm) {
      lines.push(`    • Hike: ${(t as { hikeData: { distanceKm: string } }).hikeData.distanceKm} km`)
    }
    if (t.runRows?.length) {
      for (const entry of t.runRows) {
        if ('kind' in entry) {
          const b = entry as RepeatBlock
          lines.push(`    • ×${b.count} Repeat:`)
          for (const lap of b.laps) {
            lines.push(`      - ${lap.segmentType}: ${lap.value} ${lap.metric}${lap.pace ? ` @ ${lap.pace}/km` : ''}`)
          }
        } else {
          const s = entry as RunSegment
          lines.push(`    • ${s.segmentType}: ${s.value} ${s.metric}${s.pace ? ` @ ${s.pace}/km` : ''}`)
        }
      }
    }
  }

  for (let d = 0; d < 7; d++) {
    const key  = `w${weekBase}d${dayBase + d}`
    const key2 = `w${weekBase}d${dayBase + d}_2`
    const cell  = prog.cells[key]
    const cell2 = prog.cells[key2]
    if (!cell && !cell2) {
      lines.push(`  ${DAYS[d]}: Rest`)
      continue
    }
    if (cell)  formatCell(cell.template,  sessionsPerDay === 2 ? `${DAYS[d]} (Session 1)` : DAYS[d], cell.rpe)
    if (cell2) formatCell(cell2.template, `${DAYS[d]} (Session 2)`, cell2.rpe)
  }

  // Check if there are variations across weeks
  const nextWeekPrefix = `w${weekBase + 1}`
  if (prog.weeks > 1 && cellKeys.some(k => k.startsWith(nextWeekPrefix))) {
    lines.push('')
    lines.push('Note: Programme has week-by-week variations across ' + prog.weeks + ' weeks.')
  }

  return lines.join('\n')
}

// ─── Simple markdown renderer ─────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} style={{ color: '#F5F5F5' }}>{part.slice(2, -2)}</strong>
      : part
  )
}

function MarkdownTable({ rows }: { rows: string[] }) {
  const headerRow = rows[0]
  const dataRows  = rows.slice(2) // skip separator row
  const headers   = headerRow.split('|').map(c => c.trim()).filter(Boolean)
  const parsed    = dataRows.map(r => r.split('|').map(c => c.trim()).filter(Boolean))

  return (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #3E3E3E' }}>
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-bold uppercase tracking-wider"
                style={{ color: '#00BFA5', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
                {renderInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parsed.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: '1px solid #2E2E2E', background: ri % 2 === 0 ? '#1E1E1E' : 'transparent' }}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-sm" style={{ color: '#D0D0D0', fontFamily: 'Inter, sans-serif' }}>
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MarkdownBlock({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  // Two-column state for Analysis / Recommendations sections
  let twoColState: 'none' | 'analysis' | 'recs' = 'none'
  let analysisItems: React.ReactNode[] = []
  let recItems:      React.ReactNode[] = []

  function flushTwoCol(key: string) {
    if (twoColState === 'none') return
    elements.push(
      <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', marginTop: 8 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#606060', fontFamily: 'Montserrat, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Analysis</p>
          {analysisItems}
        </div>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#A78BFA', fontFamily: 'Montserrat, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Recommendations</p>
          {recItems}
        </div>
      </div>
    )
    twoColState = 'none'
    analysisItems = []
    recItems = []
  }

  function makeBullet(key: string | number, content: string) {
    const dotColor = twoColState !== 'none' ? '#C084FC' : '#00BFA5'
    return (
      <div key={key} className="flex gap-2 mb-1.5">
        <span className="flex-shrink-0" style={{ color: dotColor, marginTop: '6px', fontSize: '8px' }}>●</span>
        <span className="text-sm leading-relaxed" style={{ color: '#D0D0D0', fontFamily: 'Inter, sans-serif' }}>
          {renderInline(content)}
        </span>
      </div>
    )
  }

  function pushItem(node: React.ReactNode) {
    if (twoColState === 'analysis') analysisItems.push(node)
    else if (twoColState === 'recs')  recItems.push(node)
    else elements.push(node)
  }

  while (i < lines.length) {
    const line = lines[i]

    // Horizontal rule — flush two-col first
    if (line.trim() === '---') {
      flushTwoCol(`twocol-hr-${i}`)
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid #2E2E2E', margin: '20px 0' }} />)

    // H2 heading — flush two-col first
    } else if (line.startsWith('## ')) {
      flushTwoCol(`twocol-h2-${i}`)
      elements.push(
        <h2 key={i} className="text-sm font-black uppercase tracking-widest mt-6 mb-3 px-3 py-1.5 rounded"
          style={{ color: '#00BFA5', fontFamily: 'Montserrat, sans-serif', background: '#00BFA510', display: 'inline-block' }}>
          {line.slice(3)}
        </h2>
      )

    // H3 heading
    } else if (line.startsWith('### ')) {
      pushItem(
        <h3 key={i} className="text-sm font-bold mt-4 mb-2"
          style={{ color: '#F5F5F5', fontFamily: 'Montserrat, sans-serif' }}>
          {line.slice(4)}
        </h3>
      )

    // Bold-only line — detect Analysis / Recommendations markers
    } else if (line.startsWith('**') && line.endsWith('**') && !line.slice(2, -2).includes('**')) {
      const label = line.slice(2, -2).replace(/:$/, '').trim()
      if (label === 'Analysis') {
        twoColState = 'analysis'
      } else if (label === 'Recommendations') {
        twoColState = 'recs'
      } else {
        pushItem(
          <h3 key={i} className="text-sm font-bold mt-4 mb-2"
            style={{ color: '#00BFA5', fontFamily: 'Montserrat, sans-serif' }}>
            {label}
          </h3>
        )
      }

    // Table — collect all consecutive table rows
    } else if (line.startsWith('|')) {
      flushTwoCol(`twocol-tbl-${i}`)
      const tableRows: string[] = []
      while (i < lines.length && lines[i].startsWith('|')) {
        tableRows.push(lines[i])
        i++
      }
      elements.push(<MarkdownTable key={`table-${i}`} rows={tableRows} />)
      continue

    // Load chart line (contains █ or ░)
    } else if (line.includes('█') || line.includes('░')) {
      pushItem(
        <div key={i} className="px-3 py-1 font-mono text-xs"
          style={{ color: '#A0A0A0', fontFamily: 'JetBrains Mono, monospace', lineHeight: '1.8' }}>
          {line}
        </div>
      )

    // Numbered list — render as bullet inside two-col sections
    } else if (line.match(/^\d+\.\s/)) {
      if (twoColState !== 'none') {
        pushItem(makeBullet(i, line.replace(/^\d+\.\s/, '')))
      } else {
        pushItem(
          <div key={i} className="flex gap-2 mb-1 ml-2">
            <span className="text-xs font-bold mt-0.5 flex-shrink-0"
              style={{ color: '#C8102E', fontFamily: 'JetBrains Mono, monospace' }}>
              {line.match(/^(\d+)\./)?.[1]}.
            </span>
            <span className="text-sm leading-relaxed" style={{ color: '#D0D0D0', fontFamily: 'Inter, sans-serif' }}>
              {renderInline(line.replace(/^\d+\.\s/, ''))}
            </span>
          </div>
        )
      }

    // Bullet list (- • * prefixes)
    } else if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
      pushItem(makeBullet(i, line.slice(2)))

    // Empty line
    } else if (line.trim() === '') {
      if (twoColState === 'none') elements.push(<div key={i} className="h-1" />)

    // Plain paragraph
    } else {
      pushItem(
        <p key={i} className="text-sm leading-relaxed mb-1"
          style={{ color: '#D0D0D0', fontFamily: 'Inter, sans-serif' }}>
          {renderInline(line)}
        </p>
      )
    }
    i++
  }

  flushTwoCol('twocol-end')
  return <div>{elements}</div>
}

// ─── Programme breakdown charts ───────────────────────────────────────────────

const PPL_KEYWORDS: [RegExp, string][] = [
  [/bench|push.?up|fly|chest|pec/i,                                       'Push'],
  [/overhead.?press|ohp|shoulder.?press|military|lateral.?raise|front.?raise/i, 'Push'],
  [/tricep|pushdown|skull|extension/i,                                    'Push'],
  [/row|pull.?up|chin.?up|lat\b|pulldown|face.?pull|rear.?delt|shrug/i,  'Pull'],
  [/curl|bicep/i,                                                          'Pull'],
  [/squat|lunge|leg.?press|hip.?thrust|glute|calf|step.?up|hack/i,       'Legs'],
  [/deadlift|rdl|romanian/i,                                               'Legs'],
  [/plank|crunch|sit.?up|hollow|\bab\b|core|russian|oblique/i,            'Core'],
]

const BODY_KEYWORDS: [RegExp, string][] = [
  [/bench|push.?up|fly|chest|pec/i,                                        'Chest'],
  [/overhead.?press|ohp|shoulder.?press|military|lateral.?raise|front.?raise|rear.?delt|face.?pull/i, 'Shoulders'],
  [/row|pull.?up|chin.?up|lat\b|pulldown|shrug/i,                          'Back'],
  [/deadlift|rdl|romanian/i,                                                'Back'],
  [/squat|lunge|leg.?press|hip.?thrust|glute|calf|step.?up|hack/i,        'Legs'],
  [/curl|bicep/i,                                                           'Arms'],
  [/tricep|pushdown|skull|extension/i,                                      'Arms'],
  [/plank|crunch|sit.?up|hollow|\bab\b|core|russian|oblique/i,             'Core'],
]

function classifyPPL(name: string): string {
  for (const [re, cat] of PPL_KEYWORDS) if (re.test(name)) return cat
  return 'Push' // fallback for unknown pressing movements
}
function classifyBodyPart(name: string): string {
  for (const [re, bp] of BODY_KEYWORDS) if (re.test(name)) return bp
  return 'Back' // fallback
}

function analyseProgramme(prog: Programme) {
  const ppl:  Record<string, number> = { Push: 0, Pull: 0, Legs: 0, Core: 0, Cardio: 0 }
  const body: Record<string, number> = { Chest: 0, Back: 0, Shoulders: 0, Legs: 0, Arms: 0, Core: 0, Cardio: 0 }

  const cellKeys = Object.keys(prog.cells)
  const hasW0    = cellKeys.some(k => k.startsWith('w0'))
  const weekKey  = hasW0 ? 'w0' : 'w1'

  for (const [key, cell] of Object.entries(prog.cells)) {
    if (!key.startsWith(weekKey)) continue
    const type = cell.template.type

    if (type === 'run' || type === 'hike') {
      ppl.Cardio  += 3
      body.Cardio += 3
      continue
    }

    for (const ex of (cell.template.exerciseRows ?? [])) {
      const n    = ex.exerciseName
      const sets = ex.sets?.length ?? 3
      ppl[classifyPPL(n)]       = (ppl[classifyPPL(n)]       || 0) + sets
      body[classifyBodyPart(n)] = (body[classifyBodyPart(n)] || 0) + sets
    }

    if (type === 'hybrid') {
      const runCount = (cell.template.runRows ?? []).length
      if (runCount) { ppl.Cardio += 2; body.Cardio += 2 }
    }
  }
  return { ppl, body }
}

const PPL_COLORS:  Record<string, string> = { Push: '#C8102E', Pull: '#00BFA5', Legs: '#A78BFA', Core: '#FF9500', Cardio: '#3B82F6' }
const BODY_COLORS: Record<string, string> = { Chest: '#C8102E', Back: '#00BFA5', Shoulders: '#FF9500', Legs: '#A78BFA', Arms: '#F472B6', Core: '#6B7280', Cardio: '#3B82F6' }

function DonutChart({ counts, colors, size = 96 }: { counts: Record<string, number>; colors: Record<string, string>; size?: number }) {
  const entries = Object.entries(counts).filter(([, v]) => v > 0)
  const total   = entries.reduce((s, [, v]) => s + v, 0)
  if (total === 0) return <div style={{ width: size, height: size, borderRadius: '50%', background: '#2E2E2E' }} />

  const cx = size / 2, cy = size / 2, r = size / 2 - 2, hole = r * 0.52
  let angle = -Math.PI / 2
  const paths = entries.map(([label, value], i) => {
    const sweep = (value / total) * 2 * Math.PI
    if (sweep >= 2 * Math.PI - 0.001) return <circle key={i} cx={cx} cy={cy} r={r} fill={colors[label] ?? '#606060'} />
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle)
    angle += sweep
    const x2 = cx + r * Math.cos(angle), y2 = cy + r * Math.sin(angle)
    return (
      <path key={i}
        d={`M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${sweep > Math.PI ? 1 : 0},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`}
        fill={colors[label] ?? '#606060'} />
    )
  })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {paths}
      <circle cx={cx} cy={cy} r={hole} fill="#1A1A1A" />
    </svg>
  )
}

function ChartLegend({ counts, colors }: { counts: Record<string, number>; colors: Record<string, string> }) {
  const total   = Object.values(counts).reduce((s, v) => s + v, 0)
  const entries = Object.entries(counts).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
      {entries.map(([label, value]) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: colors[label] ?? '#606060', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: '#A0A0A0', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
            {label}
          </span>
          <span style={{ fontSize: 11, color: '#606060', fontFamily: 'JetBrains Mono, monospace', marginLeft: 'auto', paddingLeft: 8 }}>
            {total > 0 ? Math.round((value / total) * 100) : 0}%
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProgrammeReviewPage() {
  const { canUseAI, aiUsesLabel, recordAIUse } = usePremium()
  const [programmes, setProgs]         = useState<Programme[]>([])
  const [selectedId, setSelectedId]    = useState<string>('')
  const [context, setContext]          = useState('')
  const [showContext, setShowContext]   = useState(false)
  const [review, setReview]            = useState('')
  const [loading, setLoading]          = useState(false)
  const [error, setError]              = useState<string | null>(null)
  const [savedReports, setSavedReports] = useState<SavedReport[]>([])
  const [selectedReport, setSelectedReport] = useState<string>('') // id of report being viewed
  const [revampLoading, setRevampLoading] = useState(false)
  const [revampProgress, setRevampProgress] = useState(0)
  const [revampDone, setRevampDone]       = useState(false)
  const [revampError, setRevampError]     = useState<string | null>(null)
  const reviewRef                      = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([getProgrammes(), getSetting('current_programme_id'), getAIReports()])
      .then(([data, dbCurrentId, reports]) => {
        const list = data as Programme[]
        setProgs(list)
        const currentId = dbCurrentId ?? localStorage.getItem('lrr_current_programme_id')
        const match = list.find(p => p.id === currentId)
        setSelectedId(match?.id ?? list[0]?.id ?? '')
        setSavedReports(reports as SavedReport[])
      })
      .catch(() => {
        getProgrammes().then(data => {
          const list = data as Programme[]
          setProgs(list)
          const currentId = localStorage.getItem('lrr_current_programme_id')
          const match = list.find(p => p.id === currentId)
          setSelectedId(match?.id ?? list[0]?.id ?? '')
        }).catch(() => {})
        getAIReports().then(data => setSavedReports(data as SavedReport[])).catch(() => {})
      })
  }, [])

  const selectedProg = programmes.find(p => p.id === selectedId)

  async function handleGenerate() {
    if (!selectedProg) return
    if (!canUseAI()) {
      setError(`AI uses exhausted. ${FEATURES.UPGRADE_CTA}`)
      return
    }
    setLoading(true)
    setReview('')
    setSelectedReport('')
    setError(null)

    const programmeText = formatProgramme(selectedProg)
    let fullReview = ''

    try {
      const res = await fetch('/api/programme-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programmeText, context }),
      })

      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || 'Request failed')
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('No response stream')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        fullReview += chunk
        setReview(prev => prev + chunk)
        reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }

      // Auto-save completed report
      if (fullReview) {
        const report: SavedReport = {
          id: `report-${Date.now()}`,
          programmeName: selectedProg.name,
          date: new Date().toISOString(),
          review: fullReview,
        }
        setSavedReports(prev => [report, ...prev].slice(0, 10))
        setSelectedReport(report.id)
        upsertAIReport(report.id, report).catch(console.error)
        recordAIUse().catch(console.error)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function handleSelectReport(id: string) {
    const report = savedReports.find(r => r.id === id)
    if (!report) return
    setSelectedReport(id)
    setReview(report.review)
    setError(null)
    setTimeout(() => reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function handleDeleteReport(id: string) {
    setSavedReports(prev => prev.filter(r => r.id !== id))
    if (selectedReport === id) { setSelectedReport(''); setReview('') }
    deleteAIReport(id).catch(console.error)
  }

  async function handleRevamp() {
    if (!selectedProg || !review || revampLoading) return
    if (!canUseAI()) {
      setRevampError(`AI uses exhausted. ${FEATURES.UPGRADE_CTA}`)
      return
    }
    setRevampLoading(true)
    setRevampDone(false)
    setRevampError(null)
    setRevampProgress(0)

    // Build pace map and segment value map from the existing programme's stored run rows
    const paceMap:     Record<string, string> = {}
    const segValueMap: Record<string, string> = {}
    for (const cell of Object.values(selectedProg.cells)) {
      for (const row of (cell.template.runRows ?? []) as RunSegment[]) {
        if (row.segmentType) {
          if (row.pace  && !paceMap[row.segmentType])     paceMap[row.segmentType]     = row.pace
          if (row.value && !segValueMap[row.segmentType]) segValueMap[row.segmentType] = row.value
        }
      }
    }

    try {
      const res = await fetch('/api/revamp-programme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programme: selectedProg, review }),
      })
      if (!res.ok) throw new Error((await res.text()) || 'Request failed')

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('No response stream')

      const EXPECTED_CHARS = 18000
      let raw = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        raw += decoder.decode(value, { stream: true })
        setRevampProgress(Math.min(90, Math.round((raw.length / EXPECTED_CHARS) * 90)))
      }
      setRevampProgress(95)

      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Could not parse AI response — please try again')
      const data = JSON.parse(jsonMatch[0])

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
            const dayNum = parseInt(dayKey.replace('d', '')) - 1
            const cellKey = `w${w - 1}d${dayNum}`
            cells[cellKey] = {
              rpe: isDeload ? Math.max(5, session.rpe - 2) : session.rpe,
              template: {
                id: `ai-${cellKey}-${ts}`,
                name: session.template.name + (isDeload ? ' (Deload)' : ''),
                type: session.template.type as 'lift' | 'run' | 'hike' | 'hybrid',
                exerciseRows: (session.template.exerciseRows ?? []).map((ex, ei) => ({
                  id: `ex-${cellKey}-${ei}`,
                  exerciseId: '',
                  exerciseName: ex.exerciseName,
                  category: ex.category ?? 'barbell',
                  sets: (ex.sets ?? []).map((s, si) => {
                    const base  = parseFloat(s.weight) || 0
                    const added = base > 0 ? Math.round((base + weekOffset * weightProgress) * liftMult / 2.5) * 2.5 : 0
                    return { id: `s-${cellKey}-${ei}-${si}`, reps: s.reps, weight: added > 0 ? String(added) : s.weight }
                  }),
                })),
                runRows: (session.template.runRows ?? []).map((r, ri) => {
                  // Fall back to original programme's value if AI returned empty
                  const baseVal = r.value || segValueMap[r.segmentType] || segValueMap['easy'] || '20'
                  let val = baseVal
                  if ((r.metric === 'time' || !r.metric) && r.segmentType === 'easy') {
                    const mins = (parseFloat(baseVal) || 20) + weekOffset * runProgress
                    val = String(Math.round(mins * runMult))
                  }
                  const pace = r.segmentType !== 'rest' ? (paceMap[r.segmentType] || paceMap['easy'] || undefined) : undefined
                  const metric = (r.metric as 'time' | 'distance') || 'time'
                  return { id: `run-${cellKey}-${ri}`, segmentType: r.segmentType, metric, value: val, ...(pace ? { pace } : {}) }
                }),
              },
            }
          }
        }
      }

      const revampedName = (data.name ?? `AI Coach Updated — ${selectedProg.name}`).startsWith('AI Coach')
        ? (data.name ?? `AI Coach Updated — ${selectedProg.name}`)
        : `AI Coach Updated — ${data.name ?? selectedProg.name}`

      const prog: Programme = {
        id: `prog-${Date.now()}`,
        name: revampedName,
        weeks: data.weeks ?? selectedProg.weeks,
        startDate: thisOrNextMonday(),
        cells,
      }

      setRevampProgress(100)
      await upsertProgramme(prog.id, prog)
      recordAIUse().catch(console.error)
      setRevampDone(true)
      setTimeout(() => { setRevampProgress(0); setRevampDone(false) }, 3000)
    } catch (err) {
      setRevampError((err as Error).message)
      setRevampProgress(0)
    } finally {
      setRevampLoading(false)
    }
  }

  return (
    <div style={{ background: '#0D0D0D', minHeight: '100vh' }}>
      <QuickLogFAB />

      {/* Header */}
      <div className="pt-16 pb-6" style={{ background: '#0A0A0A', borderBottom: '1px solid #1A1A1A' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#00BFA5', fontFamily: 'Inter, sans-serif' }}>AI Coach</p>
          <h1 className="text-5xl font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
            Programme Review
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
            Expert AI analysis of your training programme — evidence-based recommendations from an NSCA/UKSCA certified coaching perspective.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Programme selector */}
        <div className="rounded-xl p-5" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
          <label className="text-xs uppercase tracking-wider block mb-3" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
            Select Programme to Review
          </label>
          {programmes.length === 0 ? (
            <p className="text-sm" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
              No programmes found. Create one in the Programmes section first.
            </p>
          ) : (
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: '#242424', border: '1px solid #2E2E2E', color: '#F5F5F5', fontFamily: 'Inter, sans-serif' }}
            >
              {programmes.map(p => (
                <option key={p.id} value={p.id}>{p.name} — {p.weeks} weeks</option>
              ))}
            </select>
          )}
        </div>

        {/* Programme breakdown charts */}
        {selectedProg && (() => {
          const { ppl, body } = analyseProgramme(selectedProg)
          const hasPPL  = Object.values(ppl).some(v => v > 0)
          const hasBody = Object.values(body).some(v => v > 0)
          if (!hasPPL && !hasBody) return null
          return (
            <div className="rounded-xl p-5" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
              <p className="text-xs uppercase tracking-wider mb-4" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Programme Breakdown</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {hasPPL && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <DonutChart counts={ppl} colors={PPL_COLORS} size={90} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#A0A0A0', fontFamily: 'Montserrat, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Push / Pull / Legs</p>
                      <ChartLegend counts={ppl} colors={PPL_COLORS} />
                    </div>
                  </div>
                )}
                {hasBody && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <DonutChart counts={body} colors={BODY_COLORS} size={90} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#A0A0A0', fontFamily: 'Montserrat, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Body Part Split</p>
                      <ChartLegend counts={body} colors={BODY_COLORS} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Previous reports */}
        {savedReports.length > 0 && (
          <div className="rounded-xl p-5" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
            <label className="text-xs uppercase tracking-wider block mb-3" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
              <Clock size={11} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
              Previous AI Coach Reports
            </label>
            <div className="flex gap-2">
              <select
                value={selectedReport}
                onChange={e => handleSelectReport(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: '#242424', border: '1px solid #2E2E2E', color: selectedReport ? '#F5F5F5' : '#606060', fontFamily: 'Inter, sans-serif' }}
              >
                <option value="">— select a saved report —</option>
                {savedReports.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.programmeName} · {new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </option>
                ))}
              </select>
              {selectedReport && (
                <button
                  onClick={() => handleDeleteReport(selectedReport)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: '#C8102E18', border: '1px solid #C8102E44', color: '#C8102E', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}

        {/* Additional context (optional) */}
        <div className="rounded-xl overflow-hidden" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
          <button
            onClick={() => setShowContext(!showContext)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: '#F5F5F5', fontFamily: 'Inter, sans-serif' }}>Additional Context <span style={{ color: '#606060', fontWeight: 400 }}>(optional but recommended)</span></p>
              <p className="text-xs mt-0.5" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Goals, age, bodyweight, injuries, 1RMs, race times, sleep, nutrition</p>
            </div>
            {showContext ? <ChevronUp size={16} style={{ color: '#606060' }} /> : <ChevronDown size={16} style={{ color: '#606060' }} />}
          </button>
          {showContext && (
            <div className="px-5 pb-5">
              <textarea
                value={context}
                onChange={e => setContext(e.target.value)}
                placeholder={`e.g. Goal: run a sub-4hr marathon in 16 weeks\nAge: 32, Bodyweight: 82kg, Training age: 3 years\nCurrent 1RMs: Squat 120kg, Bench 90kg, Deadlift 160kg\nRecent 5K: 24:30 | Recent half marathon: 2:05\nSleep: 7hrs avg | No current injuries\nNutrition: ~3000 kcal/day, ~180g protein`}
                rows={7}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                style={{ background: '#242424', border: '1px solid #2E2E2E', color: '#F5F5F5', fontFamily: 'Inter, sans-serif', lineHeight: '1.6' }}
              />
            </div>
          )}
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={loading || !selectedProg}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-opacity"
          style={{
            background: loading || !selectedProg ? '#1A1A1A' : '#00BFA5',
            color: loading || !selectedProg ? '#3E3E3E' : '#0D0D0D',
            fontFamily: 'Montserrat, sans-serif',
            cursor: loading || !selectedProg ? 'not-allowed' : 'pointer',
          }}
        >
          <Sparkles size={16} />
          {loading ? 'Generating Review…' : 'Generate AI Review'}
        </button>
        {aiUsesLabel() && !loading && (
          <p style={{ textAlign: 'center', fontSize: '11px', color: '#606060', marginTop: '6px', fontFamily: 'Inter, sans-serif' }}>{aiUsesLabel()}</p>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ background: '#C8102E18', border: '1px solid #C8102E44' }}>
            <AlertCircle size={16} style={{ color: '#C8102E', flexShrink: 0, marginTop: 2 }} />
            <p className="text-sm" style={{ color: '#C8102E', fontFamily: 'Inter, sans-serif' }}>{error}</p>
          </div>
        )}

        {/* Review output */}
        {(review || loading) && (
          <div className="rounded-xl p-6" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
            <div className="flex items-center gap-2 mb-4 pb-4" style={{ borderBottom: '1px solid #2E2E2E' }}>
              <Sparkles size={14} style={{ color: '#00BFA5' }} />
              <span className="text-xs uppercase tracking-widest" style={{ color: '#00BFA5', fontFamily: 'Inter, sans-serif' }}>AI Coach Review</span>
              {loading
                ? <span className="text-xs ml-auto" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Analysing…</span>
                : selectedReport && (() => { const r = savedReports.find(x => x.id === selectedReport); return r ? <span className="text-xs ml-auto" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>{r.programmeName} · {new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span> : null })()
              }
            </div>
            <MarkdownBlock text={review} />
            {loading && (
              <span className="inline-block w-2 h-4 ml-1 animate-pulse" style={{ background: '#00BFA5', borderRadius: 2 }} />
            )}
            <div ref={reviewRef} />
          </div>
        )}

        {/* Revamp button — shown once review is complete */}
        {review && !loading && (
          <div>
            <button
              onClick={handleRevamp}
              disabled={revampLoading || revampDone}
              style={{
                width: '100%', padding: '16px', borderRadius: '14px', border: 'none',
                background: revampDone ? '#14532D' : revampLoading ? '#1A1527' : '#7C3AED',
                color: revampDone ? '#4ADE80' : revampLoading ? '#6B7280' : '#F5F5F5',
                fontWeight: 800, fontSize: '15px', fontFamily: 'Montserrat, sans-serif',
                cursor: revampLoading || revampDone ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'all 0.2s',
              }}
            >
              {revampDone
                ? <><span style={{ fontSize: '16px' }}>✓</span> Programme Saved — AI Coach Updated</>
                : revampLoading
                ? <><Sparkles size={16} style={{ animation: 'spin 1s linear infinite' }} /> Building revamped programme…</>
                : <><Sparkles size={16} /> Revamp Programme Based on AI Review</>
              }
            </button>
            {revampLoading && (
              <div style={{ width: '100%', height: '4px', background: '#1A1527', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${revampProgress}%`, background: 'linear-gradient(90deg, #7C3AED, #A78BFA)', borderRadius: '2px', transition: 'width 0.4s ease' }} />
              </div>
            )}
            {revampError && (
              <p style={{ marginTop: '8px', fontSize: '13px', color: '#C8102E', textAlign: 'center' }}>{revampError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
