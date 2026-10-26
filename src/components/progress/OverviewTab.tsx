'use client'

import { useMemo } from 'react'
import { Trophy, ChevronRight } from 'lucide-react'
import type { SessionData } from '@/lib/computeStats'
import { readinessDrivers, READINESS_CALL, readinessLevel, type WatchReadiness } from '@/lib/recovery'
import { activityKind, activityByBucket, sessionBreakdown, type OverviewStats, type PrEvent } from '@/lib/progressData'
import { shiftDays } from '@/lib/progressRange'
import ReadinessGauge from './ReadinessGauge'
import ActivityHeatmap from './ActivityHeatmap'
import BalanceRing from './BalanceRing'
import Donut from './Donut'
import { ChartCard } from './kit'
import { ACTIVITY_COLORS, ACTIVITY_LABELS, cardStyle, fmtLongDay } from './progressStyle'
import type { RangeCtx } from './types'

export default function OverviewTab({ history, ctx, overview, watchReadiness, readinessTrend, latestRecord, demo, onOpenDay }: {
  history: SessionData[]
  ctx: RangeCtx
  overview: OverviewStats
  watchReadiness: WatchReadiness | null
  readinessTrend: { date: string; value: number | null }[]
  latestRecord: PrEvent | null
  demo: boolean
  onOpenDay: (date: string, sessions: SessionData[]) => void
}) {
  const balance = useMemo(() => {
    const [all] = activityByBucket(history, [{ key: 'r', start: ctx.span.start, end: ctx.span.end, label: '' }], ctx.mults)
    return all
  }, [history, ctx.span, ctx.mults])
  const breakdown = useMemo(() => sessionBreakdown(history, ctx.span), [history, ctx.span])
  const recent = useMemo(() => {
    const from = shiftDays(ctx.today, -6)
    return history.filter(s => s.date >= from && s.date <= ctx.today).sort((a, b) => b.date.localeCompare(a.date))
  }, [history, ctx.today])

  const score = watchReadiness ? watchReadiness.score : overview.tsb
  const level = readinessLevel(score)
  const tone = { good: '#00BFA5', neutral: '#A0A0A0', poor: '#F59E0B' } as const

  return (
    <div className="space-y-6">
      {latestRecord && (
        <button type="button" onClick={() => { const s = history.find(h => h.savedAt === latestRecord.savedAt); if (s) ctx.openSession(s) }}
          className="w-full rounded-xl px-5 py-4 flex items-center gap-3 text-left lrr-reveal pr-row"
          style={{ background: 'rgba(200,16,46,0.08)', border: '1px solid rgba(200,16,46,0.25)', cursor: 'pointer' }}>
          <Trophy size={20} style={{ color: '#F59E0B', flexShrink: 0 }} aria-hidden="true" />
          <span className="flex-1 min-w-0">
            <span className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)', fontSize: 16 }}>LATEST RECORD: </span>
            <span className="text-sm" style={{ color: '#F5F5F5' }}>{latestRecord.name} — {latestRecord.value}</span>
            <span className="text-xs ml-2" style={{ color: 'var(--color-text-subtle)' }}>{fmtLongDay(latestRecord.date)} · +{latestRecord.pct}%</span>
          </span>
          <span className="px-2 py-1 rounded text-xs font-bold shrink-0" style={{ background: '#C8102E', color: '#0D0D0D' }}>PR</span>
        </button>
      )}

      <ReadinessGauge
        score={score}
        color={watchReadiness ? READINESS_CALL[level].color : score >= 65 ? '#00BFA5' : score >= 45 ? '#F59E0B' : '#C8102E'}
        call={watchReadiness ? READINESS_CALL[level].label : overview.readinessLabel}
        source={watchReadiness ? 'from your watch' : 'training-log estimate'}
        trend={readinessTrend}
        detailsHref={watchReadiness && !demo ? '/recovery' : undefined}>
        {watchReadiness
          ? <>
              {readinessDrivers(watchReadiness.day, []).map(d => (
                <span key={d.key} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: '#242424', border: `1px solid ${tone[d.status]}40` }}>
                  <span className="text-xs font-semibold" style={{ color: tone[d.status], fontFamily: 'var(--font-mono)' }}>{d.value}</span>
                  <span className="text-xs" style={{ color: '#A0A0A0' }}>{d.label} · {d.detail}</span>
                </span>
              ))}
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: '#242424', border: '1px solid #2E2E2E' }}>
                <span className="text-xs font-semibold" style={{ color: '#A0A0A0', fontFamily: 'var(--font-mono)' }}>{overview.tsb}%</span>
                <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>training-log estimate</span>
              </span>
            </>
          : overview.tsbFactors.map(f => (
              <span key={f.name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                style={{ background: f.points > 0 ? 'rgba(0,191,165,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${f.points > 0 ? 'rgba(0,191,165,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                <span className="text-xs font-semibold" style={{ color: f.points > 0 ? '#00BFA5' : '#EF4444', fontFamily: 'var(--font-mono)' }}>{f.points > 0 ? `+${f.points}` : f.points}</span>
                <span className="text-xs" style={{ color: '#A0A0A0' }}>{f.name}</span>
              </span>
            ))}
      </ReadinessGauge>

      <ChartCard title="Training Consistency" sub="Every training day, coloured by what you did. Hover a day for details; click to open it.">
        <ActivityHeatmap sessions={history} today={ctx.today} onOpenDay={onOpenDay} />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <ChartCard title="Hybrid Balance" sub={`Strength vs endurance sessions, ${ctx.label}`}>
          <BalanceRing strength={balance.strengthSessions} endurance={balance.enduranceSessions} />
        </ChartCard>
        <ChartCard title="Training Split" sub={`Sets by movement and body part, ${ctx.label}`}>
          {breakdown.hasData ? (
            <div className="flex flex-wrap gap-8">
              <Donut title="Push / Pull / Legs" slices={breakdown.pplSlices} />
              <Donut title="Body Part Split" slices={breakdown.bodySlices} />
            </div>
          ) : <p className="text-sm py-8 text-center" style={{ color: 'var(--color-text-subtle)' }}>No sessions in this range.</p>}
        </ChartCard>
      </div>

      {recent.length > 0 && (
        <section className="rounded-xl overflow-hidden lrr-reveal" style={cardStyle}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid #2E2E2E' }}>
            <h3 className="text-xl font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>Recent Sessions</h3>
          </div>
          {recent.map((s, i) => {
            const k = activityKind(s)
            const col = ACTIVITY_COLORS[k]
            return (
              <button key={s.savedAt} type="button" onClick={() => ctx.openSession(s)}
                className="w-full px-5 py-4 flex items-center gap-4 pr-row text-left"
                style={{ borderBottom: i < recent.length - 1 ? '1px solid #2E2E2E' : 'none', cursor: 'pointer' }}>
                <span className="w-2 h-10 rounded-full flex-shrink-0" style={{ background: col }} aria-hidden="true" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold uppercase truncate" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>{s.name}</span>
                  <span className="block text-xs mt-0.5" style={{ color: 'var(--color-text-subtle)' }}>
                    {new Date(`${s.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ background: `${col}22`, color: col }}>{ACTIVITY_LABELS[k]}</span>
                <ChevronRight size={14} style={{ color: '#606060' }} aria-hidden="true" />
              </button>
            )
          })}
        </section>
      )}
    </div>
  )
}
