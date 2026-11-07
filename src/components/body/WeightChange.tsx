'use client'

import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import Card from '@/components/ui/Card'
import StatTile from '@/components/ui/StatTile'
import { chartTooltipStyle, axisProps } from '@/components/recovery/chartStyle'
import type { Trend } from '@/lib/bodyComp'

// Same validated polarity pair as the deficit chart (dark #141414).
const LOSS = '#00A893'
const GAIN = '#D9474C'

const sub = 'var(--color-text-subtle)'
export const signed = (n: number, digits: number) => `${n > 0 ? '+' : ''}${n.toFixed(digits)}`

/**
 * Direction of a metric across the range. Neutral colours on purpose: up is good
 * for muscle and bad for fat, so the word and arrow carry the meaning.
 */
export function TrendBadge({ trend, unit, digits }: { trend: Trend | null; unit: string; digits: number }) {
  if (!trend) return null
  const Icon = trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus
  const word = trend.direction === 'up' ? 'Increasing' : trend.direction === 'down' ? 'Decreasing' : 'Steady'
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap" style={{ color: '#F5F5F5' }}>
      <Icon size={13} aria-hidden="true" style={{ color: '#A0A0A0' }} />
      {word}
      {trend.direction !== 'flat' && <span className="font-normal" style={{ color: '#A0A0A0' }}>{signed(trend.perWeek, digits)}{unit}/wk</span>}
    </span>
  )
}

export default function WeightChange({ weight, fat, fatFree, lowest, highest, bars, period }: {
  weight: Trend | null
  fat: Trend | null
  fatFree: Trend | null
  lowest: number | null
  highest: number | null
  bars: { label: string; changeKg: number; date: string }[]
  period: 'week' | 'month'
}) {
  const headline = weight?.direction === 'down' ? 'Lost (kg)' : weight?.direction === 'up' ? 'Gained (kg)' : 'Steady (kg)'
  return (
    <section className="space-y-3">
      <p className="text-xs uppercase tracking-widest" style={{ color: '#00BFA5' }}>Weight loss &amp; gain</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatTile value={weight ? Math.abs(weight.total).toFixed(1) : '—'} label={weight ? headline : 'Change (kg)'} animate={false} />
        <StatTile value={weight ? signed(weight.perWeek, 2) : '—'} label="Per week (kg)" animate={false} />
        <StatTile value={fat ? signed(fat.total, 1) : '—'} label="Fat (kg)" animate={false} />
        <StatTile value={fatFree ? signed(fatFree.total, 1) : '—'} label="Fat-free (kg)" animate={false} />
        <StatTile value={lowest != null ? lowest.toFixed(1) : '—'} label="Lowest (kg)" animate={false} />
        <StatTile value={highest != null ? highest.toFixed(1) : '—'} label="Highest (kg)" animate={false} />
      </div>
      <p className="text-xs" style={{ color: sub }}>
        Changes follow the best-fit line across the selected range, so one heavy or light morning doesn&apos;t swing them.
      </p>

      {bars.length > 0 && (
        <Card hover={false}>
          <p className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>Change each {period}</p>
          <p className="text-xs mb-4" style={{ color: sub }}>
            Average weight against the {period} before, in kg. Below zero is a loss, above is a gain. The latest {period} may still be in progress.
          </p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bars} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="#1E1E1E" vertical={false} />
                <XAxis dataKey="label" {...axisProps} minTickGap={24} />
                <YAxis {...axisProps} width={48} tickFormatter={v => Number(v).toFixed(1)} />
                <ReferenceLine y={0} stroke="#606060" />
                <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  formatter={v => [`${Math.abs(Number(v)).toFixed(1)} kg`, Number(v) <= 0 ? 'Lost' : 'Gained']} />
                <Bar dataKey="changeKg" name="Change" radius={4} maxBarSize={18} isAnimationActive={false}>
                  {bars.map(b => <Cell key={b.date} fill={b.changeKg <= 0 ? LOSS : GAIN} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </section>
  )
}
