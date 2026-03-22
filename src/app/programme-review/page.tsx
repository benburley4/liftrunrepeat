'use client'

import { useState, useEffect, useRef } from 'react'
import { Sparkles, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import QuickLogFAB from '@/components/log/QuickLogFAB'
import { getProgrammes } from '@/lib/db'

// ─── Types (mirrored from programmes page) ────────────────────────────────────

interface SetRow  { reps: string; weight: string }
interface ExRow   { exerciseName: string; sets: SetRow[] }
interface RunSegment { segmentType: string; metric: string; value: string; pace?: string }
interface RepeatBlock { kind: 'repeat'; count: string; laps: RunSegment[] }
type RunEntry = RunSegment | RepeatBlock

interface StoredTemplate {
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
  cells: Record<string, CellData>
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// ─── Format programme into readable text for AI ───────────────────────────────

function formatProgramme(prog: Programme): string {
  const lines: string[] = []
  lines.push(`Programme: ${prog.name}`)
  lines.push(`Duration: ${prog.weeks} weeks`)
  lines.push(`Start date: ${prog.startDate}`)
  lines.push('')

  // Find the typical weekly schedule (use week 1 as representative)
  lines.push('Weekly Schedule (Week 1 as representative):')
  for (let d = 0; d < 7; d++) {
    const key = `w0d${d}`
    const cell = prog.cells[key]
    if (!cell) {
      lines.push(`  ${DAYS[d]}: Rest`)
      continue
    }
    const t = cell.template
    lines.push(`  ${DAYS[d]}: ${t.name} (${t.type})${cell.rpe ? ` — RPE ${cell.rpe}` : ''}`)

    if (t.exerciseRows?.length) {
      for (const ex of t.exerciseRows) {
        const setStr = ex.sets
          .filter(s => s.reps || s.weight)
          .map(s => `${s.reps || '?'} reps${s.weight ? ` @ ${s.weight}kg` : ''}`)
          .join(', ')
        lines.push(`    • ${ex.exerciseName}${setStr ? `: ${setStr}` : ''}`)
      }
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

  // Check if there are variations across weeks
  const hasVariations = prog.weeks > 1 && Object.keys(prog.cells).some(k => k.startsWith('w1'))
  if (hasVariations) {
    lines.push('')
    lines.push('Note: Programme has week-by-week variations across ' + prog.weeks + ' weeks.')
  }

  return lines.join('\n')
}

// ─── Simple markdown renderer ─────────────────────────────────────────────────

function MarkdownBlock({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(
        <h3 key={i} className="text-base font-bold mt-6 mb-2" style={{ color: '#00BFA5', fontFamily: 'Montserrat, sans-serif' }}>
          {line.replace(/\*\*/g, '')}
        </h3>
      )
    } else if (line.startsWith('### ')) {
      elements.push(
        <h4 key={i} className="text-sm font-bold mt-4 mb-1" style={{ color: '#F5F5F5', fontFamily: 'Montserrat, sans-serif' }}>
          {line.slice(4)}
        </h4>
      )
    } else if (line.match(/^\d+\.\s/)) {
      elements.push(
        <div key={i} className="flex gap-2 mb-1">
          <span className="text-xs font-bold mt-0.5 flex-shrink-0" style={{ color: '#C8102E', fontFamily: 'JetBrains Mono, monospace' }}>
            {line.match(/^(\d+)\./)?.[1]}.
          </span>
          <span className="text-sm leading-relaxed" style={{ color: '#D0D0D0', fontFamily: 'Inter, sans-serif' }}>
            {renderInline(line.replace(/^\d+\.\s/, ''))}
          </span>
        </div>
      )
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      elements.push(
        <div key={i} className="flex gap-2 mb-1 ml-2">
          <span className="flex-shrink-0 mt-2" style={{ width: 4, height: 4, borderRadius: '50%', background: '#00BFA5', display: 'inline-block' }} />
          <span className="text-sm leading-relaxed" style={{ color: '#D0D0D0', fontFamily: 'Inter, sans-serif' }}>
            {renderInline(line.slice(2))}
          </span>
        </div>
      )
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />)
    } else {
      elements.push(
        <p key={i} className="text-sm leading-relaxed mb-1" style={{ color: '#D0D0D0', fontFamily: 'Inter, sans-serif' }}>
          {renderInline(line)}
        </p>
      )
    }
    i++
  }

  return <div>{elements}</div>
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} style={{ color: '#F5F5F5' }}>{part.slice(2, -2)}</strong>
      : part
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProgrammeReviewPage() {
  const [programmes, setProgs]       = useState<Programme[]>([])
  const [selectedId, setSelectedId]  = useState<string>('')
  const [context, setContext]        = useState('')
  const [showContext, setShowContext] = useState(false)
  const [review, setReview]          = useState('')
  const [loading, setLoading]        = useState(false)
  const [error, setError]            = useState<string | null>(null)
  const reviewRef                    = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getProgrammes()
      .then(data => {
        const list = data as Programme[]
        setProgs(list)
        const currentId = localStorage.getItem('lrr_current_programme_id')
        const match = list.find(p => p.id === currentId)
        setSelectedId(match?.id ?? list[0]?.id ?? '')
      })
      .catch(() => {})
  }, [])

  const selectedProg = programmes.find(p => p.id === selectedId)

  async function handleGenerate() {
    if (!selectedProg) return
    setLoading(true)
    setReview('')
    setError(null)

    const programmeText = formatProgramme(selectedProg)

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
        setReview(prev => prev + decoder.decode(value))
        reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
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
              {loading && <span className="text-xs ml-auto" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Analysing…</span>}
            </div>
            <MarkdownBlock text={review} />
            {loading && (
              <span className="inline-block w-2 h-4 ml-1 animate-pulse" style={{ background: '#00BFA5', borderRadius: 2 }} />
            )}
            <div ref={reviewRef} />
          </div>
        )}
      </div>
    </div>
  )
}
