'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getSessions, upsertSession, deleteSession as dbDeleteSession, getCoachReports, deleteCoachReport, getSetting, upsertSetting, getZeppDaily, getZeppRoutes, type CoachReport } from '@/lib/db'
import { freshWatchReadiness, localToday, READINESS_CALL, type ZeppDay } from '@/lib/recovery'
import { assessLoad } from '@/lib/activity'
import { useVolumeMultipliers } from '@/lib/useExerciseLoad'
import { getBwOverrides, type BwOverrides } from '@/lib/bodyweight'
import type { SessionData } from '@/lib/computeStats'
import type { LatLon } from '@/lib/zeppSeries'
import {
  computeOverviewStats, computeProgressStats, exerciseAnalysis, activityByBucket, prEvents,
  logReadinessTrend, watchReadinessTrend,
} from '@/lib/progressData'
import { DEFAULT_RANGE, isRangeId, rangeBuckets, previousBuckets, bucketSpan, bucketTitle, rangeLabel, type Bucket, type RangeId } from '@/lib/progressRange'
import { demoSessions, demoZeppDaily, demoRoutes, demoCoachReports, DEMO_BODYWEIGHT } from '@/lib/demoData'
import QuickLogFAB from '@/components/log/QuickLogFAB'
import HeaderTiles, { buildHeaderTiles } from '@/components/progress/HeaderTiles'
import ProgressPanel from '@/components/progress/ProgressPanel'
import TabBar from '@/components/progress/TabBar'
import SessionsDrawer from '@/components/progress/SessionsDrawer'
import Celebration from '@/components/progress/Celebration'
import DemoBanner from '@/components/progress/DemoBanner'
import OverviewTab from '@/components/progress/OverviewTab'
import WeeklyReviewTab from '@/components/progress/WeeklyReviewTab'
import RecordsTab from '@/components/progress/RecordsTab'
import HistoryTab from '@/components/progress/HistoryTab'
import StrengthTab from '@/components/progress/StrengthTab'
import OnFootTab from '@/components/progress/OnFootTab'
import StepsTab from '@/components/progress/StepsTab'
import HybridTab from '@/components/progress/HybridTab'
import { TABS, isTabId, type RangeCtx, type TabId } from '@/components/progress/types'

/** Tabs whose charts follow the date range (others hide the range control). */
const RANGED: TabId[] = ['overview', 'prs', 'strength', 'running', 'steps', 'hybrid']

function readUrl() {
  const p = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
  const tab = p.get('tab'), range = p.get('range')
  return {
    tab: isTabId(tab) ? tab : 'overview' as TabId,
    range: isRangeId(range) ? range : DEFAULT_RANGE,
    compare: p.get('compare') === '1',
  }
}

function writeUrl(next: { tab: TabId; range: RangeId; compare: boolean }, push: boolean) {
  const p = new URLSearchParams(window.location.search)
  if (next.tab === 'overview') p.delete('tab'); else p.set('tab', next.tab)
  if (next.range === DEFAULT_RANGE) p.delete('range'); else p.set('range', next.range)
  if (next.compare && next.range !== 'all') p.set('compare', '1'); else p.delete('compare')
  const q = p.toString()
  const url = `${window.location.pathname}${q ? `?${q}` : ''}`
  if (url === `${window.location.pathname}${window.location.search}`) return
  window.history[push ? 'pushState' : 'replaceState'](window.history.state, '', url)
}

export default function ProgressPage() {
  const { user } = useAuth()
  const demo = !user
  const [today] = useState(() => localToday())
  const mults = useVolumeMultipliers()

  const [initial] = useState(readUrl)
  const [tab, setTab] = useState<TabId>(initial.tab)
  const [range, setRange] = useState<RangeId>(initial.range)
  const [compare, setCompare] = useState(initial.compare)

  // Real data (signed in). Demo data is derived below and never stored here.
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [zepp, setZepp] = useState<ZeppDay[]>([])
  const [routesReal, setRoutesReal] = useState<Record<string, LatLon[]>>({})
  const [reportsReal, setReportsReal] = useState<CoachReport[]>([])
  const [bodyweightReal, setBodyweightReal] = useState(75)
  const [bwOverrides, setBwOverrides] = useState<BwOverrides>({})

  const [selected, setSelected] = useState<SessionData | null>(null)
  const [returnTab, setReturnTab] = useState<TabId | null>(null)
  const [drawer, setDrawer] = useState<{ title: string; subtitle?: string; sessions: SessionData[] } | null>(null)

  useEffect(() => {
    if (demo) return
    getSessions().then(raw => setSessions(raw as unknown as SessionData[])).catch(console.error)
    getZeppDaily().then(setZepp).catch(() => { /* no watch data: the log-based estimate is used */ })
    getZeppRoutes().then(setRoutesReal).catch(() => {})
    getCoachReports().then(setReportsReal).catch(() => { /* table may not exist yet */ })
    getSetting('bodyweight_kg').then(v => { const n = parseFloat(v ?? ''); if (n > 0) setBodyweightReal(n) }).catch(() => {})
    getBwOverrides().then(setBwOverrides).catch(() => {})
  }, [demo])

  const demoData = useMemo(() => {
    if (!demo) return null
    const s = demoSessions(today)
    return { sessions: s, zepp: demoZeppDaily(today, s), routes: demoRoutes(s), reports: demoCoachReports(today) }
  }, [demo, today])

  const history = demoData?.sessions ?? sessions
  const zeppRows = demoData?.zepp ?? zepp
  const routes = demoData?.routes ?? routesReal
  const reports = demoData?.reports ?? reportsReal
  const bodyweight = demo ? DEMO_BODYWEIGHT : bodyweightReal

  // ── URL ⇄ state (tab is a history entry; range/compare replace it) ──
  useEffect(() => {
    const onPop = () => { const u = readUrl(); setTab(u.tab); setRange(u.range); setCompare(u.compare); setSelected(null); setDrawer(null) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const goTab = useCallback((t: TabId, opts?: { keepSelection?: boolean }) => {
    setTab(t)
    if (!opts?.keepSelection) { setSelected(null); setReturnTab(null) }
    writeUrl({ tab: t, range, compare }, true)
  }, [range, compare])

  function changeRange(r: RangeId) { setRange(r); writeUrl({ tab, range: r, compare }, false) }
  function changeCompare(c: boolean) { setCompare(c); writeUrl({ tab, range, compare: c }, false) }

  // ── Derived data ──
  const firstDate = useMemo(() => history.reduce<string | null>((m, s) => (!m || s.date < m ? s.date : m), null), [history])
  const buckets = useMemo(() => rangeBuckets(range, today, firstDate), [range, today, firstDate])
  const prev = useMemo(() => previousBuckets(buckets), [buckets])
  const span = useMemo(() => bucketSpan(buckets) ?? { start: today, end: today }, [buckets, today])

  const overview = useMemo(() => computeOverviewStats(history, mults, today), [history, mults, today])
  const progress = useMemo(() => computeProgressStats(history, mults, today), [history, mults, today])
  const analysis = useMemo(() => exerciseAnalysis(history, bodyweight, bwOverrides, today), [history, bodyweight, bwOverrides, today])
  const watchReadiness = useMemo(() => freshWatchReadiness(zeppRows, today), [zeppRows, today])
  const readinessTrend = useMemo(() => (watchReadiness ? watchReadinessTrend(zeppRows, today) : logReadinessTrend(history, mults, today)), [watchReadiness, zeppRows, history, mults, today])
  const latestRecord = useMemo(() => prEvents(history).at(-1) ?? null, [history])
  const spark = useMemo(() => {
    const b = activityByBucket(history, rangeBuckets('12w', today), mults)
    return { sessions: b.map(x => x.sessions), km: b.map(x => x.km), volume: b.map(x => x.lift), readiness: readinessTrend.map(t => t.value) }
  }, [history, today, mults, readinessTrend])

  // ── Navigation helpers ──
  const openSession = useCallback((s: SessionData) => {
    setDrawer(null)
    setReturnTab(tab === 'history' ? null : tab)
    setSelected(s)
    setTab('history')
    writeUrl({ tab: 'history', range, compare }, true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [tab, range, compare])

  const openBucket = useCallback((b: Bucket) => {
    setDrawer({ title: bucketTitle(b), subtitle: 'Sessions', sessions: history.filter(s => s.date >= b.start && s.date < b.end) })
  }, [history])

  const openDay = useCallback((date: string, list: SessionData[]) => {
    if (list.length === 1) { openSession(list[0]); return }
    setDrawer({ title: new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }), subtitle: 'Sessions', sessions: list })
  }, [openSession])

  const ctx: RangeCtx = useMemo(() => ({
    range, compare: compare && range !== 'all', buckets, prev, span, today,
    label: range === 'all' ? 'all time' : `last ${rangeLabel(range)}`,
    mults, openBucket, openSession,
  }), [range, compare, buckets, prev, span, today, mults, openBucket, openSession])

  // ── Mutations (signed-in only) ──
  async function saveSession(edited: SessionData) {
    await upsertSession(edited as unknown as Parameters<typeof upsertSession>[0]).catch(console.error)
    setSessions(h => h.map(s => (s.savedAt === edited.savedAt ? edited : s)))
    setSelected(edited)
  }
  async function deleteSession(savedAt: string) {
    await dbDeleteSession(savedAt).catch(console.error)
    setSessions(h => h.filter(s => s.savedAt !== savedAt))
    if (selected?.savedAt === savedAt) setSelected(null)
  }
  async function deleteReport(id: string) {
    await deleteCoachReport(id).catch(console.error)
    setReportsReal(r => r.filter(x => x.id !== id))
  }
  function commitBodyweight(v: number) {
    const kg = isNaN(v) ? 95 : Math.min(250, Math.max(30, v))
    if (demo) return
    setBodyweightReal(kg)
    upsertSetting('bodyweight_kg', String(kg)).catch(() => {})
  }

  // ── Swipe between tabs on touch screens ──
  const touch = useRef<{ x: number; y: number; t: number } | null>(null)
  function onTouchStart(e: React.TouchEvent) {
    const target = e.target as HTMLElement
    if (target.closest('[data-noswipe], input, textarea, select, .leaflet-container')) { touch.current = null; return }
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
  }
  function onTouchEnd(e: React.TouchEvent) {
    const s = touch.current
    touch.current = null
    if (!s || selected || drawer) return
    const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y
    if (Math.abs(dx) < 70 || Math.abs(dy) > 45 || Date.now() - s.t > 600) return
    const i = TABS.findIndex(t => t.id === tab)
    const next = TABS[i + (dx < 0 ? 1 : -1)]
    if (next) { goTab(next.id); window.scrollTo({ top: 0 }) }
  }

  const load = assessLoad(zeppRows, today, overview.overtrained)
  const loadLook = load && load.kind !== 'none' ? {
    warn: { color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)', title: 'HIGH LOAD WARNING', icon: '⚠', tail: ' Consider dropping 1–2 sessions or swapping intensity for Zone 2 until readiness recovers.' },
    coping: { color: '#00BFA5', bg: 'rgba(0,191,165,0.06)', border: 'rgba(0,191,165,0.25)', title: 'LOAD UP — RECOVERING WELL', icon: '✓', tail: ' Keep an eye on readiness over the next few days.' },
    'recovery-low': { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)', title: 'RECOVERY DOWN', icon: '!', tail: '' },
  }[load.kind] : null

  const tiles = buildHeaderTiles({
    ...overview,
    readiness: watchReadiness
      ? { value: `${watchReadiness.score} ${watchReadiness.trend}`, sub: READINESS_CALL[watchReadiness.level].label, color: READINESS_CALL[watchReadiness.level].color, source: 'watch' }
      : { value: `${overview.tsb}% ${overview.readinessTrend}`, sub: overview.readinessLabel, color: overview.tsb >= 65 ? '#00BFA5' : overview.tsb >= 45 ? '#F59E0B' : '#C8102E', source: 'log' },
    spark,
    go: target => {
      if (target === 'readiness') {
        goTab('overview')
        setTimeout(() => document.getElementById('readiness')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
      } else goTab(target)
    },
  })

  return (
    <div style={{ background: '#0D0D0D', minHeight: '100vh' }}>
      {!demo && <QuickLogFAB />}
      <Celebration record={latestRecord} today={today} />

      <div className="pt-16 pb-6" style={{ background: '#0A0A0A', borderBottom: '1px solid #1A1A1A' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#00BFA5' }}>{demo ? 'Demo dashboard' : 'Dashboard'}</p>
          <h1 className="text-5xl font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>Progress</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        {demo && <DemoBanner />}
        <HeaderTiles tiles={tiles} />
        {progress && <ProgressPanel stats={progress} />}

        {loadLook && load && load.kind !== 'none' && (
          <div className="rounded-xl px-5 py-3 flex items-center gap-3 mb-2" role="status" style={{ background: loadLook.bg, border: `1px solid ${loadLook.border}` }}>
            <span style={{ fontSize: 18, color: loadLook.color }} aria-hidden="true">{loadLook.icon}</span>
            <p>
              <span className="text-sm font-bold" style={{ color: loadLook.color, fontFamily: 'var(--font-heading)' }}>{loadLook.title}</span>
              <span className="text-xs ml-2" style={{ color: '#A0A0A0' }}>{load.reason.charAt(0).toUpperCase() + load.reason.slice(1)}.{loadLook.tail}</span>
            </p>
          </div>
        )}
        {overview.overtrained && !load && (
          <div className="rounded-xl px-5 py-3 flex items-center gap-3 mb-2" role="status" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <span style={{ fontSize: 18 }} aria-hidden="true">⚠</span>
            <p>
              <span className="text-sm font-bold" style={{ color: '#EF4444', fontFamily: 'var(--font-heading)' }}>HIGH LOAD WARNING</span>
              <span className="text-xs ml-2" style={{ color: '#A0A0A0' }}>This week&apos;s volume is &gt;30% above last week — injury risk is elevated. Consider dropping 1–2 sessions or reducing intensity.</span>
            </p>
          </div>
        )}
      </div>

      <TabBar active={tab} onTab={t => goTab(t)} range={range} onRange={changeRange} compare={compare} onCompare={changeCompare}
        showRange={RANGED.includes(tab) && !(tab === 'history' && selected)} />

      <div id="progress-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} key={tab}
        className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lrr-panel" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {tab === 'overview' && (
          <OverviewTab history={history} ctx={ctx} overview={overview} watchReadiness={watchReadiness} readinessTrend={readinessTrend}
            latestRecord={latestRecord} demo={demo} onOpenDay={openDay} />
        )}
        {tab === 'ai-coach' && <WeeklyReviewTab history={history} ctx={ctx} reports={reports} demo={demo} onDeleteReport={deleteReport} />}
        {tab === 'prs' && <RecordsTab history={history} ctx={ctx} analysis={analysis} />}
        {tab === 'history' && (
          <HistoryTab history={history} selected={selected} analysis={analysis} bodyweight={bodyweight} mults={mults} demo={demo}
            onBodyweight={commitBodyweight} onOpen={openSession} onSave={saveSession} onDelete={deleteSession}
            onBack={() => {
              setSelected(null)
              if (returnTab) { const t = returnTab; setReturnTab(null); goTab(t) }
            }} />
        )}
        {tab === 'strength' && <StrengthTab history={history} ctx={ctx} analysis={analysis} />}
        {tab === 'running' && <OnFootTab sessions={history} ctx={ctx} routes={routes} />}
        {tab === 'steps' && <StepsTab rows={zeppRows} sessions={history} ctx={ctx} />}
        {tab === 'hybrid' && <HybridTab history={history} ctx={ctx} />}
      </div>

      {drawer && (
        <SessionsDrawer title={drawer.title} subtitle={drawer.subtitle} sessions={drawer.sessions} mults={mults}
          onClose={() => setDrawer(null)} onOpenSession={openSession} />
      )}
    </div>
  )
}
