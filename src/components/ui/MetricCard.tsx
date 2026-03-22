import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string
  subtext?: string
  accent?: 'teal' | 'orange' | 'purple' | 'neutral'
  icon?: LucideIcon
  className?: string
}

const accentColors = {
  teal: '#00BFA5',
  orange: '#C8102E',
  purple: '#A78BFA',
  neutral: '#A0A0A0',
}

export default function MetricCard({ label, value, subtext, accent = 'teal', icon: Icon, className }: MetricCardProps) {
  const color = accentColors[accent]

  return (
    <div
      className={cn('rounded-xl p-5 flex flex-col gap-2', className)}
      style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
          {label}
        </span>
        {Icon && <Icon size={16} style={{ color }} />}
      </div>
      <div
        className="text-3xl font-bold"
        style={{ color, fontFamily: 'JetBrains Mono, monospace' }}
      >
        {value}
      </div>
      {subtext && (
        <div className="text-xs" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
          {subtext}
        </div>
      )}
    </div>
  )
}
