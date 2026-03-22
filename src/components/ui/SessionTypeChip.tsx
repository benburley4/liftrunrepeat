import { cn } from '@/lib/utils'

interface SessionTypeChipProps {
  type: 'strength' | 'balanced' | 'endurance' | 'lift' | 'run' | 'hybrid'
  size?: 'xs' | 'sm'
}

const chipConfig = {
  strength: { label: 'Strength', bg: 'rgba(0,229,200,0.12)', color: '#00BFA5', border: 'rgba(0,229,200,0.3)' },
  balanced: { label: 'Balanced', bg: 'rgba(139,92,246,0.12)', color: '#A78BFA', border: 'rgba(139,92,246,0.3)' },
  endurance: { label: 'Endurance', bg: 'rgba(255,107,53,0.12)', color: '#C8102E', border: 'rgba(255,107,53,0.3)' },
  lift: { label: 'Lift', bg: 'rgba(0,229,200,0.12)', color: '#00BFA5', border: 'rgba(0,229,200,0.3)' },
  run: { label: 'Run', bg: 'rgba(255,107,53,0.12)', color: '#C8102E', border: 'rgba(255,107,53,0.3)' },
  hybrid: { label: 'Hybrid', bg: 'rgba(139,92,246,0.12)', color: '#A78BFA', border: 'rgba(139,92,246,0.3)' },
}

export default function SessionTypeChip({ type, size = 'sm' }: SessionTypeChipProps) {
  const config = chipConfig[type]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded font-semibold uppercase tracking-wider',
        size === 'xs' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      )}
      style={{
        background: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        fontSize: size === 'xs' ? '10px' : '11px',
        fontFamily: 'Inter, sans-serif',
        letterSpacing: '0.06em',
      }}
    >
      {config.label}
    </span>
  )
}
