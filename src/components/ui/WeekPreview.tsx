import { DayPreview } from '@/lib/mockData'
import { cn } from '@/lib/utils'

interface WeekPreviewProps {
  days: DayPreview[]
  size?: 'sm' | 'md'
}

const dayColors: Record<string, string> = {
  lift:   '#00BFA5',
  run:    '#C8102E',
  hybrid: 'linear-gradient(135deg, #00BFA5, #C8102E)',
  rest:   '#2E2E2E',
  physio: '#34D399',
}

const dayLabels: Record<string, string> = {
  lift:   'L',
  run:    'R',
  hybrid: 'H',
  rest:   '·',
  physio: 'P',
}

export default function WeekPreview({ days, size = 'sm' }: WeekPreviewProps) {
  const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
    <div className="flex gap-1">
      {days.map((day, i) => {
        const isGradient = day.type === 'hybrid'
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <div
              title={day.label}
              className={cn(
                'rounded flex items-center justify-center text-xs font-bold',
                size === 'sm' ? 'w-7 h-7' : 'w-9 h-9'
              )}
              style={{
                background: isGradient ? 'linear-gradient(135deg, #00BFA5, #C8102E)' : dayColors[day.type],
                color: day.type === 'rest' ? '#606060' : day.type === 'physio' ? '#0D0D0D' : '#0D0D0D',
                fontSize: size === 'sm' ? '9px' : '10px',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {dayLabels[day.type]}
            </div>
            <span
              className="text-center"
              style={{ color: '#606060', fontSize: '9px', fontFamily: 'Inter, sans-serif' }}
            >
              {dayNames[i]}
            </span>
          </div>
        )
      })}
    </div>
  )
}
