'use client'

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { analyticsData } from '@/lib/mockData'

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg p-3"
      style={{ background: '#242424', border: '1px solid #2E2E2E', fontFamily: 'Inter, sans-serif' }}
    >
      <p className="text-xs font-bold mb-2" style={{ color: '#F5F5F5' }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-xs" style={{ color: p.color }}>
          {p.name}: {p.value}{p.name.includes('RM') ? ' kg' : ' km'}
        </p>
      ))}
    </div>
  )
}

export default function InterferenceTrendChart() {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={analyticsData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" />
        <XAxis
          dataKey="week"
          stroke="#606060"
          tick={{ fill: '#606060', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
        />
        <YAxis
          yAxisId="left"
          stroke="#606060"
          tick={{ fill: '#606060', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
          domain={[90, 145]}
          label={{ value: 'Squat 1RM (kg)', angle: -90, position: 'insideLeft', fill: '#606060', fontSize: 11 }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="#606060"
          tick={{ fill: '#606060', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
          domain={[0, 80]}
          label={{ value: 'Weekly Km', angle: 90, position: 'insideRight', fill: '#606060', fontSize: 11 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#A0A0A0' }}
        />
        <Bar yAxisId="right" dataKey="weeklyKm" name="Weekly Km" fill="#C8102E" opacity={0.5} radius={[2, 2, 0, 0]} />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="squatRM"
          name="Squat 1RM"
          stroke="#00BFA5"
          strokeWidth={2.5}
          dot={{ fill: '#00BFA5', r: 3 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
