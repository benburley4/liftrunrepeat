'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Trophy, TrendingUp, Zap, Activity, ChevronLeft, ChevronDown, Pencil, Check, X, Trash2, Sparkles } from 'lucide-react'
import { getSessions, upsertSession, deleteSession as dbDeleteSession, getCoachReports, saveCoachReport, CoachReport } from '@/lib/db'
import ConsistencyHeatmap from '@/components/ui/ConsistencyHeatmap'
import QuickLogFAB from '@/components/log/QuickLogFAB'

type TabId = 'overview' | 'ai-coach' | 'prs' | 'history' | 'strength' | 'running' | 'hybrid'

const chartTooltipStyle = {
  contentStyle: { background: '#242424', border: '1px solid #2E2E2E', borderRadius: '8px', fontFamily: 'Inter, sans-serif' },
  labelStyle: { color: '#F5F5F5', fontSize: 11 },
  itemStyle: { fontSize: 11 },
}

const sessionTypeColor: Record<string, string> = {
  lift: '#00BFA5',
  run: '#C8102E',
  hybrid: '#A78BFA',
}

interface ActualSet { reps: string; weight: string; rpe: string }
interface LoggedExercise { id: string; exerciseName: string; plannedSets: Array<{ reps: string; weight: string }>; actualSets: ActualSet[] }
interface LoggedRunSegment { id: string; segmentType: string; metric: string; plannedValue: string; plannedPace: string; actualValue: string; actualPace: string }
interface LoggedRepeat { id: string; kind: 'repeat'; count: string; laps: LoggedRunSegment[] }
type LoggedRunEntry = LoggedRunSegment | LoggedRepeat

interface SavedSession {
  type: string; name: string; date: string; savedAt: string
  exercises?: LoggedExercise[]
  run?: LoggedRunEntry[]
  hikeKm?: number
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
        style={{ background: '#C8102E20', color: '#C8102E', fontFamily: 'Inter, sans-serif' }}>{lap.segmentType}</span>
      {lap.plannedValue && (
        <span className="text-xs flex-shrink-0" style={{ color: '#3E3E3E', fontFamily: 'JetBrains Mono, monospace' }}>
          {lap.plannedValue}{unit ? ' ' + unit : ''}{lap.plannedPace ? ` @ ${lap.plannedPace}/km` : ''} →
        </span>
      )}
      <div className="flex items-center gap-1 flex-shrink-0">
        {editing ? (
          <input type={lap.metric === 'time' ? 'text' : 'number'} value={lap.actualValue}
            onChange={e => onUpdate('actualValue', e.target.value)}
            className="w-16 text-center py-1.5 rounded text-xs outline-none"
            style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #00BFA544', fontFamily: 'JetBrains Mono, monospace' }} />
        ) : (
          <span className="text-sm font-semibold" style={{ color: lap.actualValue ? '#F5F5F5' : '#3E3E3E', fontFamily: 'JetBrains Mono, monospace' }}>
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
              style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #00BFA544', fontFamily: 'JetBrains Mono, monospace' }} />
          ) : (
            <span className="text-sm font-semibold" style={{ color: lap.actualPace ? '#F5F5F5' : '#3E3E3E', fontFamily: 'JetBrains Mono, monospace' }}>
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
  const [expandedReport, setExpandedReport] = useState<string | null>(null)

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
    function epleyRM(w: number, r: number) { return r === 1 ? w : Math.round(w * (1 + r / 30)) }
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
    d.setDate(d.getDate() + (day === 0 ? 0 : 7 - day))
    return d.toISOString().split('T')[0]
  }

  async function loadPastReports() {
    try {
      const reports = await getCoachReports()
      setPastReports(reports)
      // If a report exists for the current week, pre-populate the current view
      const weekEnding = currentWeekEnding()
      const thisWeek = reports.find(r => r.weekEnding === weekEnding)
      if (thisWeek && !aiCoachText) setAiCoachText(thisWeek.reportText)
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
            <p style={{ color: '#A0A0A0', fontSize: 13, lineHeight: 1.6, fontFamily: 'Inter, sans-serif', margin: 0 }}>
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
          <p className="text-xs font-black uppercase mb-3" style={{ color: titleColor, fontFamily: 'Montserrat, sans-serif', letterSpacing: '0.08em' }}>{title}</p>
          <div>{bullets}</div>
        </div>
      )
    })
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
      return sum + (s.run ?? []).reduce((rs, entry) => {
        if ('kind' in entry && entry.kind === 'repeat')
          return rs + entry.laps.reduce((ls, l) => ls + segKm(l), 0) * (parseInt(entry.count) || 1)
        return rs + segKm(entry as LoggedRunSegment)
      }, 0)
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
      return liftLoad + runLoad
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

    // 1. Personalised base score — centred on their own average, not a fixed 50
    let score = personalWeeklyAvg > 0
      ? Math.round(65 - ((thisWeekLoad / personalWeeklyAvg) - 1) * 30)
      : history.length === 0 ? 75 : 65

    // 2. Consistency bonus — sustained training builds resilience (max +10)
    const weeksActive = allWeekLoads.filter(w => w.total > 0).length
    score += Math.min(10, Math.floor(weeksActive / 2))

    // 3. Days since last session — rest genuinely helps (max +15)
    const lastSessionDate = [...history].sort((a, b) => b.date.localeCompare(a.date))[0]?.date
    const daysSinceLast = lastSessionDate
      ? Math.floor((now.getTime() - new Date(lastSessionDate + 'T00:00:00').getTime()) / 86400000)
      : 0
    if (daysSinceLast > 0) score += Math.min(15, daysSinceLast * 4)

    // 4. Ramp rate — spike in volume signals injury risk
    if (lastWeekLoad > 0) {
      const ramp = (thisWeekLoad - lastWeekLoad) / lastWeekLoad
      if (ramp > 0.1) score -= Math.round(Math.min(15, ramp * 30))
      else if (ramp < -0.1) score += 5  // deload week = bonus
    }

    // 5. Cross-sport freshness — dominated-sport week means the other sport feels fresh
    const recentLiftTotal = recent7.reduce((s, sess) => s + sessionLiftLoad(sess), 0)
    const recentTotal = recent7.reduce((s, sess) => s + sessionLoad(sess), 0)
    const liftRatio = recentTotal > 0 ? recentLiftTotal / recentTotal : 0.5
    if (liftRatio < 0.2 || liftRatio > 0.8) score += 5

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
      readinessLabel,
      readinessTrend,
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
    const PPL_KEYWORDS: [RegExp, string][] = [
      [/bench|push.?up|fly|chest|pec/i,                                        'Push'],
      [/overhead.?press|ohp|shoulder.?press|military|lateral.?raise|front.?raise/i, 'Push'],
      [/tricep|pushdown|skull|extension/i,                                     'Push'],
      [/row|pull.?up|chin.?up|lat\b|pulldown|face.?pull|rear.?delt|shrug/i,   'Pull'],
      [/curl|bicep/i,                                                           'Pull'],
      [/squat|lunge|leg.?press|hip.?thrust|glute|calf|step.?up|hack/i,        'Legs'],
      [/deadlift|rdl|romanian/i,                                                'Legs'],
      [/plank|crunch|sit.?up|hollow|\bab\b|core|russian|oblique/i,             'Core'],
    ]
    const BODY_KEYWORDS: [RegExp, string][] = [
      [/bench|push.?up|fly|chest|pec/i,                                         'Chest'],
      [/overhead.?press|ohp|shoulder.?press|military|lateral.?raise|front.?raise|face.?pull|rear.?delt/i, 'Shoulders'],
      [/row|pull.?up|chin.?up|lat\b|pulldown|shrug/i,                           'Back'],
      [/deadlift|rdl|romanian/i,                                                 'Back'],
      [/squat|lunge|leg.?press|hip.?thrust|glute|calf|step.?up|hack/i,         'Legs'],
      [/curl|bicep/i,                                                            'Arms'],
      [/tricep|pushdown|skull|extension/i,                                       'Arms'],
      [/plank|crunch|sit.?up|hollow|\bab\b|core|russian|oblique/i,              'Core'],
    ]
    function classifyPPL(name: string) {
      for (const [re, cat] of PPL_KEYWORDS) if (re.test(name)) return cat
      return 'Push'
    }
    function classifyBody(name: string) {
      for (const [re, bp] of BODY_KEYWORDS) if (re.test(name)) return bp
      return 'Back'
    }

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
    { id: 'ai-coach', label: 'AI Coach' },
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
          <h1 className="text-5xl font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
            Analytics
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
              <div className="text-2xl font-bold" style={{ color: accent, fontFamily: 'JetBrains Mono, monospace' }}>
                {value}
              </div>
              <div className="text-xs mt-1" style={{ color: '#606060' }}>{sub}</div>
            </div>
          ))}
        </div>
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
                style={{ color: activeTab === tab.id ? '#F5F5F5' : '#606060', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}
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
                  style={{ background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.2)' }}
                >
                  <Trophy size={20} style={{ color: '#C8102E' }} />
                  <div>
                    <span className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'Montserrat, sans-serif', fontSize: '16px' }}>
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

            {/* Heatmap + breakdown charts */}
            <div className="rounded-xl p-5" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
              <h3 className="text-xl font-black uppercase mb-4" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
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
                            <span style={{ fontSize: 11, color: '#A0A0A0', fontFamily: 'Inter, sans-serif', flex: 1 }}>{d.label}</span>
                            <span style={{ fontSize: 11, color: '#606060', fontFamily: 'JetBrains Mono, monospace', paddingLeft: 6 }}>
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
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#A0A0A0', fontFamily: 'Montserrat, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Push / Pull / Legs</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <MiniDonut slices={sessionBreakdown.pplSlices} size={80} />
                          <Legend slices={sessionBreakdown.pplSlices} />
                        </div>
                      </div>
                      <div style={{ borderLeft: '1px solid #2E2E2E', paddingLeft: 32 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#A0A0A0', fontFamily: 'Montserrat, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Body Part Split</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <MiniDonut slices={sessionBreakdown.bodySlices} size={80} />
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
                    <h3 className="text-xl font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
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
                          <p className="text-sm font-bold uppercase" style={{ color: '#F5F5F5', fontFamily: 'Montserrat, sans-serif' }}>{s.name}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#606060' }}>{dateLabel}</p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                          style={{ background: `${col}22`, color: col, fontFamily: 'Inter, sans-serif' }}>
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
                <h3 className="text-base font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>Lift</h3>
              </div>
              {!strengthData || strengthData.prs.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>No lift data yet.</p>
                </div>
              ) : (
                <div>
                  {strengthData.prs.map((row, i, arr) => (
                    <div key={row.exercise} className="px-5 py-4"
                      style={{ borderBottom: i < arr.length - 1 ? '1px solid #2E2E2E' : 'none' }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-bold uppercase" style={{ color: '#F5F5F5', fontFamily: 'Montserrat, sans-serif' }}>{row.exercise}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#242424', color: '#606060', fontFamily: 'JetBrains Mono, monospace' }}>{row.totalSets} sets</span>
                          <span className="text-xs" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>{row.date}</span>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1 rounded-lg px-3 py-2" style={{ background: '#242424' }}>
                          <p className="text-xs mb-0.5" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Heaviest Set</p>
                          <p className="text-sm font-bold" style={{ color: '#00BFA5', fontFamily: 'JetBrains Mono, monospace' }}>{row.pr} × {row.sets}</p>
                        </div>
                        <div className="flex-1 rounded-lg px-3 py-2" style={{ background: '#242424' }}>
                          <p className="text-xs mb-0.5" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Est. 1RM</p>
                          <p className="text-sm font-bold" style={{ color: '#A78BFA', fontFamily: 'JetBrains Mono, monospace' }}>{row.rm.replace(' est. 1RM', '')}</p>
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
                <h3 className="text-base font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>Run</h3>
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
                    <p className="text-sm" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>No run data yet.</p>
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
                          <p className="text-sm font-bold uppercase" style={{ color: '#F5F5F5', fontFamily: 'Montserrat, sans-serif' }}>{row.label}</p>
                          <p className="text-xs" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>{row.date}</p>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-1 rounded-lg px-3 py-2" style={{ background: '#242424' }}>
                            <p className="text-xs mb-0.5" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Best Pace</p>
                            <p className="text-sm font-bold" style={{ color: '#C8102E', fontFamily: 'JetBrains Mono, monospace' }}>{row.pace}</p>
                          </div>
                          <div className="flex-1 rounded-lg px-3 py-2" style={{ background: '#242424' }}>
                            <p className="text-xs mb-0.5" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Finish Time</p>
                            <p className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'JetBrains Mono, monospace' }}>{row.time}</p>
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
        {activeTab === 'history' && !selected && (
          <div className="rounded-xl overflow-hidden" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
            {history.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>No sessions logged yet.</p>
                <p className="text-xs" style={{ color: '#3E3E3E', fontFamily: 'Inter, sans-serif' }}>Sessions saved in Log Session will appear here.</p>
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
                        <p className="text-sm font-bold uppercase" style={{ color: '#F5F5F5', fontFamily: 'Montserrat, sans-serif' }}>{s.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>{dateLabel}</p>
                      </div>
                      {totalKm > 0 && (
                        <span className="text-sm font-bold flex-shrink-0" style={{ color: '#C8102E', fontFamily: 'JetBrains Mono, monospace' }}>
                          {totalKm % 1 === 0 ? totalKm : totalKm.toFixed(1)} km
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                        style={{ background: `${col}22`, color: col, fontFamily: 'Inter, sans-serif' }}>{s.type}</span>
                      <button onClick={e => { e.stopPropagation(); if (confirm('Delete this session?')) deleteSession(s.savedAt) }}
                        className="flex-shrink-0 p-1.5 rounded-lg" style={{ color: '#3E3E3E', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#C8102E')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#3E3E3E')} title="Delete session">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {exercises.length > 0 && (
                      <div className="px-5 pb-1 pl-11 space-y-0.5">
                        {exercises.map(ex => (
                          <div key={ex.id} className="flex items-center gap-2 text-xs min-w-0" style={{ fontFamily: 'Inter, sans-serif' }}>
                            <span className="font-medium shrink-0" style={{ color: '#A0A0A0' }}>{ex.exerciseName}</span>
                            <span className="truncate text-right flex-1" style={{ color: '#606060', fontFamily: 'JetBrains Mono, monospace' }}>
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
                            <div key={entry.id ?? ri} className="text-xs" style={{ fontFamily: 'Inter, sans-serif' }}>
                              <span style={{ color: '#C8102E' }}>×{entry.count} </span>
                              <span style={{ color: '#606060' }}>{entry.laps.map(l => `${l.segmentType} ${l.actualValue}${l.metric === 'distance' ? 'km' : l.metric === 'time' ? 'min' : ''}`).join(' / ')}</span>
                            </div>
                          )
                          const seg = entry as LoggedRunSegment
                          return (
                            <div key={seg.id ?? ri} className="flex items-center justify-between text-xs" style={{ fontFamily: 'Inter, sans-serif' }}>
                              <span className="capitalize" style={{ color: '#A0A0A0' }}>{seg.segmentType}</span>
                              <span style={{ color: '#606060', fontFamily: 'JetBrains Mono, monospace' }}>
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
                      <span className="text-sm font-bold uppercase" style={{ color: '#F5F5F5', fontFamily: 'Montserrat, sans-serif' }}>{group.label}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#2E2E2E', color: '#606060', fontFamily: 'Inter, sans-serif' }}>{group.sessions.length}</span>
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
                  style={{ color: '#606060', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
                  <ChevronLeft size={16} /> Back
                </button>
                {editing ? (
                  <div className="flex items-center gap-2">
                    <button onClick={cancelEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
                      style={{ color: '#606060', border: '1px solid #2E2E2E', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
                      <X size={14} /> Cancel
                    </button>
                    <button onClick={saveEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold"
                      style={{ background: '#00BFA5', color: '#0D0D0D', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
                      <Check size={14} /> Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button onClick={() => { if (confirm('Delete this session?')) deleteSession(selected.savedAt) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
                      style={{ color: '#606060', border: '1px solid #2E2E2E', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
                      <Trash2 size={13} /> Delete
                    </button>
                    <button onClick={startEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold"
                      style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #2E2E2E', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
                      <Pencil size={13} /> Edit
                    </button>
                  </div>
                )}
              </div>

              {/* Session header */}
              <div className="rounded-xl px-5 py-4" style={{ background: '#1A1A1A', border: `1px solid ${col}30` }}>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: col, fontFamily: 'Inter, sans-serif' }}>{dateLabel}</p>
                <h2 className="text-2xl font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>{sess.name}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold mt-2 inline-block"
                  style={{ background: `${col}22`, color: col, fontFamily: 'Inter, sans-serif' }}>{sess.type}</span>
              </div>

              {/* Exercises */}
              {(sess.exercises ?? []).map(ex => (
                <div key={ex.id} className="rounded-xl overflow-hidden" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                  <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #2E2E2E', background: '#242424' }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: '#00BFA5' }} />
                    <span className="font-bold text-sm uppercase" style={{ color: '#F5F5F5', fontFamily: 'Montserrat, sans-serif', letterSpacing: '0.05em' }}>{ex.exerciseName}</span>
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
                            style={{ background: '#242424', color: '#606060', fontFamily: 'JetBrains Mono, monospace' }}>{si + 1}</span>
                          <span className="text-xs text-center" style={{ color: '#3E3E3E', fontFamily: 'JetBrains Mono, monospace' }}>
                            {planned ? `${planned.reps}×${planned.weight}` : '—'}
                          </span>
                          {(['reps','weight','rpe'] as const).map(field => (
                            editing ? (
                              <input key={field} type="number" value={set[field]}
                                onChange={e => updateEditSet(ex.id, si, field, e.target.value)}
                                placeholder={field === 'rpe' ? '—' : '0'}
                                className="w-full text-center py-2 rounded text-sm outline-none"
                                style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #00BFA544', fontFamily: 'JetBrains Mono, monospace' }} />
                            ) : (
                              <span key={field} className="text-sm text-center py-2 rounded"
                                style={{ background: '#242424', color: set[field] ? '#F5F5F5' : '#3E3E3E', fontFamily: 'JetBrains Mono, monospace', display: 'block' }}>
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
                        <span className="text-xs font-bold uppercase" style={{ color: '#C8102E', fontFamily: 'Montserrat, sans-serif' }}>×{entry.count} Repeat</span>
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

              {(sess.exercises ?? []).length === 0 && (sess.run ?? []).length === 0 && (
                <p className="text-sm text-center py-8" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
                  No exercise or run data recorded for this session.
                </p>
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
                <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#A78BFA', fontFamily: 'Inter, sans-serif' }}>AI Coach</span>
              </div>
              <h3 className="text-2xl font-black uppercase mb-2" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
                Training Analysis
              </h3>
              <p className="text-sm" style={{ color: '#606060', fontFamily: 'Inter, sans-serif', maxWidth: 560 }}>
                Your AI coach analyses your session history — load, strength trends, running volume, training balance, and recovery — and gives you personalised recommendations. Reports auto-generate every Sunday night and are saved for the last 12 weeks.
              </p>
              {history.length === 0 && (
                <p className="text-xs mt-2" style={{ color: '#C8102E', fontFamily: 'Inter, sans-serif' }}>
                  Log some sessions first to enable AI analysis.
                </p>
              )}
            </div>

            {/* AI output */}
            {aiCoachText && (
              <div className="space-y-4">
                {renderAICoachText(aiCoachText)}
              </div>
            )}

            {/* Placeholder when no report for this week yet */}
            {!aiCoachText && history.length > 0 && (
              <div className="rounded-xl p-10 text-center" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                <Sparkles size={32} style={{ color: '#2E2E2E', margin: '0 auto 12px' }} />
                <p className="text-sm font-semibold" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
                  No report for this week yet.
                </p>
                <p className="text-xs mt-1" style={{ color: '#3E3E3E', fontFamily: 'Inter, sans-serif' }}>
                  Your next report will auto-generate this Sunday at 23:50.
                </p>
              </div>
            )}

            {/* Past reports */}
            {pastReports.filter(r => r.weekEnding !== currentWeekEnding()).length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
                  Past Reports
                </p>
                <div className="space-y-2">
                  {pastReports
                    .filter(r => r.weekEnding !== currentWeekEnding())
                    .map(report => {
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
                                <p className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'Montserrat, sans-serif' }}>
                                  Week ending {weekLabel}
                                </p>
                                <p className="text-xs mt-0.5" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
                                  {report.reportText.split('\n').find(l => l.startsWith('- '))?.replace('- ', '').slice(0, 80) ?? 'AI Coach report'}...
                                </p>
                              </div>
                            </div>
                            <ChevronDown size={14} style={{ color: '#606060', flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
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
              </div>
            )}
          </div>
        )}

        {/* STRENGTH TAB */}
        {activeTab === 'strength' && (
          <>
            {!strengthData ? (
              <div className="rounded-xl p-12 text-center" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                <p className="text-sm font-semibold" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>No strength sessions logged yet.</p>
                <p className="text-xs mt-1" style={{ color: '#3E3E3E' }}>Log a lifting session to see your trends here.</p>
              </div>
            ) : (
              <>
                {/* 1RM Trend */}
                {strengthData.topExercises.length > 0 && (
                  <div className="rounded-xl p-5" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                    <h3 className="text-xl font-black uppercase mb-4" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
                      Est. 1RM Trend — 12 Weeks
                    </h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={strengthData.weeklyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" />
                        <XAxis dataKey="week" stroke="#606060" tick={{ fill: '#606060', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} />
                        <YAxis stroke="#606060" tick={{ fill: '#606060', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} />
                        <Tooltip {...chartTooltipStyle} />
                        <Legend
                          wrapperStyle={{ fontFamily: 'Inter, sans-serif', fontSize: 12, cursor: 'pointer' }}
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
                  <h3 className="text-xl font-black uppercase mb-4" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
                    Weekly Volume
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={strengthData.weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" />
                      <XAxis dataKey="week" stroke="#606060" tick={{ fill: '#606060', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} />
                      <YAxis stroke="#606060" tick={{ fill: '#606060', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} />
                      <Tooltip {...chartTooltipStyle} />
                      <Bar dataKey="volume" name="Volume (kg)" fill="#00BFA5" opacity={0.7} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Personal Records */}
                {strengthData.prs.length > 0 && (
                  <div className="rounded-xl overflow-hidden" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                    <div className="px-5 py-4" style={{ borderBottom: '1px solid #2E2E2E' }}>
                      <h3 className="text-xl font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
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
                              <td className="px-5 py-3 text-sm font-bold" style={{ color: '#00BFA5', fontFamily: 'JetBrains Mono, monospace' }}>{row.pr} × {row.sets}</td>
                              <td className="px-5 py-3 text-sm" style={{ color: '#A78BFA', fontFamily: 'JetBrains Mono, monospace' }}>{row.rm}</td>
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
              <p className="text-sm font-semibold" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>No run sessions logged yet.</p>
              <p className="text-xs mt-1" style={{ color: '#3E3E3E' }}>Log a running session to see your trends here.</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl p-5" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                <h3 className="text-xl font-black uppercase mb-4" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
                  Weekly Mileage — 12 Weeks
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={runningData.weeklyKm}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" />
                    <XAxis dataKey="week" stroke="#606060" tick={{ fill: '#606060', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} />
                    <YAxis stroke="#606060" tick={{ fill: '#606060', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} />
                    <Tooltip {...chartTooltipStyle} formatter={(v: unknown) => [`${v} km`, 'Distance']} />
                    <Bar dataKey="km" name="Km" fill="#C8102E" opacity={0.75} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {runningData.runTypeMix.length > 0 && (
                <div className="rounded-xl p-5" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                  <h3 className="text-xl font-black uppercase mb-6" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
                    Run Type Mix
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {([
                      { label: 'This Month', data: runningData.runTypeMixMonth },
                      { label: 'This Year',  data: runningData.runTypeMixYear  },
                      { label: 'All Time',   data: runningData.runTypeMix      },
                    ] as const).map(({ label, data }) => (
                      <div key={label}>
                        <p className="text-xs uppercase tracking-wider text-center mb-3" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>{label}</p>
                        {data.length === 0 ? (
                          <p className="text-xs text-center py-8" style={{ color: '#3E3E3E', fontFamily: 'Inter, sans-serif' }}>No data</p>
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
                                    return value >= 10 ? <text x={x} y={y} fill="#606060" textAnchor={x > cx ? 'start' : 'end'} fontSize={10} fontFamily="Inter, sans-serif">{value}%</text> : null
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
                                  <span className="text-xs" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>{d.name}</span>
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
              <p className="text-sm font-semibold" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>No sessions logged yet.</p>
              <p className="text-xs mt-1" style={{ color: '#3E3E3E' }}>Log both lifting and running sessions to see interference analysis.</p>
            </div>
          ) : (
          <>
            {/* Dual-axis chart */}
            <div className="rounded-xl p-5" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
              <h3 className="text-xl font-black uppercase mb-4" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
                Strength vs Mileage — 12 Weeks
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={hybridData.weeklyChart} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" />
                  <XAxis dataKey="week" stroke="#606060" tick={{ fill: '#606060', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} />
                  <YAxis yAxisId="km" orientation="left" stroke="#C8102E" tick={{ fill: '#C8102E', fontSize: 10 }} label={{ value: 'km', fill: '#C8102E', fontSize: 10, position: 'insideTopLeft' }} />
                  <YAxis yAxisId="ton" orientation="right" stroke="#00BFA5" tick={{ fill: '#00BFA5', fontSize: 10 }} label={{ value: '×100kg', fill: '#00BFA5', fontSize: 10, position: 'insideTopRight' }} />
                  <Tooltip {...chartTooltipStyle} formatter={(v: unknown, name: unknown) => name === 'km' ? [`${v} km`, 'Mileage'] : [`${Number(v) * 100} kg`, 'Volume']} />
                  <Legend wrapperStyle={{ fontFamily: 'Inter, sans-serif', fontSize: 12 }} />
                  <Bar yAxisId="km" dataKey="km" name="Mileage (km)" fill="#C8102E" opacity={0.7} radius={[3, 3, 0, 0]} />
                  <Bar yAxisId="ton" dataKey="volume" name="Volume (×100kg)" fill="#00BFA5" opacity={0.7} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Balance */}
            <div className="rounded-xl p-5" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
              <h3 className="text-xl font-black uppercase mb-4" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
                Strength-Endurance Balance
              </h3>
              <div className="flex flex-col items-center">
                {/* Bar gauge */}
                <div className="w-full max-w-sm">
                  <div className="flex justify-between text-xs mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                    <span style={{ color: '#00BFA5' }}>Strength {hybridData.liftPct}%</span>
                    <span style={{ color: '#C8102E' }}>Endurance {hybridData.runPct}%</span>
                  </div>
                  <div className="w-full h-4 rounded-full overflow-hidden flex" style={{ background: '#2E2E2E' }}>
                    <div style={{ width: `${hybridData.liftPct}%`, background: '#00BFA5', transition: 'width 0.5s' }} />
                    <div style={{ width: `${hybridData.runPct}%`, background: '#C8102E', transition: 'width 0.5s' }} />
                  </div>
                  <p className="text-xs text-center mt-3" style={{ color: '#A0A0A0', fontFamily: 'Inter, sans-serif' }}>
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
