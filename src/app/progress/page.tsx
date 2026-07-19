'use client'

import { useState, useEffect, useMemo, Fragment } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, ReferenceLine,
} from 'recharts'
import { Trophy, TrendingUp, Zap, Activity, ChevronLeft, ChevronRight, ChevronDown, Pencil, Check, X, Trash2, Sparkles } from 'lucide-react'
import { getSessions, upsertSession, deleteSession as dbDeleteSession, getCoachReports, saveCoachReport, deleteCoachReport, getSetting, upsertSetting, CoachReport } from '@/lib/db'
import { epleyRM, classifyPPL, classifyBody } from '@/lib/computeStats'
import { isBodyweightExercise, resolveBodyweightPct, getBwOverrides, type BwOverrides } from '@/lib/bodyweight'
import type { SessionData as SavedSession, ActualSet, LoggedExercise, LoggedRunSegment, LoggedRepeat, LoggedRunEntry } from '@/lib/computeStats'
import ConsistencyHeatmap from '@/components/ui/ConsistencyHeatmap'
import QuickLogFAB from '@/components/log/QuickLogFAB'

type TabId = 'overview' | 'ai-coach' | 'prs' | 'history' | 'strength' | 'running' | 'hybrid'

const chartTooltipStyle = {
  contentStyle: { background: '#242424', border: '1px solid #2E2E2E', borderRadius: '8px', fontFamily: 'var(--font-sans)' },
  labelStyle: { color: '#F5F5F5', fontSize: 11 },
  itemStyle: { fontSize: 11 },
}

const sessionTypeColor: Record<string, string> = {
  lift: '#00BFA5',
  run: '#C8102E',
  hybrid: '#A78BFA',
}

function RunRow({ lap, editing, onUpdate }: {
  lap: LoggedRunSegment
  editing: boolean
  onUpdate: (field: 'actualValue' | 'actualPace', value: string) => void
}) {
  const unit = lap.metric === 'distance' ? 'km' : lap.metric === 'time' ? 'min' : ''
  const showPace = lap.metric === 'distance' || lap.metric === 'time'
  return (
    <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
      <span className="text-xs font-semibold capitalize px-2 py-0.5 rounded flex-shrink-0"
        style={{ background: '#C8102E20', color: '#C8102E', fontFamily: 'var(--font-sans)' }}>{lap.segmentType}</span>
      {lap.plannedValue && (
        <span className="text-xs flex-shrink-0" style={{ color: '#3E3E3E', fontFamily: 'var(--font-mono)' }}>
          {lap.plannedValue}{unit ? ' ' + unit : ''}{lap.plannedPace ? ` @ ${lap.plannedPace}/km` : ''} →
        </span>
      )}
      <div className="flex items-center gap-1 flex-shrink-0">
        {editing ? (
          <input type={lap.metric === 'time' ? 'text' : 'number'} value={lap.actualValue}
            onChange={e => onUpdate('actualValue', e.target.value)}
            className="w-16 text-center py-1.5 rounded text-xs outline-none"
            style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #00BFA544', fontFamily: 'var(--font-mono)' }} />
        ) : (
          <span className="text-sm font-semibold" style={{ color: lap.actualValue ? '#F5F5F5' : '#3E3E3E', fontFamily: 'var(--font-mono)' }}>
            {lap.actualValue || '—'}
          </span>
        )}
        {unit && <span className="text-xs" style={{ color: '#606060' }}>{unit}</span>}
      </div>
      {showPace && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {editing ? (
            <input type="text" value={lap.actualPace} onChange={e => onUpdate('actualPace', e.target.value)}
              placeholder="5:30" className="w-16 text-center py-1.5 rounded text-xs outline-none"
              style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #00BFA544', fontFamily: 'var(--font-mono)' }} />
          ) : (
            <span className="text-sm font-semibold" style={{ color: lap.actualPace ? '#F5F5F5' : '#3E3E3E', fontFamily: 'var(--font-mono)' }}>
              {lap.actualPace || '—'}
            </span>
          )}
          <span className="text-xs" style={{ color: '#606060' }}>/km</span>
        </div>
      )}
    </div>
  )
}

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [hoveredLine, setHoveredLine] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [history, setHistory] = useState<SavedSession[]>([])
  const [selected, setSelected] = useState<SavedSession | null>(null)
  const [editing, setEditing] = useState(false)
  const [editSession, setEditSession] = useState<SavedSession | null>(null)
  const [aiCoachText, setAiCoachText] = useState('')
  const [pastReports, setPastReports] = useState<CoachReport[]>([])
  const [displayedReportWeek, setDisplayedReportWeek] = useState<string | null>(null)
  const [expandedReport, setExpandedReport] = useState<string | null>(null)
  const [expandedReportMonth, setExpandedReportMonth] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [historySubTab, setHistorySubTab] = useState<'sessions' | 'exercises'>('sessions')
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [exerciseFilter, setExerciseFilter] = useState<string>('All')
  const [bodyweight, setBodyweight] = useState(75)
  const [bwOverrides, setBwOverrides] = useState<BwOverrides>({})

  useEffect(() => {
    getSetting('bodyweight_kg').then(v => { const n = parseFloat(v ?? ''); if (!isNaN(n) && n > 0) setBodyweight(n) }).catch(() => {})
    getBwOverrides().then(setBwOverrides).catch(() => {})
  }, [])

  // Persist only on commit (blur/Enter), clamped to a sane range so a stray
  // keystroke can't save an absurd bodyweight that skews every estimate.
  function commitBodyweight(v: number) {
    const clamped = isNaN(v) ? 95 : Math.min(250, Math.max(30, v))
    setBodyweight(clamped)
    upsertSetting('bodyweight_kg', String(clamped)).catch(() => {})
  }

  useEffect(() => {
    if (activeTab === 'ai-coach') loadPastReports()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  useEffect(() => {
    getSessions().then(raw => {
      const sessions = raw as unknown as SavedSession[]
      // Deduplicate by date+name, keeping the latest savedAt for each.
      // This collapses re-saves of the same session (e.g. after page refresh)
      // while still allowing two differently-named sessions on the same day.
      const seen = new Map<string, SavedSession>()
      for (const s of sessions) {
        const key = `${s.date}|${(s.name ?? '').toLowerCase().trim()}`
        const existing = seen.get(key)
        if (!existing || s.savedAt > existing.savedAt) seen.set(key, s)
      }
      setHistory(Array.from(seen.values()))
    }).catch(console.error)
  }, [])

  const strengthData = useMemo(() => {
    function weekStart(dateStr: string): string {
      const d = new Date(dateStr + 'T00:00:00')
      const day = d.getDay()
      d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
      return d.toISOString().split('T')[0]
    }
    function fmtWeek(iso: string) {
      return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    const liftSessions = history.filter(s => (s.exercises ?? []).length > 0)
    if (liftSessions.length === 0) return null

    // Last 12 week-start Mondays
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const weeks: string[] = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() - (11 - i) * 7)
      const day = d.getDay()
      d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
      return d.toISOString().split('T')[0]
    })

    // Sessions grouped by week-start
    const byWeek: Record<string, SavedSession[]> = {}
    for (const s of liftSessions) {
      const wk = weekStart(s.date)
      ;(byWeek[wk] ??= []).push(s)
    }

    // Build per-exercise stats (used for both chart and PRs)
    const exStats: Record<string, { totalSets: number; rm: number; weight: number; reps: number; date: string }> = {}
    for (const s of liftSessions)
      for (const ex of s.exercises ?? [])
        for (const set of ex.actualSets) {
          const w = parseFloat(set.weight), r = parseInt(set.reps)
          const key = ex.exerciseName
          if (!exStats[key]) exStats[key] = { totalSets: 0, rm: 0, weight: 0, reps: 0, date: s.date }
          exStats[key].totalSets++
          if (!isNaN(w) && !isNaN(r) && r > 0) {
            const rm = epleyRM(w, r)
            if (rm > exStats[key].rm) exStats[key] = { ...exStats[key], rm, weight: w, reps: r, date: s.date }
          }
        }

    // Top 5 exercises by total sets for the 1RM trend chart
    const topExercises = Object.entries(exStats)
      .sort((a, b) => b[1].totalSets - a[1].totalSets)
      .slice(0, 5)
      .map(([name]) => name)

    // Weekly chart rows
    const weeklyData = weeks.map(wk => {
      const sessions = byWeek[wk] ?? []
      const volume = sessions.flatMap(s => s.exercises ?? []).flatMap(ex => ex.actualSets)
        .reduce((sum, set) => sum + (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0), 0)
      const row: Record<string, string | number> = { week: fmtWeek(wk), volume: Math.round(volume) }
      for (const exName of topExercises) {
        let maxRM = 0
        for (const s of sessions)
          for (const ex of s.exercises ?? [])
            if (ex.exerciseName === exName)
              for (const set of ex.actualSets) {
                const w = parseFloat(set.weight), r = parseInt(set.reps)
                if (!isNaN(w) && !isNaN(r) && r > 0) maxRM = Math.max(maxRM, epleyRM(w, r))
              }
        row[exName] = maxRM || 0
      }
      return row
    })
    const prs = Object.entries(exStats)
      .filter(([, v]) => v.rm > 0)
      .sort((a, b) => b[1].date.localeCompare(a[1].date))
      .map(([exercise, { totalSets, rm, weight, reps, date }]) => ({
        exercise,
        totalSets,
        pr: `${weight} kg`,
        rm: `${rm} kg est. 1RM`,
        sets: `${reps} reps`,
        date: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      }))

    return { weeklyData, topExercises, prs }
  }, [history])

  // Per-exercise RM table + charts. Estimates are bodyweight- and RPE-aware:
  //   • Bodyweight moves (pull-up, dip, nordic…) use load = bodyweight + added weight.
  //   • RPE is read as reps-in-reserve (RIR = 10 − RPE) so a submaximal set predicts a
  //     higher true 1RM via Epley on (reps + RIR).
  // Missing logged reps are interpolated between logged points; out-of-range reps are
  // extrapolated along the prediction curve (both rendered in italics).
  const exerciseAnalysis = useMemo(() => {
    const epley = (load: number, effReps: number) => (effReps <= 1 ? load : load * (1 + effReps / 30))

    // Phase 1: gather every raw set per exercise (keep zero-weight sets — they are
    // the signal that an exercise is bodyweight).
    type RawSet = { reps: number; weight: number; rpe: number; date: string }
    const byExercise: Record<string, RawSet[]> = {}
    for (const s of history)
      for (const ex of s.exercises ?? [])
        for (const set of ex.actualSets) {
          const r = parseInt(set.reps)
          if (isNaN(r) || r <= 0) continue
          ;(byExercise[ex.exerciseName] ??= []).push({ reps: r, weight: parseFloat(set.weight), rpe: parseFloat(set.rpe), date: s.date })
        }

    const REPS = Array.from({ length: 12 }, (_, i) => i + 1)
    const dayIdx = (d: string) => Math.round(new Date(d + 'T00:00:00').getTime() / 86400000)
    const todayIdx = Math.round(Date.now() / 86400000)

    return Object.entries(byExercise).map(([name, raws]) => {
      const category = classifyPPL(name)

      // Phase 2: decide if this is a bodyweight movement — library/name match, or
      // a majority of sets logged at zero/empty weight (e.g. Walking Lunge @ 0).
      const zeroCount = raws.filter(x => isNaN(x.weight) || x.weight <= 0).length
      const bodyweightBased = isBodyweightExercise(name) || zeroCount / raws.length >= 0.5
      const pct = resolveBodyweightPct(name, bwOverrides)
      const frac = pct / 100

      // Build loaded sets: bodyweight → bodyweight×frac + added; else the logged weight.
      const sets = raws.flatMap(x => {
        const added = isNaN(x.weight) ? 0 : Math.max(0, x.weight)
        const load = bodyweightBased ? bodyweight * frac + added : x.weight
        if (isNaN(load) || load <= 0) return []
        const rir = !isNaN(x.rpe) && x.rpe > 0 && x.rpe < 10 ? Math.max(0, 10 - x.rpe) : 0
        return [{ reps: x.reps, load, date: x.date, est1RM: epley(load, x.reps + rir) }]
      })
      if (sets.length === 0) return null

      // Best estimated 1RM and the set (rep count + session) that produced it
      let best = sets[0]
      for (const s of sets) if (s.est1RM > best.est1RM) best = s
      const best1RM = best.est1RM

      // Epley inverse: predicted load for N reps taken to failure (1RM row = the 1RM)
      const predicted = (n: number) => (n === 1 ? best1RM : best1RM / (1 + n / 30))

      // Best actual logged load per rep count, with the date it was logged
      const anchorMap: Record<number, { load: number; date: string }> = {}
      for (const s of sets) {
        const a = anchorMap[s.reps]
        if (!a || s.load > a.load) anchorMap[s.reps] = { load: s.load, date: s.date }
      }
      const anchorReps = Object.keys(anchorMap).map(Number).sort((a, b) => a - b)
      const realReps = anchorReps.length

      const rows = REPS.map(n => {
        const predWeight = Math.round(predicted(n))
        const anchor = anchorMap[n]
        if (anchor)
          return { rep: n, predicted: predWeight, logged: Math.round(anchor.load), loggedDate: anchor.date as string | null, loggedKind: 'actual' as const }

        const lower = [...anchorReps].reverse().find(r => r < n)
        const higher = anchorReps.find(r => r > n)
        let logged: number | null = null
        let loggedKind: 'interp' | 'extrap' = 'interp'
        if (lower !== undefined && higher !== undefined) {
          const wl = anchorMap[lower].load, wh = anchorMap[higher].load
          logged = wl + (wh - wl) * ((n - lower) / (higher - lower))
          loggedKind = 'interp'
        } else {
          const nearest = lower ?? higher
          if (nearest !== undefined) {
            logged = anchorMap[nearest].load * (predicted(n) / predicted(nearest))
            loggedKind = 'extrap'
          }
        }
        return { rep: n, predicted: predWeight, logged: logged === null ? null : Math.round(logged), loggedDate: null as string | null, loggedKind }
      })

      // Est. 1RM progression: best est. 1RM per session date, chronological
      const byDate: Record<string, number> = {}
      const volByDate: Record<string, number> = {}
      for (const s of sets) {
        byDate[s.date] = Math.max(byDate[s.date] ?? 0, s.est1RM)
        volByDate[s.date] = (volByDate[s.date] ?? 0) + s.load * s.reps
      }
      const trendRaw = Object.entries(byDate)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, e1rm]) => ({ date, e1rm: Math.round(e1rm) }))

      // Linear regression (least squares) of e1RM vs day index → trendline fit
      let trend = trendRaw.map(t => ({ ...t, fit: null as number | null }))
      if (trendRaw.length >= 2) {
        const xs = trendRaw.map(t => dayIdx(t.date))
        const ys = trendRaw.map(t => t.e1rm)
        const x0 = xs[0]
        const n = xs.length
        const sx = xs.reduce((a, x) => a + (x - x0), 0)
        const sy = ys.reduce((a, y) => a + y, 0)
        const sxx = xs.reduce((a, x) => a + (x - x0) ** 2, 0)
        const sxy = xs.reduce((a, x, i) => a + (x - x0) * ys[i], 0)
        const denom = n * sxx - sx * sx
        const slope = denom !== 0 ? (n * sxy - sx * sy) / denom : 0
        const intercept = (sy - slope * sx) / n
        trend = trendRaw.map((t, i) => ({ ...t, fit: Math.round(intercept + slope * (xs[i] - x0)) }))
      }
      const volumeTrend = Object.entries(volByDate)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, volume]) => ({ date, volume: Math.round(volume) }))

      // Recency / frequency
      const firstDate = trendRaw[0]?.date ?? best.date
      const lastDate = trendRaw.length ? trendRaw[trendRaw.length - 1].date : best.date
      const daysSince = todayIdx - dayIdx(lastDate)
      const spanWeeks = Math.max(1, (dayIdx(lastDate) - dayIdx(firstDate)) / 7)
      const setsPerWeek = Math.round((sets.length / spanWeeks) * 10) / 10
      const stale = daysSince > 21

      // Progression: gain over the window, PR, plateau
      const prValue = Math.max(...trendRaw.map(t => t.e1rm))
      const prDate = trendRaw.find(t => t.e1rm === prValue)?.date ?? lastDate
      let pctGain: number | null = null, gainWeeks = 0
      if (trendRaw.length >= 2) {
        const lastIdx = dayIdx(lastDate)
        // earliest point still within ~8 weeks of the latest, else the very first point
        const base = trendRaw.find(t => lastIdx - dayIdx(t.date) <= 56) ?? trendRaw[0]
        if (base && base.e1rm > 0 && base.date !== lastDate) {
          pctGain = Math.round(((trendRaw[trendRaw.length - 1].e1rm - base.e1rm) / base.e1rm) * 1000) / 10
          gainWeeks = Math.round((lastIdx - dayIdx(base.date)) / 7)
        }
      }
      const plateau = trendRaw.length >= 3 && (dayIdx(lastDate) - dayIdx(prDate)) >= 28

      // Strength curve: predicted vs best-logged across reps (logged null = gap)
      const curve = rows.map(r => ({ rep: r.rep, predicted: r.predicted, logged: r.logged }))

      return {
        name, category, bodyweightBased, bwPct: Math.round(pct),
        totalSets: sets.length, realReps,
        best1RM: Math.round(best1RM), sourceReps: best.reps, sourceDate: best.date,
        firstDate, lastDate, daysSince, setsPerWeek, stale,
        prValue, prDate, pctGain, gainWeeks, plateau,
        rows, trend, curve, volumeTrend,
      }
    }).filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => b.totalSets - a.totalSets)
  }, [history, bodyweight, bwOverrides])

  function openSession(s: SavedSession) {
    setSelected(s); setEditing(false); setEditSession(null)
  }

  function startEdit() {
    setEditSession(JSON.parse(JSON.stringify(selected))); setEditing(true)
  }

  async function saveEdit() {
    if (!editSession) return
    const next = history.map(s => s.savedAt === editSession.savedAt ? editSession : s)
    await upsertSession(editSession).catch(console.error)
    setHistory(next); setSelected(editSession); setEditing(false); setEditSession(null)
  }

  function cancelEdit() {
    setEditing(false); setEditSession(null)
  }

  function currentWeekEnding(): string {
    const d = new Date(); d.setHours(0, 0, 0, 0)
    const day = d.getDay()
    d.setDate(d.getDate() - day) // go back to last Sunday
    return d.toISOString().split('T')[0]
  }

  async function loadPastReports() {
    try {
      const reports = await getCoachReports()
      const sorted = [...reports].sort((a, b) => b.weekEnding.localeCompare(a.weekEnding))
      setPastReports(sorted)
      // Show the most recent report in the main slot as long as it's ≤7 days old
      const newest = sorted[0]
      if (newest && !aiCoachText) {
        const now = new Date(); now.setHours(0, 0, 0, 0)
        const ageDays = Math.floor((now.getTime() - new Date(newest.weekEnding + 'T00:00:00').getTime()) / 86400000)
        if (ageDays <= 7) {
          setAiCoachText(newest.reportText)
          setDisplayedReportWeek(newest.weekEnding)
        }
      }
    } catch { /* table may not exist yet */ }
  }


  function renderAICoachText(text: string) {
    const sections = text.split(/^##\s+/m).filter(Boolean)
    return sections.map((section, idx) => {
      const lines = section.split('\n')
      const title = lines[0].trim()
      const body = lines.slice(1).join('\n').trim()
      const isRecs = /RECOMMENDATION/i.test(title)
      const bulletColor = isRecs ? '#C084FC' : '#00BFA5'
      const borderColor = isRecs ? 'rgba(167,139,250,0.2)' : '#2E2E2E'
      const titleColor = isRecs ? '#A78BFA' : '#606060'
      const bullets = body.split('\n').filter(l => l.trim()).map((l, i) => {
        const content = l.replace(/^[-•*]\s*/, '').trim()
        if (!content) return null
        const parts = content.split(/\*\*(.*?)\*\*/g)
        return (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: bulletColor, flexShrink: 0, marginTop: 6 }} />
            <p style={{ color: '#A0A0A0', fontSize: 13, lineHeight: 1.6, fontFamily: 'var(--font-sans)', margin: 0 }}>
              {parts.map((p, pi) => pi % 2 === 1
                ? <strong key={pi} style={{ color: '#F5F5F5', fontWeight: 600 }}>{p}</strong>
                : p
              )}
            </p>
          </div>
        )
      })
      return (
        <div key={idx} className="rounded-xl p-5" style={{ background: '#1A1A1A', border: `1px solid ${borderColor}` }}>
          <p className="text-xs font-black uppercase mb-3" style={{ color: titleColor, fontFamily: 'var(--font-heading)', letterSpacing: '0.08em' }}>{title}</p>
          <div>{bullets}</div>
        </div>
      )
    })
  }

  async function handleDeleteReport(id: string) {
    await deleteCoachReport(id).catch(console.error)
    setPastReports(prev => prev.filter(r => r.id !== id))
    if (expandedReport === id) setExpandedReport(null)
  }

  async function deleteSession(savedAt: string) {
    await dbDeleteSession(savedAt).catch(console.error)
    const next = history.filter(s => s.savedAt !== savedAt)
    setHistory(next)
    if (selected?.savedAt === savedAt) { setSelected(null); setEditing(false); setEditSession(null) }
  }

  function updateEditSet(exId: string, si: number, field: keyof ActualSet, value: string) {
    if (!editSession) return
    setEditSession({ ...editSession, exercises: editSession.exercises?.map(ex => ex.id !== exId ? ex : {
      ...ex, actualSets: ex.actualSets.map((s, i) => i === si ? { ...s, [field]: value } : s)
    }) })
  }

  function updateEditRun(entryIdx: number, field: 'actualValue' | 'actualPace', value: string, lapIdx?: number) {
    if (!editSession) return
    setEditSession({ ...editSession, run: editSession.run?.map((entry, i) => {
      if (i !== entryIdx) return entry
      if ('kind' in entry && entry.kind === 'repeat' && lapIdx !== undefined) {
        return { ...entry, laps: entry.laps.map((lap, li) => li === lapIdx ? { ...lap, [field]: value } : lap) }
      }
      return { ...entry, [field]: value }
    }) })
  }

  const overviewStats = useMemo(() => {
    function segKm(seg: LoggedRunSegment): number {
      if (seg.metric === 'distance') return parseFloat(seg.actualValue) || 0
      if (seg.metric === 'time' && seg.actualPace) {
        const [m, sc] = seg.actualPace.split(':').map(Number)
        const paceMin = m + (sc || 0) / 60
        return paceMin > 0 ? (parseFloat(seg.actualValue) || 0) / paceMin : 0
      }
      return 0
    }

    const now = new Date(); now.setHours(0, 0, 0, 0)
    const dow = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() + (dow === 0 ? -6 : 1 - dow))
    const lastMonday = new Date(monday); lastMonday.setDate(monday.getDate() - 7)

    const thisWeek = history.filter(s => new Date(s.date + 'T00:00:00') >= monday)
    const lastWeek = history.filter(s => {
      const d = new Date(s.date + 'T00:00:00'); return d >= lastMonday && d < monday
    })

    const sessionsThisWeek = thisWeek.length
    const sessionsLastWeek = lastWeek.length
    const sessionDiff = sessionsThisWeek - sessionsLastWeek

    const kmThisWeek = thisWeek.reduce((sum, s) => {
      const runKm = (s.run ?? []).reduce((rs, entry) => {
        if ('kind' in entry && entry.kind === 'repeat')
          return rs + entry.laps.reduce((ls, l) => ls + segKm(l), 0) * (parseInt(entry.count) || 1)
        return rs + segKm(entry as LoggedRunSegment)
      }, 0)
      return sum + runKm + (s.hikeKm ?? 0) + (s.hikeElevationM ?? 0) / 100
    }, 0)

    const totalVolume = history.reduce((sum, s) =>
      sum + (s.exercises ?? []).reduce((es, ex) =>
        es + ex.actualSets.reduce((ss, set) =>
          ss + (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0), 0), 0), 0)

    // ── Readiness score: personalised, history-aware ──────────────────────────
    function sessionLoad(s: SavedSession) {
      const liftLoad = (s.exercises ?? []).reduce((sum, ex) =>
        sum + ex.actualSets.reduce((ss, set) =>
          ss + (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0), 0), 0) / 1000
      const runLoad = (s.run ?? []).reduce((rs, entry) => {
        if ('kind' in entry && entry.kind === 'repeat')
          return rs + entry.laps.reduce((ls, l) => ls + segKm(l), 0) * (parseInt(entry.count) || 1)
        return rs + segKm(entry as LoggedRunSegment)
      }, 0)
      const elevEquiv = (s.hikeElevationM ?? 0) / 100
      return liftLoad + runLoad + (s.hikeKm ?? 0) + elevEquiv
    }
    function sessionLiftLoad(s: SavedSession) {
      return (s.exercises ?? []).reduce((sum, ex) =>
        sum + ex.actualSets.reduce((ss, set) =>
          ss + (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0), 0), 0) / 1000
    }
    function wkStart(dateStr: string) {
      const d = new Date(dateStr + 'T00:00:00'); const day = d.getDay()
      d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); return d.toISOString().split('T')[0]
    }

    // Group all history by week
    const byWeek: Record<string, { total: number; lift: number; run: number }> = {}
    for (const s of history) {
      const wk = wkStart(s.date)
      if (!byWeek[wk]) byWeek[wk] = { total: 0, lift: 0, run: 0 }
      const load = sessionLoad(s); const liftL = sessionLiftLoad(s)
      byWeek[wk].total += load; byWeek[wk].lift += liftL; byWeek[wk].run += load - liftL
    }
    const allWeekLoads = Object.values(byWeek)
    const personalWeeklyAvg = allWeekLoads.length > 0
      ? allWeekLoads.reduce((s, w) => s + w.total, 0) / allWeekLoads.length : 0

    const thisWk = wkStart(now.toISOString().split('T')[0])
    const lastWkDate = new Date(now); lastWkDate.setDate(now.getDate() - 7)
    const lastWk = wkStart(lastWkDate.toISOString().split('T')[0])
    const thisWeekLoad = byWeek[thisWk]?.total ?? 0
    const lastWeekLoad = byWeek[lastWk]?.total ?? 0

    const sevenDaysAgo  = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7)
    const fourWeeksAgo  = new Date(now); fourWeeksAgo.setDate(now.getDate() - 28)
    const recent7  = history.filter(s => new Date(s.date + 'T00:00:00') >= sevenDaysAgo)
    const recent28 = history.filter(s => new Date(s.date + 'T00:00:00') >= fourWeeksAgo)

    const tsbFactors: { name: string; points: number }[] = []

    // 1. Personalised base score — centred on their own average, not a fixed 50
    let score = personalWeeklyAvg > 0
      ? Math.round(65 - ((thisWeekLoad / personalWeeklyAvg) - 1) * 30)
      : history.length === 0 ? 75 : 65

    // 2. Consistency bonus — sustained training builds resilience (max +10)
    const weeksActive = allWeekLoads.filter(w => w.total > 0).length
    const consistencyBonus = Math.min(10, Math.floor(weeksActive / 2))
    score += consistencyBonus
    if (consistencyBonus > 0) tsbFactors.push({ name: 'Consistency', points: consistencyBonus })

    // 3. Days since last session — rest genuinely helps (max +15)
    const lastSessionDate = [...history].sort((a, b) => b.date.localeCompare(a.date))[0]?.date
    const daysSinceLast = lastSessionDate
      ? Math.floor((now.getTime() - new Date(lastSessionDate + 'T00:00:00').getTime()) / 86400000)
      : 0
    const restBonus = daysSinceLast > 0 ? Math.min(15, daysSinceLast * 4) : 0
    score += restBonus
    if (restBonus > 0) tsbFactors.push({ name: `${daysSinceLast}d rest`, points: restBonus })

    // 4. Ramp rate — spike in volume signals injury risk
    let overtrained = false
    if (lastWeekLoad > 0) {
      const ramp = (thisWeekLoad - lastWeekLoad) / lastWeekLoad
      if (ramp > 0.1) {
        const rampPenalty = -Math.round(Math.min(15, ramp * 30))
        score += rampPenalty
        tsbFactors.push({ name: 'Volume spike', points: rampPenalty })
        if (ramp > 0.3) overtrained = true
      } else if (ramp < -0.1) {
        score += 5
        tsbFactors.push({ name: 'Deload week', points: 5 })
      }
    }

    // 5. Cross-sport balance bonus — reward balanced weeks, not specialised ones
    const recentLiftTotal = recent7.reduce((s, sess) => s + sessionLiftLoad(sess), 0)
    const recentTotal = recent7.reduce((s, sess) => s + sessionLoad(sess), 0)
    const liftRatio = recentTotal > 0 ? recentLiftTotal / recentTotal : 0.5
    if (liftRatio >= 0.3 && liftRatio <= 0.7) {
      score += 5
      tsbFactors.push({ name: 'Balanced training', points: 5 })
    }

    // Clamp
    const tsb = Math.max(0, Math.min(100, score))

    // 6. Trend indicator vs last week's approximate readiness
    const lastWeekScore = personalWeeklyAvg > 0
      ? Math.round(65 - ((lastWeekLoad / personalWeeklyAvg) - 1) * 30)
      : 65
    const readinessTrend = tsb > lastWeekScore + 3 ? '↑' : tsb < lastWeekScore - 3 ? '↓' : '→'

    // 7. Positive labels
    const readinessLabel = tsb >= 80 ? 'Peak readiness — go for it'
      : tsb >= 65 ? 'Ready to perform'
      : tsb >= 45 ? 'Building fitness — keep it steady'
      : 'Hard week — well earned rest'

    return {
      sessionsThisWeek,
      sessionDiff,
      kmThisWeek: Math.round(kmThisWeek * 10) / 10,
      totalVolume: Math.round(totalVolume),
      tsb,
      tsbFactors,
      overtrained,
      readinessLabel,
      readinessTrend,
    }
  }, [history])

  // ── Progress: last 4 weeks vs previous 4, from actual training history ──────
  const progressStats = useMemo(() => {
    function segKm(seg: LoggedRunSegment): number {
      if (seg.metric === 'distance') return parseFloat(seg.actualValue) || 0
      if (seg.metric === 'time' && seg.actualPace) {
        const [m, sc] = seg.actualPace.split(':').map(Number)
        const paceMin = m + (sc || 0) / 60
        return paceMin > 0 ? (parseFloat(seg.actualValue) || 0) / paceMin : 0
      }
      return 0
    }
    function sessionKm(s: SavedSession): number {
      return (s.run ?? []).reduce((rs, entry) => {
        if ('kind' in entry && entry.kind === 'repeat')
          return rs + entry.laps.reduce((ls, l) => ls + segKm(l), 0) * (parseInt(entry.count) || 1)
        return rs + segKm(entry as LoggedRunSegment)
      }, 0) + (s.hikeKm ?? 0)
    }
    function sessionVolume(s: SavedSession): number {
      return (s.exercises ?? []).reduce((es, ex) =>
        es + ex.actualSets.reduce((ss, set) =>
          ss + (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0), 0), 0)
    }

    const now = new Date(); now.setHours(0, 0, 0, 0)
    const cut4 = new Date(now); cut4.setDate(now.getDate() - 28)
    const cut8 = new Date(now); cut8.setDate(now.getDate() - 56)
    const recent = history.filter(s => new Date(s.date + 'T00:00:00') >= cut4)
    const previous = history.filter(s => {
      const d = new Date(s.date + 'T00:00:00'); return d >= cut8 && d < cut4
    })
    if (previous.length === 0) return null // not enough history to compare yet

    const sum = (arr: SavedSession[], f: (s: SavedSession) => number) => arr.reduce((a, s) => a + f(s), 0)
    const recentVol = sum(recent, sessionVolume)
    const prevVol = sum(previous, sessionVolume)
    const recentKm = sum(recent, sessionKm)
    const prevKm = sum(previous, sessionKm)

    const pct = (cur: number, prev: number) => prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null

    // Best estimated 1RM per exercise in each window; keep the most-trained
    // exercises that appear in both windows so the comparison is meaningful.
    function bestRMs(arr: SavedSession[]): Record<string, { rm: number; sets: number }> {
      const out: Record<string, { rm: number; sets: number }> = {}
      for (const s of arr) {
        for (const ex of s.exercises ?? []) {
          const name = (ex.exerciseName || '').trim()
          if (!name) continue
          for (const set of ex.actualSets) {
            const w = parseFloat(set.weight), r = parseInt(set.reps)
            if (isNaN(w) || isNaN(r) || w <= 0 || r <= 0) continue
            const entry = (out[name] ??= { rm: 0, sets: 0 })
            entry.rm = Math.max(entry.rm, epleyRM(w, r))
            entry.sets++
          }
        }
      }
      return out
    }
    const recentRMs = bestRMs(recent)
    const prevRMs = bestRMs(previous)
    const lifts = Object.keys(recentRMs)
      .filter(name => prevRMs[name])
      .sort((a, b) => (recentRMs[b].sets + prevRMs[b].sets) - (recentRMs[a].sets + prevRMs[a].sets))
      .slice(0, 3)
      .map(name => ({
        name,
        from: Math.round(prevRMs[name].rm),
        to: Math.round(recentRMs[name].rm),
        pct: pct(recentRMs[name].rm, prevRMs[name].rm),
      }))

    return {
      sessions: { from: previous.length, to: recent.length },
      volume: { from: Math.round(prevVol), to: Math.round(recentVol), pct: pct(recentVol, prevVol) },
      km: { from: Math.round(prevKm * 10) / 10, to: Math.round(recentKm * 10) / 10, pct: pct(recentKm, prevKm) },
      lifts,
    }
  }, [history])

  const runningData = useMemo(() => {
    function segKm(seg: LoggedRunSegment): number {
      if (seg.metric === 'distance') return parseFloat(seg.actualValue) || 0
      if (seg.metric === 'time' && seg.actualPace) {
        const [m, sc] = seg.actualPace.split(':').map(Number)
        const paceMin = m + (sc || 0) / 60
        return paceMin > 0 ? (parseFloat(seg.actualValue) || 0) / paceMin : 0
      }
      return 0
    }
    function sessionKm(s: SavedSession): number {
      return (s.run ?? []).reduce((rs, entry) => {
        if ('kind' in entry && entry.kind === 'repeat')
          return rs + entry.laps.reduce((ls, l) => ls + segKm(l), 0) * (parseInt(entry.count) || 1)
        return rs + segKm(entry as LoggedRunSegment)
      }, 0)
    }
    function weekStart(dateStr: string): string {
      const d = new Date(dateStr + 'T00:00:00')
      const day = d.getDay()
      d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
      return d.toISOString().split('T')[0]
    }
    function fmtWeek(iso: string) {
      return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    const runSessions = history.filter(s => (s.run ?? []).length > 0)
    if (runSessions.length === 0) return null

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const weeks: string[] = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() - (11 - i) * 7)
      const day = d.getDay()
      d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
      return d.toISOString().split('T')[0]
    })
    const byWeek: Record<string, SavedSession[]> = {}
    for (const s of runSessions) { const wk = weekStart(s.date); (byWeek[wk] ??= []).push(s) }

    const weeklyKm = weeks.map(wk => ({
      week: fmtWeek(wk),
      km: Math.round(byWeek[wk]?.reduce((sum, s) => sum + sessionKm(s), 0) ?? 0),
    }))

    // Run type mix from all segment types
    const typeCounts: Record<string, number> = {}
    for (const s of runSessions)
      for (const entry of s.run ?? []) {
        if ('kind' in entry && entry.kind === 'repeat') {
          for (const lap of entry.laps) typeCounts[lap.segmentType] = (typeCounts[lap.segmentType] ?? 0) + segKm(lap) * (parseInt(entry.count) || 1)
        } else {
          const seg = entry as LoggedRunSegment
          typeCounts[seg.segmentType] = (typeCounts[seg.segmentType] ?? 0) + segKm(seg)
        }
      }
    const TYPE_COLORS: Record<string, string> = { easy: '#4CAF50', tempo: '#F59E0B', long: '#00BFA5', interval: '#EF4444', recovery: '#60A5FA', warmup: '#A78BFA', cooldown: '#A78BFA', hills: '#F97316', rest: '#606060' }

    function buildTypeMix(sessions: SavedSession[]) {
      const counts: Record<string, number> = {}
      for (const s of sessions)
        for (const entry of s.run ?? []) {
          if ('kind' in entry && entry.kind === 'repeat') {
            for (const lap of entry.laps) counts[lap.segmentType] = (counts[lap.segmentType] ?? 0) + segKm(lap) * (parseInt(entry.count) || 1)
          } else {
            const seg = entry as LoggedRunSegment
            counts[seg.segmentType] = (counts[seg.segmentType] ?? 0) + segKm(seg)
          }
        }
      const total = Object.values(counts).reduce((a, b) => a + b, 0)
      if (total === 0) return []
      return Object.entries(counts)
        .map(([name, km]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value: Math.round((km / total) * 100), color: TYPE_COLORS[name] ?? '#606060' }))
        .filter(d => d.value > 0).sort((a, b) => b.value - a.value)
    }

    const now = new Date()
    const thisMonth = runSessions.filter(s => { const d = new Date(s.date + 'T00:00:00'); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() })
    const thisYear  = runSessions.filter(s => new Date(s.date + 'T00:00:00').getFullYear() === now.getFullYear())

    return { weeklyKm, runTypeMix: buildTypeMix(runSessions), runTypeMixMonth: buildTypeMix(thisMonth), runTypeMixYear: buildTypeMix(thisYear) }
  }, [history])

  // ─── Session breakdown: PPL + body part from actual logged exercises ──────
  const sessionBreakdown = useMemo(() => {
    const ppl:  Record<string, number> = { Push: 0, Pull: 0, Legs: 0, Core: 0, Cardio: 0 }
    const body: Record<string, number> = { Chest: 0, Back: 0, Shoulders: 0, Legs: 0, Arms: 0, Core: 0, Cardio: 0 }

    for (const s of history) {
      if (s.type === 'run' || s.type === 'hike') {
        ppl.Cardio  += 3
        body.Cardio += 3
        continue
      }
      for (const ex of s.exercises ?? []) {
        const sets = (ex.actualSets?.length || ex.plannedSets?.length || 0)
        if (sets === 0) continue
        const p = classifyPPL(ex.exerciseName)
        const b = classifyBody(ex.exerciseName)
        ppl[p]  = (ppl[p]  || 0) + sets
        body[b] = (body[b] || 0) + sets
      }
      // hybrid: count run component too
      if (s.type === 'hybrid' && (s.run ?? []).length > 0) {
        ppl.Cardio  += 2
        body.Cardio += 2
      }
    }

    const PPL_COLORS:  Record<string, string> = { Push: '#C8102E', Pull: '#00BFA5', Legs: '#A78BFA', Core: '#FF9500', Cardio: '#3B82F6' }
    const BODY_COLORS: Record<string, string> = { Chest: '#C8102E', Back: '#00BFA5', Shoulders: '#FF9500', Legs: '#A78BFA', Arms: '#F472B6', Core: '#6B7280', Cardio: '#3B82F6' }

    function toSlices(counts: Record<string, number>, colors: Record<string, string>) {
      return Object.entries(counts)
        .filter(([, v]) => v > 0)
        .sort(([, a], [, b]) => b - a)
        .map(([label, value]) => ({ label, value, color: colors[label] ?? '#606060' }))
    }

    return {
      pplSlices:  toSlices(ppl,  PPL_COLORS),
      bodySlices: toSlices(body, BODY_COLORS),
      hasData: Object.values(ppl).some(v => v > 0),
    }
  }, [history])

  const hybridData = useMemo(() => {
    function segKm(seg: LoggedRunSegment): number {
      if (seg.metric === 'distance') return parseFloat(seg.actualValue) || 0
      if (seg.metric === 'time' && seg.actualPace) {
        const [m, sc] = seg.actualPace.split(':').map(Number)
        const paceMin = m + (sc || 0) / 60
        return paceMin > 0 ? (parseFloat(seg.actualValue) || 0) / paceMin : 0
      }
      return 0
    }
    function weekStart(dateStr: string): string {
      const d = new Date(dateStr + 'T00:00:00')
      const day = d.getDay()
      d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
      return d.toISOString().split('T')[0]
    }
    function fmtWeek(iso: string) {
      return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    if (history.length === 0) return null

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const weeks: string[] = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() - (11 - i) * 7)
      const day = d.getDay()
      d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
      return d.toISOString().split('T')[0]
    })
    const byWeek: Record<string, SavedSession[]> = {}
    for (const s of history) { const wk = weekStart(s.date); (byWeek[wk] ??= []).push(s) }

    const weeklyChart = weeks.map(wk => {
      const sessions = byWeek[wk] ?? []
      const km = Math.round(sessions.reduce((sum, s) => sum + (s.run ?? []).reduce((rs, entry) => {
        if ('kind' in entry && entry.kind === 'repeat')
          return rs + entry.laps.reduce((ls, l) => ls + segKm(l), 0) * (parseInt(entry.count) || 1)
        return rs + segKm(entry as LoggedRunSegment)
      }, 0), 0))
      const volume = Math.round(sessions.reduce((sum, s) =>
        sum + (s.exercises ?? []).reduce((es, ex) =>
          es + ex.actualSets.reduce((ss, set) =>
            ss + (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0), 0), 0), 0) / 100) // scale to hundreds
      return { week: fmtWeek(wk), km, volume }
    })

    // Balance: proportion of lift vs run sessions
    const liftCount = history.filter(s => (s.exercises ?? []).length > 0).length
    const runCount = history.filter(s => (s.run ?? []).length > 0).length
    const total = liftCount + runCount || 1
    const liftPct = Math.round((liftCount / total) * 100)
    const runPct = 100 - liftPct

    return { weeklyChart, liftPct, runPct }
  }, [history])

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'ai-coach', label: 'Weekly Review' },
    { id: 'prs', label: 'Personal Records' },
    { id: 'history', label: 'History' },
    { id: 'strength', label: 'Strength' },
    { id: 'running', label: 'Running' },
    { id: 'hybrid', label: 'Hybrid' },
  ]

  return (
    <div style={{ background: '#0D0D0D', minHeight: '100vh' }}>
      <QuickLogFAB />

      {/* Header */}
      <div className="pt-16 pb-6" style={{ background: '#0A0A0A', borderBottom: '1px solid #1A1A1A' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#00BFA5' }}>Dashboard</p>
          <h1 className="text-5xl font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>
            Progress
          </h1>
        </div>
      </div>

      {/* Overview strip */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            {
              label: 'Sessions This Week',
              value: String(overviewStats.sessionsThisWeek),
              sub: overviewStats.sessionDiff === 0 ? 'same as last week' : `${overviewStats.sessionDiff > 0 ? '+' : ''}${overviewStats.sessionDiff} from last week`,
              accent: '#F5F5F5', icon: Activity,
            },
            {
              label: 'Km This Week',
              value: String(overviewStats.kmThisWeek || 0),
              sub: 'km run',
              accent: '#C8102E', icon: TrendingUp,
            },
            {
              label: 'Total Volume',
              value: overviewStats.totalVolume >= 1000 ? `${(overviewStats.totalVolume / 1000).toFixed(1)}k` : String(overviewStats.totalVolume),
              sub: 'kg lifted all time',
              accent: '#00BFA5', icon: Zap,
            },
            {
              label: 'Readiness Score',
              value: `${overviewStats.tsb}% ${overviewStats.readinessTrend}`,
              sub: overviewStats.readinessLabel,
              accent: overviewStats.tsb >= 65 ? '#00BFA5' : overviewStats.tsb >= 45 ? '#F59E0B' : '#C8102E', icon: Trophy,
            },
          ].map(({ label, value, sub, accent, icon: Icon }) => (
            <div
              key={label}
              className="rounded-xl p-4"
              style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider" style={{ color: '#606060' }}>{label}</span>
                <Icon size={14} style={{ color: accent }} />
              </div>
              <div className="text-2xl font-bold" style={{ color: accent, fontFamily: 'var(--font-mono)' }}>
                {value}
              </div>
              <div className="text-xs mt-1" style={{ color: '#606060' }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Progress panel — last 4 weeks vs previous 4, from real history */}
        {progressStats && (
          <div className="rounded-xl p-5 mb-6" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp size={14} style={{ color: '#00BFA5' }} />
                <span className="text-sm font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>Your Progress</span>
              </div>
              <span className="text-xs" style={{ color: '#606060' }}>Last 4 weeks vs previous 4</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-1">
              {[
                { label: 'Lift Volume', from: `${(progressStats.volume.from / 1000).toFixed(1)}t`, to: `${(progressStats.volume.to / 1000).toFixed(1)}t`, pct: progressStats.volume.pct, accent: '#00BFA5' },
                { label: 'Running + Hiking', from: `${progressStats.km.from} km`, to: `${progressStats.km.to} km`, pct: progressStats.km.pct, accent: '#C8102E' },
                { label: 'Sessions', from: String(progressStats.sessions.from), to: String(progressStats.sessions.to), pct: progressStats.sessions.from > 0 ? Math.round(((progressStats.sessions.to - progressStats.sessions.from) / progressStats.sessions.from) * 100) : null, accent: '#A78BFA' },
              ].map(({ label, from, to, pct, accent }) => (
                <div key={label} className="rounded-lg px-4 py-3" style={{ background: '#141414', border: '1px solid #2E2E2E' }}>
                  <p className="text-xs uppercase tracking-wider mb-1.5" style={{ color: '#606060' }}>{label}</p>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-xs" style={{ color: '#606060', fontFamily: 'var(--font-mono)' }}>{from} →</span>
                    <span className="text-lg font-bold" style={{ color: accent, fontFamily: 'var(--font-mono)' }}>{to}</span>
                    {pct !== null && pct !== 0 && (
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{
                        background: pct > 0 ? 'rgba(0,191,165,0.12)' : 'rgba(200,16,46,0.12)',
                        color: pct > 0 ? '#00BFA5' : '#C8102E',
                        fontFamily: 'var(--font-mono)',
                      }}>{pct > 0 ? '+' : ''}{pct}%</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {progressStats.lifts.length > 0 && (
              <div className="mt-3">
                <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#606060' }}>Estimated 1RM — most-trained lifts</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {progressStats.lifts.map(l => (
                    <div key={l.name} className="rounded-lg px-4 py-3 flex items-center justify-between gap-2" style={{ background: '#141414', border: '1px solid #2E2E2E' }}>
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: '#F5F5F5', fontFamily: 'var(--font-sans)' }}>{l.name}</p>
                        <p className="text-xs" style={{ color: '#606060', fontFamily: 'var(--font-mono)' }}>{l.from} → {l.to} kg</p>
                      </div>
                      {l.pct !== null && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0" style={{
                          background: l.pct > 0 ? 'rgba(0,191,165,0.12)' : l.pct < 0 ? 'rgba(200,16,46,0.12)' : '#1E1E1E',
                          color: l.pct > 0 ? '#00BFA5' : l.pct < 0 ? '#C8102E' : '#606060',
                          fontFamily: 'var(--font-mono)',
                        }}>{l.pct > 0 ? '+' : ''}{l.pct}%</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Overtraining warning */}
        {overviewStats.overtrained && (
          <div className="rounded-xl px-5 py-3 flex items-center gap-3 mb-2"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <span style={{ fontSize: 18 }}>⚠</span>
            <div>
              <span className="text-sm font-bold" style={{ color: '#EF4444', fontFamily: 'var(--font-heading)' }}>HIGH LOAD WARNING</span>
              <span className="text-xs ml-2" style={{ color: '#A0A0A0' }}>This week&apos;s volume is &gt;30% above last week — injury risk is elevated. Consider dropping 1–2 sessions or reducing intensity.</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="sticky top-16 z-30" style={{ background: 'rgba(13,13,13,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1A1A1A' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="analytics-tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-4 py-4 text-sm font-medium transition-colors relative"
                style={{ color: activeTab === tab.id ? '#F5F5F5' : '#606060', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: '#00BFA5' }} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            {/* PR Banner — most recent lift PR */}
            {strengthData && strengthData.prs.length > 0 && (() => {
              const latest = strengthData.prs[0]
              return (
                <div
                  className="rounded-xl px-5 py-4 flex items-center gap-3"
                  style={{ background: 'rgba(200,16,46,0.08)', border: '1px solid rgba(200,16,46,0.2)' }}
                >
                  <Trophy size={20} style={{ color: '#C8102E' }} />
                  <div>
                    <span className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)', fontSize: '16px' }}>
                      BEST LIFT:
                    </span>
                    <span className="text-sm ml-2" style={{ color: '#F5F5F5' }}>{latest.exercise} — {latest.pr}</span>
                    <span className="text-xs ml-2" style={{ color: '#606060' }}>{latest.date} · {latest.rm.replace(' est. 1RM', '')} est. 1RM</span>
                  </div>
                  <div
                    className="ml-auto px-2 py-1 rounded text-xs font-bold"
                    style={{ background: '#C8102E', color: '#0D0D0D' }}
                  >
                    PR
                  </div>
                </div>
              )
            })()}

            {/* Readiness factor breakdown */}
            {overviewStats.tsbFactors.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#606060', fontFamily: 'var(--font-heading)' }}>
                  Readiness Breakdown — {overviewStats.tsb}%
                </p>
                <div className="flex flex-wrap gap-2">
                  {overviewStats.tsbFactors.map(f => (
                    <div key={f.name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                      style={{ background: f.points > 0 ? 'rgba(0,191,165,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${f.points > 0 ? 'rgba(0,191,165,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                      <span className="text-xs font-semibold" style={{ color: f.points > 0 ? '#00BFA5' : '#EF4444', fontFamily: 'var(--font-mono)' }}>
                        {f.points > 0 ? `+${f.points}` : f.points}
                      </span>
                      <span className="text-xs" style={{ color: '#A0A0A0', fontFamily: 'var(--font-sans)' }}>{f.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Heatmap + breakdown charts */}
            <div className="rounded-xl p-5" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
              <h3 className="text-xl font-black uppercase mb-4" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>
                Training Consistency — Last 6 Months
              </h3>
              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 0', minWidth: 0 }}>
                  <ConsistencyHeatmap sessions={history} />
                </div>
                {sessionBreakdown.hasData && (() => {
                  function MiniDonut({ slices, size = 80 }: { slices: { label: string; value: number; color: string }[]; size?: number }) {
                    const total = slices.reduce((s, d) => s + d.value, 0)
                    if (total === 0) return null
                    const cx = size / 2, cy = size / 2, r = size / 2 - 2, hole = r * 0.52
                    let angle = -Math.PI / 2
                    const paths = slices.map((d, i) => {
                      const sweep = (d.value / total) * 2 * Math.PI
                      if (sweep >= 2 * Math.PI - 0.001) return <circle key={i} cx={cx} cy={cy} r={r} fill={d.color} />
                      const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle)
                      angle += sweep
                      const x2 = cx + r * Math.cos(angle), y2 = cy + r * Math.sin(angle)
                      return <path key={i} d={`M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${sweep > Math.PI ? 1 : 0},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`} fill={d.color} />
                    })
                    return (
                      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                        {paths}<circle cx={cx} cy={cy} r={hole} fill="#1A1A1A" />
                      </svg>
                    )
                  }
                  function Legend({ slices }: { slices: { label: string; value: number; color: string }[] }) {
                    const total = slices.reduce((s, d) => s + d.value, 0)
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {slices.map(d => (
                          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: '#A0A0A0', fontFamily: 'var(--font-sans)', flex: 1 }}>{d.label}</span>
                            <span style={{ fontSize: 11, color: '#606060', fontFamily: 'var(--font-mono)', paddingLeft: 6 }}>
                              {Math.round((d.value / total) * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )
                  }
                  return (
                    <div style={{ display: 'flex', flexDirection: 'row', gap: 32, flexShrink: 0, alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#A0A0A0', fontFamily: 'var(--font-heading)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Push / Pull / Legs</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <MiniDonut slices={sessionBreakdown.pplSlices} size={120} />
                          <Legend slices={sessionBreakdown.pplSlices} />
                        </div>
                      </div>
                      <div style={{ borderLeft: '1px solid #2E2E2E', paddingLeft: 32 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#A0A0A0', fontFamily: 'var(--font-heading)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Body Part Split</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <MiniDonut slices={sessionBreakdown.bodySlices} size={120} />
                          <Legend slices={sessionBreakdown.bodySlices} />
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Recent sessions — last 7 days from history */}
            {(() => {
              const sevenDaysAgo = new Date()
              sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
              sevenDaysAgo.setHours(0, 0, 0, 0)
              const recent = history
                .filter(s => new Date(s.date) >= sevenDaysAgo)
                .sort((a, b) => b.date.localeCompare(a.date))
              if (recent.length === 0) return null
              return (
                <div className="rounded-xl overflow-hidden" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                  <div className="px-5 py-4" style={{ borderBottom: '1px solid #2E2E2E' }}>
                    <h3 className="text-xl font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>
                      Recent Sessions
                    </h3>
                  </div>
                  {recent.map((s, i) => {
                    const col = sessionTypeColor[s.type] ?? '#606060'
                    const dateLabel = new Date(s.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                    return (
                      <div key={s.savedAt} className="px-5 py-4 flex items-center gap-4"
                        style={{ borderBottom: i < recent.length - 1 ? '1px solid #2E2E2E' : 'none' }}>
                        <div className="w-2 h-10 rounded-full flex-shrink-0" style={{ background: col }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold uppercase" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>{s.name}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#606060' }}>{dateLabel}</p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                          style={{ background: `${col}22`, color: col, fontFamily: 'var(--font-sans)' }}>
                          {s.type}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            })()}

          </>
        )}

        {/* PRs TAB */}
        {activeTab === 'prs' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Lift PRs */}
            <div className="rounded-xl overflow-hidden" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
              <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #2E2E2E', background: '#242424' }}>
                <div className="w-2 h-2 rounded-full" style={{ background: '#00BFA5' }} />
                <h3 className="text-base font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>Lift</h3>
              </div>
              {!strengthData || strengthData.prs.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>No lift data yet.</p>
                </div>
              ) : (
                <div>
                  {strengthData.prs.map((row, i, arr) => (
                    <div key={row.exercise} className="px-5 py-4"
                      style={{ borderBottom: i < arr.length - 1 ? '1px solid #2E2E2E' : 'none' }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-bold uppercase" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>{row.exercise}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#242424', color: '#606060', fontFamily: 'var(--font-mono)' }}>{row.totalSets} sets</span>
                          <span className="text-xs" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>{row.date}</span>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1 rounded-lg px-3 py-2" style={{ background: '#242424' }}>
                          <p className="text-xs mb-0.5" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>Heaviest Set</p>
                          <p className="text-sm font-bold" style={{ color: '#00BFA5', fontFamily: 'var(--font-mono)' }}>{row.pr} × {row.sets}</p>
                        </div>
                        <div className="flex-1 rounded-lg px-3 py-2" style={{ background: '#242424' }}>
                          <p className="text-xs mb-0.5" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>Est. 1RM</p>
                          <p className="text-sm font-bold" style={{ color: '#A78BFA', fontFamily: 'var(--font-mono)' }}>{row.rm.replace(' est. 1RM', '')}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Run PRs */}
            <div className="rounded-xl overflow-hidden" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
              <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #2E2E2E', background: '#242424' }}>
                <div className="w-2 h-2 rounded-full" style={{ background: '#C8102E' }} />
                <h3 className="text-base font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>Run</h3>
              </div>
              {(() => {
                const KEY_DISTANCES = [
                  { label: '1K',           km: 1,       tol: 0.15 },
                  { label: '1.6 km',       km: 1.6,     tol: 0.2  },
                  { label: '5 km',         km: 5,       tol: 0.6  },
                  { label: '10 km',        km: 10,      tol: 1.0  },
                  { label: 'Half Marathon',km: 21.0975, tol: 1.5  },
                  { label: 'Marathon',     km: 42.195,  tol: 2.5  },
                ]

                function fmtTime(totalSecs: number) {
                  const h = Math.floor(totalSecs / 3600)
                  const m = Math.floor((totalSecs % 3600) / 60)
                  const s = Math.round(totalSecs % 60)
                  return h > 0
                    ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
                    : `${m}:${String(s).padStart(2,'0')}`
                }

                // Collect all distance segments with pace
                type SegRecord = { km: number; paceSecs: number; pace: string; date: string }
                const allSegs: SegRecord[] = []
                let longestKm = 0, longestPace = '', longestDate = ''

                for (const s of history) {
                  const dateStr = new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  for (const entry of s.run ?? []) {
                    const segs = ('kind' in entry && entry.kind === 'repeat')
                      ? entry.laps.flatMap(l => Array(parseInt(entry.count) || 1).fill(l))
                      : [entry as LoggedRunSegment]
                    for (const seg of segs) {
                      if (seg.metric !== 'distance' || !seg.actualPace || !seg.actualValue) continue
                      const km = parseFloat(seg.actualValue)
                      if (!km) continue
                      const [pm, ps] = seg.actualPace.split(':').map(Number)
                      const paceSecs = (pm || 0) * 60 + (ps || 0)
                      if (!paceSecs) continue
                      allSegs.push({ km, paceSecs, pace: seg.actualPace, date: dateStr })
                      if (km > longestKm) { longestKm = km; longestPace = seg.actualPace; longestDate = dateStr }
                    }
                  }
                }

                if (allSegs.length === 0) return (
                  <div className="px-5 py-8 text-center">
                    <p className="text-sm" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>No run data yet.</p>
                  </div>
                )

                const rows: { label: string; pace: string; time: string; date: string }[] = []
                for (const kd of KEY_DISTANCES) {
                  const matches = allSegs.filter(r => Math.abs(r.km - kd.km) <= kd.tol)
                  if (matches.length === 0) continue
                  const best = matches.reduce((a, b) => a.paceSecs < b.paceSecs ? a : b)
                  const timeSecs = best.paceSecs * kd.km
                  rows.push({ label: kd.label, pace: `${best.pace}/km`, time: fmtTime(timeSecs), date: best.date })
                }
                if (longestKm > 0) {
                  const [pm, ps] = longestPace.split(':').map(Number)
                  const pSecs = (pm || 0) * 60 + (ps || 0)
                  rows.push({ label: `Longest (${longestKm % 1 === 0 ? longestKm : longestKm.toFixed(1)} km)`, pace: longestPace ? `${longestPace}/km` : '—', time: longestPace ? fmtTime(pSecs * longestKm) : '—', date: longestDate })
                }

                return (
                  <div>
                    {rows.map((row, i, arr) => (
                      <div key={row.label} className="px-5 py-4"
                        style={{ borderBottom: i < arr.length - 1 ? '1px solid #2E2E2E' : 'none' }}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-bold uppercase" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>{row.label}</p>
                          <p className="text-xs" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>{row.date}</p>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-1 rounded-lg px-3 py-2" style={{ background: '#242424' }}>
                            <p className="text-xs mb-0.5" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>Best Pace</p>
                            <p className="text-sm font-bold" style={{ color: '#C8102E', fontFamily: 'var(--font-mono)' }}>{row.pace}</p>
                          </div>
                          <div className="flex-1 rounded-lg px-3 py-2" style={{ background: '#242424' }}>
                            <p className="text-xs mb-0.5" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>Finish Time</p>
                            <p className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>{row.time}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {/* HISTORY — SUB-TAB TOGGLE */}
        {activeTab === 'history' && !selected && (
          <div className="flex gap-2">
            {(['sessions', 'exercises'] as const).map(v => (
              <button key={v} onClick={() => { setHistorySubTab(v); setSelectedExercise(null) }}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold capitalize"
                style={{
                  background: historySubTab === v ? '#00BFA5' : '#1A1A1A',
                  color: historySubTab === v ? '#0D0D0D' : '#606060',
                  border: `1px solid ${historySubTab === v ? '#00BFA5' : '#2E2E2E'}`,
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}>{v}</button>
            ))}
          </div>
        )}

        {activeTab === 'history' && !selected && historySubTab === 'sessions' && (
          <div className="rounded-xl overflow-hidden" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
            {history.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>No sessions logged yet.</p>
                <p className="text-xs" style={{ color: '#3E3E3E', fontFamily: 'var(--font-sans)' }}>Sessions saved in Log Session will appear here.</p>
              </div>
            ) : (() => {
              function segKm(seg: LoggedRunSegment): number {
                if (seg.metric === 'distance') return parseFloat(seg.actualValue) || 0
                if (seg.metric === 'time' && seg.actualPace) {
                  const [m, sc] = seg.actualPace.split(':').map(Number)
                  const paceMin = m + (sc || 0) / 60
                  return paceMin > 0 ? (parseFloat(seg.actualValue) || 0) / paceMin : 0
                }
                return 0
              }

              function renderSession(s: SavedSession, isLast: boolean) {
                const col = sessionTypeColor[s.type] ?? '#606060'
                const dateLabel = new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                const exercises = s.exercises ?? []
                const run = s.run ?? []
                const totalKm = run.reduce((sum, entry) => {
                  if ('kind' in entry && entry.kind === 'repeat')
                    return sum + entry.laps.reduce((s2, l) => s2 + segKm(l), 0) * (parseInt(entry.count) || 1)
                  return sum + segKm(entry as LoggedRunSegment)
                }, 0)
                return (
                  <div key={s.savedAt} onClick={() => openSession(s)} className="w-full text-left"
                    style={{ borderBottom: isLast ? 'none' : '1px solid #2E2E2E', background: 'transparent', cursor: 'pointer', display: 'block' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#1E1E1E')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div className="px-5 pt-4 pb-2 flex items-center gap-4">
                      <div className="w-2 h-full rounded-full flex-shrink-0 self-stretch" style={{ background: col, minHeight: '1.25rem' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold uppercase" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>{s.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>{dateLabel}</p>
                      </div>
                      {totalKm > 0 && (
                        <span className="text-sm font-bold flex-shrink-0" style={{ color: '#C8102E', fontFamily: 'var(--font-mono)' }}>
                          {totalKm % 1 === 0 ? totalKm : totalKm.toFixed(1)} km
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                        style={{ background: `${col}22`, color: col, fontFamily: 'var(--font-sans)' }}>{s.type}</span>
                      {confirmDeleteId === s.savedAt ? (
                        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                          <button onClick={() => { deleteSession(s.savedAt); setConfirmDeleteId(null) }}
                            className="px-2 py-1 rounded text-xs font-semibold"
                            style={{ background: '#C8102E', color: '#fff', cursor: 'pointer' }}>Delete</button>
                          <button onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 rounded text-xs"
                            style={{ background: '#2E2E2E', color: '#A0A0A0', cursor: 'pointer' }}>Cancel</button>
                        </div>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(s.savedAt) }}
                          className="flex-shrink-0 p-1.5 rounded-lg" style={{ color: '#3E3E3E', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#C8102E')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#3E3E3E')} title="Delete session">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    {exercises.length > 0 && (
                      <div className="px-5 pb-1 pl-11 space-y-0.5">
                        {exercises.map(ex => (
                          <div key={ex.id} className="flex items-center gap-2 text-xs min-w-0" style={{ fontFamily: 'var(--font-sans)' }}>
                            <span className="font-medium shrink-0" style={{ color: '#A0A0A0' }}>{ex.exerciseName}</span>
                            <span className="truncate text-right flex-1" style={{ color: '#606060', fontFamily: 'var(--font-mono)' }}>
                              {ex.actualSets.filter(s => s.reps || s.weight).map(s => `${s.reps}×${s.weight}kg`).join(', ') || `${ex.actualSets.length} sets`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {run.length > 0 && (
                      <div className="px-5 pb-1 pl-11 space-y-0.5">
                        {run.map((entry, ri) => {
                          if ('kind' in entry && entry.kind === 'repeat') return (
                            <div key={entry.id ?? ri} className="text-xs" style={{ fontFamily: 'var(--font-sans)' }}>
                              <span style={{ color: '#C8102E' }}>×{entry.count} </span>
                              <span style={{ color: '#606060' }}>{entry.laps.map(l => `${l.segmentType} ${l.actualValue}${l.metric === 'distance' ? 'km' : l.metric === 'time' ? 'min' : ''}`).join(' / ')}</span>
                            </div>
                          )
                          const seg = entry as LoggedRunSegment
                          return (
                            <div key={seg.id ?? ri} className="flex items-center justify-between text-xs" style={{ fontFamily: 'var(--font-sans)' }}>
                              <span className="capitalize" style={{ color: '#A0A0A0' }}>{seg.segmentType}</span>
                              <span style={{ color: '#606060', fontFamily: 'var(--font-mono)' }}>
                                {seg.actualValue}{seg.metric === 'distance' ? ' km' : seg.metric === 'time' ? ' min' : ''}{seg.actualPace ? ` @ ${seg.actualPace}/km` : ''}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <div className="pb-3" />
                  </div>
                )
              }

              // Current calendar year → group by month; previous year and older → group by year
              const currentYear = new Date().getFullYear()
              const groups: { key: string; label: string; sessions: SavedSession[] }[] = []
              const monthMap: Record<string, SavedSession[]> = {}
              const yearMap: Record<string, SavedSession[]> = {}

              for (const s of history) {
                const d = new Date(s.date + 'T00:00:00')
                if (d.getFullYear() === currentYear) {
                  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`
                  ;(monthMap[key] ??= []).push(s)
                } else {
                  const key = String(d.getFullYear())
                  ;(yearMap[key] ??= []).push(s)
                }
              }

              // Month groups (newest first)
              Object.keys(monthMap).sort((a, b) => b.localeCompare(a)).forEach(key => {
                const d = new Date(key + '-01T00:00:00')
                groups.push({ key, label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), sessions: monthMap[key] })
              })
              // Year groups (newest first)
              Object.keys(yearMap).sort((a, b) => b.localeCompare(a)).forEach(key => {
                groups.push({ key, label: key, sessions: yearMap[key] })
              })

              const getExpanded = (key: string) => expandedGroups.has(key)
              const toggle = (key: string) => setExpandedGroups(prev => {
                const next = new Set(prev)
                next.has(key) ? next.delete(key) : next.add(key)
                return next
              })

              return groups.map(group => (
                <div key={group.key} style={{ borderBottom: '1px solid #2E2E2E' }}>
                  <button onClick={() => toggle(group.key)}
                    className="w-full flex items-center justify-between px-5 py-3"
                    style={{ background: '#1A1A1A', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#222222')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#1A1A1A')}>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold uppercase" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>{group.label}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#2E2E2E', color: '#606060', fontFamily: 'var(--font-sans)' }}>{group.sessions.length}</span>
                    </div>
                    <ChevronDown size={16} style={{ color: '#606060', transform: getExpanded(group.key) ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </button>
                  {getExpanded(group.key) && (
                    <div>
                      {group.sessions.map((s, i) => renderSession(s, i === group.sessions.length - 1))}
                    </div>
                  )}
                </div>
              ))
            })()}
          </div>
        )}

        {/* HISTORY — EXERCISES SUB-TAB: GRID */}
        {activeTab === 'history' && !selected && historySubTab === 'exercises' && !selectedExercise && (
          exerciseAnalysis.length === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
              <p className="text-sm" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>No exercises logged yet.</p>
              <p className="text-xs mt-1" style={{ color: '#3E3E3E', fontFamily: 'var(--font-sans)' }}>Lifts saved in Log Session will appear here.</p>
            </div>
          ) : (() => {
            const CAT_COLORS: Record<string, string> = { Push: '#C8102E', Pull: '#00BFA5', Legs: '#A78BFA', Core: '#FF9500', Cardio: '#3B82F6' }
            const cats = ['All', ...Array.from(new Set(exerciseAnalysis.map(e => e.category)))]
            const hasBW = exerciseAnalysis.some(e => e.bodyweightBased)
            const filters = hasBW ? [...cats, 'Bodyweight'] : cats
            const shown = exerciseAnalysis.filter(e =>
              exerciseFilter === 'All' ? true : exerciseFilter === 'Bodyweight' ? e.bodyweightBased : e.category === exerciseFilter)
            return (
              <div className="space-y-4">
                {/* Bodyweight setting + filter chips */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {filters.map(f => (
                      <button key={f} onClick={() => setExerciseFilter(f)}
                        className="px-3 py-1 rounded-full text-xs font-semibold"
                        style={{
                          background: exerciseFilter === f ? '#00BFA5' : '#1A1A1A',
                          color: exerciseFilter === f ? '#0D0D0D' : '#606060',
                          border: `1px solid ${exerciseFilter === f ? '#00BFA5' : '#2E2E2E'}`,
                          cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        }}>{f}</button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-xs" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>
                    Bodyweight
                    <input type="number" min={30} max={250} defaultValue={bodyweight}
                      key={bodyweight}
                      onBlur={e => commitBodyweight(parseFloat(e.target.value))}
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
                      <button key={ex.name} onClick={() => setSelectedExercise(ex.name)}
                        className="rounded-xl p-4 text-left transition-colors relative"
                        style={{ background: '#1A1A1A', border: '1px solid #2E2E2E', cursor: 'pointer', opacity: ex.stale ? 0.62 : 1 }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#1E1E1E')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#1A1A1A')}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="text-sm font-black uppercase leading-tight" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>{ex.name}</h3>
                          <ChevronRight size={16} style={{ color: '#606060', flexShrink: 0, marginTop: 2 }} />
                        </div>
                        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${catCol}22`, color: catCol, fontFamily: 'var(--font-sans)' }}>{ex.category}</span>
                          {ex.bodyweightBased && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#2E2E2E', color: '#A0A0A0', fontFamily: 'var(--font-sans)' }}>BW</span>}
                          {ex.plateau && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', fontFamily: 'var(--font-sans)' }}>plateau</span>}
                          {ex.pctGain !== null && ex.pctGain > 0 && !ex.plateau && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,191,165,0.1)', color: '#00BFA5', fontFamily: 'var(--font-mono)' }}>▲ {ex.pctGain}%</span>}
                        </div>
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-2xl font-bold" style={{ color: '#A78BFA', fontFamily: 'var(--font-mono)' }}>{ex.best1RM}<span className="text-sm" style={{ color: '#606060' }}> kg</span></p>
                            <p className="text-xs mt-0.5" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>est. 1RM{ex.bodyweightBased ? ` · incl. ${ex.bwPct}% BW` : ''}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs" style={{ color: '#A0A0A0', fontFamily: 'var(--font-mono)' }}>{ex.setsPerWeek}/wk · {ex.totalSets} sets</p>
                            <p className="text-xs mt-0.5" style={{ color: ex.stale ? '#F59E0B' : '#606060', fontFamily: 'var(--font-sans)' }}>
                              {ex.daysSince === 0 ? 'today' : `${ex.daysSince}d ago`}{ex.stale ? ' · stale' : ''}
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })()
        )}

        {/* HISTORY — EXERCISES SUB-TAB: DETAIL */}
        {activeTab === 'history' && !selected && historySubTab === 'exercises' && selectedExercise && (() => {
          const ex = exerciseAnalysis.find(e => e.name === selectedExercise)
          if (!ex) { setSelectedExercise(null); return null }
          const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          const fmtShort = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          return (
            <div className="space-y-5">
              {/* Back bar */}
              <button onClick={() => setSelectedExercise(null)} className="flex items-center gap-1 text-sm"
                style={{ color: '#606060', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                <ChevronLeft size={16} /> All exercises
              </button>

              {/* Title + meta chips */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-2xl font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>{ex.name}</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs px-2 py-1 rounded" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E', color: '#606060', fontFamily: 'var(--font-sans)' }}>{ex.category}</span>
                  {ex.bodyweightBased && <span className="text-xs px-2 py-1 rounded" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E', color: '#A0A0A0', fontFamily: 'var(--font-sans)' }}>Bodyweight</span>}
                  <span className="text-xs px-2 py-1 rounded" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E', color: '#606060', fontFamily: 'var(--font-mono)' }}>{ex.totalSets} sets · {ex.setsPerWeek}/wk</span>
                  <span className="text-xs px-2 py-1 rounded" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E', color: '#A78BFA', fontFamily: 'var(--font-mono)' }}>{ex.best1RM} kg est. 1RM</span>
                </div>
              </div>

              {/* Progression stat strip */}
              <div className="flex items-center gap-2 flex-wrap">
                {ex.pctGain !== null && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: ex.pctGain >= 0 ? 'rgba(0,191,165,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${ex.pctGain >= 0 ? 'rgba(0,191,165,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                    <span className="text-xs font-bold" style={{ color: ex.pctGain >= 0 ? '#00BFA5' : '#EF4444', fontFamily: 'var(--font-mono)' }}>{ex.pctGain >= 0 ? '▲' : '▼'} {Math.abs(ex.pctGain)}%</span>
                    <span className="text-xs" style={{ color: '#A0A0A0', fontFamily: 'var(--font-sans)' }}>est. 1RM · {ex.gainWeeks}wk</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(200,16,46,0.06)', border: '1px solid rgba(200,16,46,0.2)' }}>
                  <Trophy size={12} style={{ color: '#C8102E' }} />
                  <span className="text-xs" style={{ color: '#A0A0A0', fontFamily: 'var(--font-sans)' }}>PR <span style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>{ex.prValue} kg</span> · {fmtShort(ex.prDate)}</span>
                </div>
                {ex.plateau && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
                    <span className="text-xs font-bold" style={{ color: '#F59E0B', fontFamily: 'var(--font-sans)' }}>Plateau — no PR in {Math.round((new Date(ex.lastDate).getTime() - new Date(ex.prDate).getTime()) / 86400000)}d</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                  <span className="text-xs" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>{ex.realReps} real rep{ex.realReps === 1 ? '' : 's'} logged · rest estimated</span>
                </div>
              </div>

              {ex.bodyweightBased && (
                <p className="text-xs" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>Log added weight only (0 = bodyweight). Total load = {ex.bwPct}% of your bodyweight ({bodyweight} kg = {Math.round(bodyweight * ex.bwPct) / 100} kg moved) + added — this movement leaves part of your mass unloaded. Set your bodyweight on the exercise grid.</p>
              )}

              {/* Chart 1: Est. 1RM progression over time (+ trendline, PR marker) */}
              <div className="rounded-xl p-5" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#606060', fontFamily: 'var(--font-heading)' }}>Est. 1RM Over Time</p>
                {ex.trend.length < 2 ? (
                  <p className="text-sm py-8 text-center" style={{ color: '#3E3E3E', fontFamily: 'var(--font-sans)' }}>Log this exercise across more sessions to see progression.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={ex.trend.map(t => ({ ...t, label: fmtShort(t.date) }))} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#606060' }} stroke="#2E2E2E" />
                      <YAxis tick={{ fontSize: 11, fill: '#606060' }} stroke="#2E2E2E" width={40} domain={['dataMin - 5', 'dataMax + 5']} />
                      <Tooltip {...chartTooltipStyle} formatter={(v: unknown, n: unknown) => [`${v} kg`, n === 'fit' ? 'Trend' : 'Est. 1RM']} />
                      <ReferenceLine y={ex.prValue} stroke="#C8102E" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: `PR ${ex.prValue}`, position: 'insideTopRight', fontSize: 10, fill: '#C8102E' }} />
                      <Line type="monotone" dataKey="fit" stroke="#606060" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
                      <Line type="monotone" dataKey="e1rm" stroke="#A78BFA" strokeWidth={2} dot={{ r: 3, fill: '#A78BFA' }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Chart 3: Volume (tonnage) per session */}
              <div className="rounded-xl p-5" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#606060', fontFamily: 'var(--font-heading)' }}>Volume Per Session <span style={{ textTransform: 'none', color: '#3E3E3E' }}>· load × reps</span></p>
                {ex.volumeTrend.length < 1 ? (
                  <p className="text-sm py-8 text-center" style={{ color: '#3E3E3E', fontFamily: 'var(--font-sans)' }}>No volume data.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={ex.volumeTrend.map(t => ({ ...t, label: fmtShort(t.date) }))} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#606060' }} stroke="#2E2E2E" />
                      <YAxis tick={{ fontSize: 11, fill: '#606060' }} stroke="#2E2E2E" width={44} />
                      <Tooltip {...chartTooltipStyle} formatter={(v: unknown) => [`${v} kg`, 'Volume']} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                      <Bar dataKey="volume" fill="#00BFA5" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Chart 2: Strength curve — predicted vs best logged across reps */}
              <div className="rounded-xl p-5" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#606060', fontFamily: 'var(--font-heading)' }}>Strength Curve — Predicted vs Best Logged</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={ex.curve} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" />
                    <XAxis dataKey="rep" tick={{ fontSize: 11, fill: '#606060' }} stroke="#2E2E2E" label={{ value: 'Reps', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#606060' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#606060' }} stroke="#2E2E2E" width={40} />
                    <Tooltip {...chartTooltipStyle} formatter={(v: unknown, n: unknown) => [`${v} kg`, n === 'predicted' ? 'Predicted' : 'Best logged']} labelFormatter={(l) => `${l} reps`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => v === 'predicted' ? 'Predicted' : 'Best logged'} />
                    <Line type="monotone" dataKey="predicted" stroke="#606060" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                    <Line type="monotone" dataKey="logged" stroke="#00BFA5" strokeWidth={2} dot={{ r: 3, fill: '#00BFA5' }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* RM table */}
              <div className="rounded-xl overflow-hidden" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 1fr' }}>
                  <div className="px-5 py-2.5 text-xs uppercase tracking-wider" style={{ color: '#606060', fontFamily: 'var(--font-heading)', borderBottom: '1px solid #2E2E2E' }}>Reps</div>
                  <div className="px-3 py-2.5 text-xs uppercase tracking-wider" style={{ color: '#606060', fontFamily: 'var(--font-heading)', borderBottom: '1px solid #2E2E2E' }}>
                    Predicted <span style={{ textTransform: 'none', color: '#3E3E3E', fontFamily: 'var(--font-sans)' }}>· from {fmt(ex.sourceDate)}</span>
                  </div>
                  <div className="px-3 py-2.5 text-xs uppercase tracking-wider" style={{ color: '#606060', fontFamily: 'var(--font-heading)', borderBottom: '1px solid #2E2E2E' }}>Best logged{ex.bodyweightBased ? <span style={{ textTransform: 'none', color: '#3E3E3E', fontFamily: 'var(--font-sans)' }}> · total load</span> : null}</div>
                  {ex.rows.map(row => {
                    const isSource = row.rep === ex.sourceReps
                    const italic = row.loggedKind !== 'actual'
                    return (
                      <Fragment key={row.rep}>
                        <div className="px-5 py-2 text-sm" style={{ borderBottom: '1px solid #1F1F1F', color: isSource ? '#00BFA5' : '#A0A0A0', fontWeight: isSource ? 700 : 400, fontFamily: 'var(--font-mono)' }}>{row.rep}</div>
                        <div className="px-3 py-2 text-sm" style={{ borderBottom: '1px solid #1F1F1F', color: '#F5F5F5', fontWeight: isSource ? 700 : 400, fontFamily: 'var(--font-mono)' }}>{row.predicted} kg</div>
                        <div className="px-3 py-2 text-sm" style={{ borderBottom: '1px solid #1F1F1F', fontFamily: 'var(--font-mono)' }}>
                          {row.logged === null ? (
                            <span style={{ color: '#3E3E3E' }}>—</span>
                          ) : (
                            <span style={{ color: italic ? '#606060' : '#00BFA5', fontStyle: italic ? 'italic' : 'normal' }}>
                              {row.logged} kg
                              {row.loggedDate
                                ? <span style={{ color: '#3E3E3E', fontStyle: 'normal' }}> · {fmt(row.loggedDate)}</span>
                                : <span style={{ color: '#3E3E3E', fontStyle: 'normal' }}> · {row.loggedKind === 'interp' ? 'interp' : 'est'}</span>}
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
        })()}

        {/* HISTORY — SESSION DETAIL */}
        {activeTab === 'history' && selected && (() => {
          const sess = editing && editSession ? editSession : selected
          const col = sessionTypeColor[sess.type] ?? '#606060'
          const dateLabel = new Date(sess.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
          return (
            <div className="space-y-5">
              {/* Back + Edit bar */}
              <div className="flex items-center justify-between">
                <button onClick={() => { setSelected(null); setEditing(false); setEditSession(null) }}
                  className="flex items-center gap-1 text-sm"
                  style={{ color: '#606060', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                  <ChevronLeft size={16} /> Back
                </button>
                {editing ? (
                  <div className="flex items-center gap-2">
                    <button onClick={cancelEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
                      style={{ color: '#606060', border: '1px solid #2E2E2E', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                      <X size={14} /> Cancel
                    </button>
                    <button onClick={saveEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold"
                      style={{ background: '#00BFA5', color: '#0D0D0D', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                      <Check size={14} /> Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {confirmDeleteId === selected.savedAt ? (
                      <>
                        <button onClick={() => { deleteSession(selected.savedAt); setConfirmDeleteId(null) }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold"
                          style={{ background: '#C8102E', color: '#fff', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                          <Trash2 size={13} /> Confirm Delete
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
                          style={{ color: '#606060', border: '1px solid #2E2E2E', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                          <X size={13} /> Cancel
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(selected.savedAt)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
                        style={{ color: '#606060', border: '1px solid #2E2E2E', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                        <Trash2 size={13} /> Delete
                      </button>
                    )}
                    <button onClick={startEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold"
                      style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #2E2E2E', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                      <Pencil size={13} /> Edit
                    </button>
                  </div>
                )}
              </div>

              {/* Session header */}
              <div className="rounded-xl px-5 py-4" style={{ background: '#1A1A1A', border: `1px solid ${col}30` }}>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: col, fontFamily: 'var(--font-sans)' }}>{dateLabel}</p>
                <h2 className="text-2xl font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>{sess.name}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold mt-2 inline-block"
                  style={{ background: `${col}22`, color: col, fontFamily: 'var(--font-sans)' }}>{sess.type}</span>
              </div>

              {/* Exercises */}
              {(sess.exercises ?? []).map(ex => (
                <div key={ex.id} className="rounded-xl overflow-hidden" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                  <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #2E2E2E', background: '#242424' }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: '#00BFA5' }} />
                    <span className="font-bold text-sm uppercase" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}>{ex.exerciseName}</span>
                  </div>
                  <div className="p-4">
                    <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: '28px 76px 1fr 1fr 52px' }}>
                      {['Set','Planned','Reps','kg','RPE'].map(h => (
                        <span key={h} className="text-xs text-center" style={{ color: '#606060' }}>{h}</span>
                      ))}
                    </div>
                    {ex.actualSets.map((set, si) => {
                      const planned = ex.plannedSets[si]
                      return (
                        <div key={si} className="grid gap-2 mb-2 items-center" style={{ gridTemplateColumns: '28px 76px 1fr 1fr 52px' }}>
                          <span className="w-6 h-6 rounded text-xs flex items-center justify-center mx-auto"
                            style={{ background: '#242424', color: '#606060', fontFamily: 'var(--font-mono)' }}>{si + 1}</span>
                          <span className="text-xs text-center" style={{ color: '#3E3E3E', fontFamily: 'var(--font-mono)' }}>
                            {planned ? `${planned.reps}×${planned.weight}` : '—'}
                          </span>
                          {(['reps','weight','rpe'] as const).map(field => (
                            editing ? (
                              <input key={field} type="number" value={set[field]}
                                onChange={e => updateEditSet(ex.id, si, field, e.target.value)}
                                placeholder={field === 'rpe' ? '—' : '0'}
                                className="w-full text-center py-2 rounded text-sm outline-none"
                                style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #00BFA544', fontFamily: 'var(--font-mono)' }} />
                            ) : (
                              <span key={field} className="text-sm text-center py-2 rounded"
                                style={{ background: '#242424', color: set[field] ? '#F5F5F5' : '#3E3E3E', fontFamily: 'var(--font-mono)', display: 'block' }}>
                                {set[field] || '—'}
                              </span>
                            )
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Run segments */}
              {(sess.run ?? []).map((entry, entryIdx) => {
                if ('kind' in entry && entry.kind === 'repeat') {
                  return (
                    <div key={entry.id} className="rounded-xl overflow-hidden" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                      <div className="px-4 py-2" style={{ background: '#242424', borderBottom: '1px solid #2E2E2E' }}>
                        <span className="text-xs font-bold uppercase" style={{ color: '#C8102E', fontFamily: 'var(--font-heading)' }}>×{entry.count} Repeat</span>
                      </div>
                      {entry.laps.map((lap, lapIdx) => (
                        <RunRow key={lap.id} lap={lap} editing={editing}
                          onUpdate={(f, v) => updateEditRun(entryIdx, f, v, lapIdx)} />
                      ))}
                    </div>
                  )
                }
                const seg = entry as LoggedRunSegment
                return (
                  <div key={seg.id} className="rounded-xl overflow-hidden" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                    <RunRow lap={seg} editing={editing}
                      onUpdate={(f, v) => updateEditRun(entryIdx, f, v)} />
                  </div>
                )
              })}

              {(sess.exercises ?? []).length === 0 && (sess.run ?? []).length === 0 && !sess.hikeKm && (
                <p className="text-sm text-center py-8" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>
                  No exercise or run data recorded for this session.
                </p>
              )}
              {sess.hikeKm != null && (
                <div className="rounded-xl overflow-hidden" style={{ background: '#1A1A1A', border: '1px solid #84CC1640' }}>
                  <div className="px-4 py-2" style={{ background: '#84CC1610', borderBottom: '1px solid #84CC1630' }}>
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#84CC16', fontFamily: 'var(--font-heading)' }}>Hike</span>
                  </div>
                  <div className="grid grid-cols-2 divide-x" style={{ borderColor: '#2E2E2E' }}>
                    <div className="px-4 py-4">
                      <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>Distance</p>
                      <p className="text-xl font-bold" style={{ color: '#84CC16', fontFamily: 'var(--font-mono)' }}>{sess.hikeKm} <span className="text-sm font-normal" style={{ color: '#606060' }}>km</span></p>
                    </div>
                    {sess.hikeElevationM != null && (
                      <div className="px-4 py-4">
                        <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>Elevation Gain</p>
                        <p className="text-xl font-bold" style={{ color: '#84CC16', fontFamily: 'var(--font-mono)' }}>{sess.hikeElevationM} <span className="text-sm font-normal" style={{ color: '#606060' }}>m</span></p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* AI COACH TAB */}
        {activeTab === 'ai-coach' && (
          <div className="space-y-5">
            {/* Header card */}
            <div className="rounded-xl p-6" style={{ background: '#1A1A1A', border: '1px solid rgba(167,139,250,0.2)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={15} style={{ color: '#A78BFA' }} />
                <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#A78BFA', fontFamily: 'var(--font-sans)' }}>AI Coach</span>
              </div>
              <h3 className="text-2xl font-black uppercase mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>
                Weekly Review
              </h3>
              <p className="text-sm" style={{ color: '#606060', fontFamily: 'var(--font-sans)', maxWidth: 560 }}>
                Every Sunday night, your AI coach reviews the week you actually trained — sessions, load, strength trends, running volume, and recovery — and tells you what&apos;s working and what to change next week. Every past review is kept below.
              </p>
              {history.length === 0 && (
                <p className="text-xs mt-2" style={{ color: '#C8102E', fontFamily: 'var(--font-sans)' }}>
                  Log some sessions first to enable AI analysis.
                </p>
              )}
            </div>

            {/* AI output */}
            {aiCoachText && (
              <div className="space-y-4">
                {displayedReportWeek && (
                  <p className="text-xs uppercase tracking-widest" style={{ color: '#A78BFA', fontFamily: 'var(--font-sans)' }}>
                    Latest report — week ending {new Date(displayedReportWeek + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
                {renderAICoachText(aiCoachText)}
              </div>
            )}

            {/* Placeholder when no report for this week yet */}
            {!aiCoachText && history.length > 0 && (
              <div className="rounded-xl p-10 text-center" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                <Sparkles size={32} style={{ color: '#2E2E2E', margin: '0 auto 12px' }} />
                <p className="text-sm font-semibold" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>
                  No report for this week yet.
                </p>
                <p className="text-xs mt-1" style={{ color: '#3E3E3E', fontFamily: 'var(--font-sans)' }}>
                  Your next report will auto-generate this Sunday at 23:50.
                </p>
              </div>
            )}

            {/* Past reports — grouped by month, excluding the report shown in the main slot */}
            {(() => {
              const past = pastReports.filter(r => r.weekEnding !== (displayedReportWeek ?? currentWeekEnding()))
              if (past.length === 0) return null
              const byMonth: Record<string, typeof past> = {}
              for (const r of past) { const key = r.weekEnding.slice(0, 7); (byMonth[key] ??= []).push(r) }
              const months = Object.keys(byMonth).sort((a, b) => b.localeCompare(a))
              return (
                <div>
                  <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>
                    Past Reports
                  </p>
                  <div className="rounded-xl overflow-hidden" style={{ background: '#141414', border: '1px solid #2E2E2E' }}>
                    {months.map((mKey, mi) => {
                      const monthLabel = new Date(mKey + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()
                      const monthOpen = expandedReportMonth === mKey
                      const reports = byMonth[mKey]
                      return (
                        <div key={mKey} style={{ borderBottom: mi < months.length - 1 ? '1px solid #1E1E1E' : 'none' }}>
                          <button
                            onClick={() => setExpandedReportMonth(monthOpen ? null : mKey)}
                            className="w-full flex items-center justify-between px-5 py-4"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-sm font-black uppercase tracking-wide" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>
                                {monthLabel}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#242424', color: '#8A8A8A', fontFamily: 'var(--font-mono)' }}>
                                {reports.length}
                              </span>
                            </div>
                            <ChevronDown size={14} style={{ color: '#606060', flexShrink: 0, transform: monthOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                          </button>

                          {monthOpen && (
                            <div className="px-3 pb-3 space-y-2">
                              {reports.map(report => {
                                const isOpen = expandedReport === report.id
                                const weekLabel = new Date(report.weekEnding + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
                                return (
                                  <div key={report.id} className="rounded-xl overflow-hidden" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                                    <button
                                      onClick={() => setExpandedReport(isOpen ? null : report.id)}
                                      className="w-full flex items-center justify-between px-5 py-4"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                                    >
                                      <div className="flex items-center gap-3">
                                        <Sparkles size={13} style={{ color: '#A78BFA', flexShrink: 0 }} />
                                        <div>
                                          <p className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>
                                            Week ending {weekLabel}
                                          </p>
                                          <p className="text-xs mt-0.5" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>
                                            {report.reportText.split('\n').find(l => l.startsWith('- '))?.replace('- ', '').slice(0, 80) ?? 'Weekly review'}...
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={e => { e.stopPropagation(); if (confirm('Delete this report?')) handleDeleteReport(report.id) }}
                                          className="p-1.5 rounded-lg" style={{ color: '#3E3E3E', cursor: 'pointer', background: 'none', border: 'none' }}
                                          onMouseEnter={e => (e.currentTarget.style.color = '#C8102E')}
                                          onMouseLeave={e => (e.currentTarget.style.color = '#3E3E3E')}
                                          title="Delete report"
                                        ><Trash2 size={13} /></button>
                                        <ChevronDown size={14} style={{ color: '#606060', flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                      </div>
                                    </button>
                                    {isOpen && (
                                      <div className="px-5 pb-5 space-y-4" style={{ borderTop: '1px solid #2E2E2E', paddingTop: '16px' }}>
                                        {renderAICoachText(report.reportText)}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* STRENGTH TAB */}
        {activeTab === 'strength' && (
          <>
            {!strengthData ? (
              <div className="rounded-xl p-12 text-center" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                <p className="text-sm font-semibold" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>No strength sessions logged yet.</p>
                <p className="text-xs mt-1" style={{ color: '#3E3E3E' }}>Log a lifting session to see your trends here.</p>
              </div>
            ) : (
              <>
                {/* 1RM Trend */}
                {strengthData.topExercises.length > 0 && (
                  <div className="rounded-xl p-5" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                    <h3 className="text-xl font-black uppercase mb-4" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>
                      Est. 1RM Trend — 12 Weeks
                    </h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={strengthData.weeklyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" />
                        <XAxis dataKey="week" stroke="#606060" tick={{ fill: '#606060', fontSize: 11, fontFamily: 'var(--font-mono)' }} />
                        <YAxis stroke="#606060" tick={{ fill: '#606060', fontSize: 11, fontFamily: 'var(--font-mono)' }} />
                        <Tooltip {...chartTooltipStyle} />
                        <Legend
                          wrapperStyle={{ fontFamily: 'var(--font-sans)', fontSize: 12, cursor: 'pointer' }}
                          onMouseEnter={(e: { dataKey?: string | number | ((obj: unknown) => unknown) }) => setHoveredLine(typeof e.dataKey === 'string' ? e.dataKey : null)}
                          onMouseLeave={() => setHoveredLine(null)}
                        />
                        {strengthData.topExercises.map((name, i) => {
                          const colors = ['#00BFA5', '#C8102E', '#A78BFA', '#F59E0B', '#60A5FA', '#F97316']
                          const col = colors[i % colors.length]
                          const dimmed = hoveredLine !== null && hoveredLine !== name
                          return <Line key={name} type="monotone" dataKey={name} name={name} stroke={col}
                            strokeWidth={dimmed ? 1 : 2.5} dot={{ r: dimmed ? 0 : 3, fill: col }}
                            opacity={dimmed ? 0.15 : 1} connectNulls />
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Weekly Volume */}
                <div className="rounded-xl p-5" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                  <h3 className="text-xl font-black uppercase mb-4" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>
                    Weekly Volume
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={strengthData.weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" />
                      <XAxis dataKey="week" stroke="#606060" tick={{ fill: '#606060', fontSize: 11, fontFamily: 'var(--font-mono)' }} />
                      <YAxis stroke="#606060" tick={{ fill: '#606060', fontSize: 11, fontFamily: 'var(--font-mono)' }} />
                      <Tooltip {...chartTooltipStyle} />
                      <Bar dataKey="volume" name="Volume (kg)" fill="#00BFA5" opacity={0.7} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Personal Records */}
                {strengthData.prs.length > 0 && (
                  <div className="rounded-xl overflow-hidden" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                    <div className="px-5 py-4" style={{ borderBottom: '1px solid #2E2E2E' }}>
                      <h3 className="text-xl font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>
                        Personal Records
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr style={{ borderBottom: '1px solid #2E2E2E' }}>
                            {['Exercise', 'Best Set', 'Est. 1RM', 'Date'].map(h => (
                              <th key={h} className="px-5 py-3 text-left text-xs uppercase tracking-wider" style={{ color: '#606060' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {strengthData.prs.map((row, i, arr) => (
                            <tr key={row.exercise} style={{ borderBottom: i < arr.length - 1 ? '1px solid #1A1A1A' : 'none' }}>
                              <td className="px-5 py-3 text-sm font-semibold" style={{ color: '#F5F5F5' }}>{row.exercise}</td>
                              <td className="px-5 py-3 text-sm font-bold" style={{ color: '#00BFA5', fontFamily: 'var(--font-mono)' }}>{row.pr} × {row.sets}</td>
                              <td className="px-5 py-3 text-sm" style={{ color: '#A78BFA', fontFamily: 'var(--font-mono)' }}>{row.rm}</td>
                              <td className="px-5 py-3 text-sm" style={{ color: '#606060' }}>{row.date}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* RUNNING TAB */}
        {activeTab === 'running' && (
          !runningData ? (
            <div className="rounded-xl p-12 text-center" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
              <p className="text-sm font-semibold" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>No run sessions logged yet.</p>
              <p className="text-xs mt-1" style={{ color: '#3E3E3E' }}>Log a running session to see your trends here.</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl p-5" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                <h3 className="text-xl font-black uppercase mb-4" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>
                  Weekly Mileage — 12 Weeks
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={runningData.weeklyKm}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" />
                    <XAxis dataKey="week" stroke="#606060" tick={{ fill: '#606060', fontSize: 11, fontFamily: 'var(--font-mono)' }} />
                    <YAxis stroke="#606060" tick={{ fill: '#606060', fontSize: 11, fontFamily: 'var(--font-mono)' }} />
                    <Tooltip {...chartTooltipStyle} formatter={(v: unknown) => [`${v} km`, 'Distance']} />
                    <Bar dataKey="km" name="Km" fill="#C8102E" opacity={0.75} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {runningData.runTypeMix.length > 0 && (
                <div className="rounded-xl p-5" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                  <h3 className="text-xl font-black uppercase mb-6" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>
                    Run Type Mix
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {([
                      { label: 'This Month', data: runningData.runTypeMixMonth },
                      { label: 'This Year',  data: runningData.runTypeMixYear  },
                      { label: 'All Time',   data: runningData.runTypeMix      },
                    ] as const).map(({ label, data }) => (
                      <div key={label}>
                        <p className="text-xs uppercase tracking-wider text-center mb-3" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>{label}</p>
                        {data.length === 0 ? (
                          <p className="text-xs text-center py-8" style={{ color: '#3E3E3E', fontFamily: 'var(--font-sans)' }}>No data</p>
                        ) : (
                          <>
                            <ResponsiveContainer width="100%" height={180}>
                              <PieChart>
                                <Pie data={data} cx="50%" cy="50%" outerRadius={70} dataKey="value" labelLine={false}
                                  label={({ cx, cy, midAngle, innerRadius, outerRadius, value }: { cx: number; cy: number; midAngle?: number; innerRadius: number; outerRadius: number; value: number }) => {
                                    const RADIAN = Math.PI / 180
                                    const angle = midAngle ?? 0
                                    const r = innerRadius + (outerRadius - innerRadius) * 1.45
                                    const x = cx + r * Math.cos(-angle * RADIAN)
                                    const y = cy + r * Math.sin(-angle * RADIAN)
                                    return value >= 10 ? <text x={x} y={y} fill="#606060" textAnchor={x > cx ? 'start' : 'end'} fontSize={10} style={{ fontFamily: 'var(--font-sans)' }}>{value}%</text> : null
                                  }}>
                                  {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                </Pie>
                                <Tooltip {...chartTooltipStyle} formatter={(v: unknown) => [`${v}%`, 'Share']} />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
                              {data.map(d => (
                                <div key={d.name} className="flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                                  <span className="text-xs" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>{d.name}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )
        )}

        {/* HYBRID TAB */}
        {activeTab === 'hybrid' && (
          !hybridData ? (
            <div className="rounded-xl p-12 text-center" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
              <p className="text-sm font-semibold" style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>No sessions logged yet.</p>
              <p className="text-xs mt-1" style={{ color: '#3E3E3E' }}>Log both lifting and running sessions to see interference analysis.</p>
            </div>
          ) : (
          <>
            {/* Dual-axis chart */}
            <div className="rounded-xl p-5" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
              <h3 className="text-xl font-black uppercase mb-4" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>
                Strength vs Mileage — 12 Weeks
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={hybridData.weeklyChart} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" />
                  <XAxis dataKey="week" stroke="#606060" tick={{ fill: '#606060', fontSize: 11, fontFamily: 'var(--font-mono)' }} />
                  <YAxis yAxisId="km" orientation="left" stroke="#C8102E" tick={{ fill: '#C8102E', fontSize: 10 }} label={{ value: 'km', fill: '#C8102E', fontSize: 10, position: 'insideTopLeft' }} />
                  <YAxis yAxisId="ton" orientation="right" stroke="#00BFA5" tick={{ fill: '#00BFA5', fontSize: 10 }} label={{ value: '×100kg', fill: '#00BFA5', fontSize: 10, position: 'insideTopRight' }} />
                  <Tooltip {...chartTooltipStyle} formatter={(v: unknown, name: unknown) => name === 'km' ? [`${v} km`, 'Mileage'] : [`${Number(v) * 100} kg`, 'Volume']} />
                  <Legend wrapperStyle={{ fontFamily: 'var(--font-sans)', fontSize: 12 }} />
                  <Bar yAxisId="km" dataKey="km" name="Mileage (km)" fill="#C8102E" opacity={0.7} radius={[3, 3, 0, 0]} />
                  <Bar yAxisId="ton" dataKey="volume" name="Volume (×100kg)" fill="#00BFA5" opacity={0.7} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Balance */}
            <div className="rounded-xl p-5" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
              <h3 className="text-xl font-black uppercase mb-4" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>
                Strength-Endurance Balance
              </h3>
              <div className="flex flex-col items-center">
                {/* Bar gauge */}
                <div className="w-full max-w-sm">
                  <div className="flex justify-between text-xs mb-1" style={{ fontFamily: 'var(--font-sans)' }}>
                    <span style={{ color: '#00BFA5' }}>Strength {hybridData.liftPct}%</span>
                    <span style={{ color: '#C8102E' }}>Endurance {hybridData.runPct}%</span>
                  </div>
                  <div className="w-full h-4 rounded-full overflow-hidden flex" style={{ background: '#2E2E2E' }}>
                    <div style={{ width: `${hybridData.liftPct}%`, background: '#00BFA5', transition: 'width 0.5s' }} />
                    <div style={{ width: `${hybridData.runPct}%`, background: '#C8102E', transition: 'width 0.5s' }} />
                  </div>
                  <p className="text-xs text-center mt-3" style={{ color: '#A0A0A0', fontFamily: 'var(--font-sans)' }}>
                    {hybridData.liftPct > hybridData.runPct
                      ? 'Strength bias — consider adding more run volume'
                      : hybridData.runPct > hybridData.liftPct
                      ? 'Endurance bias — consider adding more strength sessions'
                      : 'Well balanced between strength and endurance'}
                  </p>
                </div>
              </div>
            </div>
          </>
          )
        )}

      </div>
    </div>
  )
}
