'use client'

import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import { Zap, CircleCheck, Leaf, BedDouble, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import Card from '@/components/ui/Card'
import StatTile from '@/components/ui/StatTile'
import { READINESS_CALL, readinessLevel, readinessDrivers, latestReadiness, lastDays, ZeppDay, DriverStatus } from '@/lib/recovery'
import { chartTooltipStyle, fmtDay } from './chartStyle'

const LEVEL_ICON = { go: Zap, planned: CircleCheck, easy: Leaf, rest: BedDouble }

const STATUS: Record<DriverStatus, { color: string; icon: typeof Minus; label: string }> = {
  good:    { color: '#00BFA5', icon: ArrowUpRight,   label: 'Helping' },
  neutral: { color: '#A0A0A0', icon: Minus,          label: 'Normal' },
  poor:    { color: '#F59E0B', icon: ArrowDownRight, label: 'Dragging' },
}

export default function ReadinessToday({ rows, today }: { rows: ZeppDay[]; today: string }) {
  const day = latestReadiness(rows)
  if (!day || day.readiness == null) return null

  const level = readinessLevel(day.readiness)
  const call = READINESS_CALL[level]
  const Icon = LEVEL_ICON[level]
  const drivers = readinessDrivers(day, rows)
  const week = lastDays(rows, 7, day.date).filter(r => r.readiness != null)
  const isToday = day.date === today

  return (
    <Card padding="lg" hover={false}>
      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Score + call */}
        <div>
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-subtle)' }}>
            Readiness · {isToday ? 'today' : fmtDay(day.date)}
          </p>
          <div className="flex items-end gap-4">
            <span className="text-7xl font-black leading-none" style={{ fontFamily: 'var(--font-mono)', color: '#F5F5F5' }}>
              {Math.round(day.readiness)}
            </span>
            <div className="h-14 flex-1 min-w-0" aria-label="Readiness over the last 7 days">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={week} margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip {...chartTooltipStyle} labelFormatter={(_, p) => (p?.[0] ? fmtDay(p[0].payload.date) : '')} formatter={(v: unknown) => [v as number, 'Readiness']} />
                  <Line isAnimationActive={false} type="monotone" dataKey="readiness" stroke="#00BFA5" strokeWidth={2} dot={{ r: 3, fill: '#00BFA5' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div
            className="mt-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5"
            style={{ background: `${call.color}1A`, border: `1px solid ${call.color}40` }}
          >
            <Icon size={16} color={call.color} aria-hidden="true" />
            <span className="text-sm font-bold" style={{ color: '#F5F5F5' }}>{call.label}</span>
          </div>
          <p className="mt-3 text-sm" style={{ color: '#A0A0A0' }}>{call.advice}</p>
          {!isToday && (
            <p className="mt-2 text-xs" style={{ color: 'var(--color-text-subtle)' }}>
              Today&apos;s score appears once last night&apos;s sleep has synced.
            </p>
          )}
        </div>

        {/* Drivers */}
        <div>
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-subtle)' }}>What&apos;s driving it</p>
          <ul className="space-y-2">
            {drivers.map(d => {
              const s = STATUS[d.status]
              const SIcon = s.icon
              return (
                <li key={d.key} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: '#1E1E1E', border: '1px solid #2E2E2E' }}>
                  <SIcon size={18} color={s.color} aria-label={s.label} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold" style={{ color: '#F5F5F5' }}>{d.label}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{d.detail}</p>
                  </div>
                  <span className="text-lg font-bold" style={{ fontFamily: 'var(--font-mono)', color: '#F5F5F5' }}>{d.value}</span>
                </li>
              )
            })}
          </ul>
          {(day.physical_readiness != null || day.mental_readiness != null) && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              {day.physical_readiness != null && <StatTile value={Math.round(day.physical_readiness)} label="Physical readiness" />}
              {day.mental_readiness != null && <StatTile value={Math.round(day.mental_readiness)} label="Mental readiness" />}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
