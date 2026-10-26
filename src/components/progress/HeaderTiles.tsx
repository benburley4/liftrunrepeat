'use client'

import type { LucideIcon } from 'lucide-react'
import { Activity, TrendingUp, Zap, Trophy, ChevronRight } from 'lucide-react'
import CountUp from '@/components/ui/CountUp'
import Sparkline from './Sparkline'
import { ACTIVITY_COLORS } from './progressStyle'

export interface HeaderTile {
  id: string
  label: string
  value: string
  sub: string
  accent: string
  icon: LucideIcon
  spark: (number | null)[]
  sparkKind?: 'line' | 'bars'
  sparkLabel: string
  action: string
  onClick: () => void
}

export function buildHeaderTiles(p: {
  sessionsThisWeek: number; sessionDiff: number; kmThisWeek: number; totalVolume: number
  readiness: { value: string; sub: string; color: string; source: 'watch' | 'log' }
  spark: { sessions: number[]; km: number[]; volume: number[]; readiness: (number | null)[] }
  go: (target: 'history' | 'running' | 'strength' | 'readiness') => void
}): HeaderTile[] {
  return [
    {
      id: 'sessions', label: 'Sessions This Week', value: String(p.sessionsThisWeek), icon: Activity, accent: '#F5F5F5',
      sub: p.sessionDiff === 0 ? 'same as last week' : `${p.sessionDiff > 0 ? '+' : ''}${p.sessionDiff} vs last week`,
      spark: p.spark.sessions, sparkKind: 'bars', sparkLabel: 'Sessions per week, last 12 weeks',
      action: 'Open History', onClick: () => p.go('history'),
    },
    {
      id: 'km', label: 'Km This Week', value: String(p.kmThisWeek || 0), icon: TrendingUp, accent: ACTIVITY_COLORS.run,
      sub: 'runs + hikes', spark: p.spark.km, sparkKind: 'bars', sparkLabel: 'Km on foot per week, last 12 weeks',
      action: 'Open On Foot', onClick: () => p.go('running'),
    },
    {
      id: 'volume', label: 'Total Volume', icon: Zap, accent: ACTIVITY_COLORS.lift,
      value: p.totalVolume >= 1000 ? `${(p.totalVolume / 1000).toFixed(1)}k` : String(p.totalVolume),
      sub: 'kg lifted all time', spark: p.spark.volume, sparkKind: 'bars', sparkLabel: 'Kg lifted per week, last 12 weeks',
      action: 'Open Strength', onClick: () => p.go('strength'),
    },
    {
      id: 'readiness', label: p.readiness.source === 'watch' ? 'Readiness · Watch' : 'Readiness Score', icon: Trophy,
      accent: p.readiness.color, value: p.readiness.value, sub: p.readiness.sub,
      spark: p.spark.readiness, sparkLabel: 'Readiness, last 14 days',
      action: 'See readiness', onClick: () => p.go('readiness'),
    },
  ]
}

export default function HeaderTiles({ tiles }: { tiles: HeaderTile[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {tiles.map(t => {
        const Icon = t.icon
        return (
          <button key={t.id} type="button" onClick={t.onClick} aria-label={`${t.label}: ${t.value}. ${t.action}`}
            className="lrr-tile rounded-xl p-4 text-left group"
            style={{ background: '#1A1A1A', border: '1px solid #2E2E2E', cursor: 'pointer' }}>
            <div className="flex items-center justify-between mb-2 gap-2">
              <span className="text-xs uppercase tracking-wider truncate" style={{ color: 'var(--color-text-subtle)' }}>{t.label}</span>
              <Icon size={14} style={{ color: t.accent, flexShrink: 0 }} aria-hidden="true" />
            </div>
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <div className="text-2xl font-bold" style={{ color: t.accent, fontFamily: 'var(--font-mono)' }}>
                  <CountUp value={t.value} duration={900} />
                </div>
                <div className="text-xs mt-1 truncate" style={{ color: 'var(--color-text-subtle)' }}>{t.sub}</div>
              </div>
              <div className="shrink-0 hidden min-[380px]:block">
                <Sparkline values={t.spark} color={t.accent === '#F5F5F5' ? '#A0A0A0' : t.accent} width={72} height={30} kind={t.sparkKind} label={t.sparkLabel} />
              </div>
            </div>
            <div className="flex items-center gap-0.5 mt-2 text-xs lrr-tile-action" style={{ color: '#6B6B6B' }} aria-hidden="true">
              {t.action} <ChevronRight size={12} />
            </div>
          </button>
        )
      })}
    </div>
  )
}
