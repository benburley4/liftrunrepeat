import Link from 'next/link'
import { Clock, Zap, TrendingUp, Pencil, Trash2 } from 'lucide-react'
import { Programme } from '@/lib/mockData'
import SessionTypeChip from './SessionTypeChip'
import WeekPreview from './WeekPreview'

interface ProgrammeCardProps {
  programme: Programme
  onEdit?: () => void
  onDelete?: () => void
  onStart?: () => void
}

const runVolumeLabels = { low: 'Low Km', medium: 'Med Km', high: 'High Km' }
const levelColors = { beginner: '#606060', intermediate: '#A0A0A0', advanced: '#F5F5F5' }

export default function ProgrammeCard({ programme, onEdit, onDelete, onStart }: ProgrammeCardProps) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4 transition-all hover:translate-y-[-2px]"
      style={{
        background: '#1A1A1A',
        border: '1px solid #2E2E2E',
        transition: 'transform 0.15s ease, border-color 0.15s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#3E3E3E')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#2E2E2E')}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3
            className="text-xl font-bold uppercase leading-tight"
            style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}
          >
            {programme.name}
          </h3>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: '#A0A0A0' }}>
            {programme.description}
          </p>
        </div>
        <SessionTypeChip type={programme.goalBias} size="xs" />
      </div>

      {/* Week preview */}
      <div>
        <p className="text-xs mb-2" style={{ color: '#606060' }}>Week Preview</p>
        <WeekPreview days={programme.weekPreview} />
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          <Zap size={12} style={{ color: '#00BFA5' }} />
          <span className="text-xs" style={{ color: '#A0A0A0' }}>{programme.liftDays} lift days</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp size={12} style={{ color: '#C8102E' }} />
          <span className="text-xs" style={{ color: '#A0A0A0' }}>{runVolumeLabels[programme.runVolume]}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={12} style={{ color: '#A0A0A0' }} />
          <span className="text-xs" style={{ color: '#A0A0A0' }}>{programme.durationWeeks} weeks</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs" style={{ color: levelColors[programme.level] }}>
            {programme.level.charAt(0).toUpperCase() + programme.level.slice(1)}
          </span>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {programme.tags.slice(0, 3).map(tag => (
          <span
            key={tag}
            className="px-2 py-0.5 rounded text-xs"
            style={{ background: '#242424', color: '#606060', border: '1px solid #2E2E2E', fontSize: '10px' }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Edit / Delete — only for custom programmes */}
      {(onEdit || onDelete) && (
        <div className="flex gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
              style={{ background: '#00BFA518', color: '#00BFA5', border: '1px solid #00BFA544', fontFamily: 'Inter, sans-serif' }}
            >
              <Pencil size={11} /> Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
              style={{ background: '#C8102E18', color: '#C8102E', border: '1px solid #C8102E44', fontFamily: 'Inter, sans-serif' }}
            >
              <Trash2 size={11} /> Delete
            </button>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-1">
        <Link
          href={`/programmes/${programme.id}`}
          className="flex-1 text-center py-2 rounded text-sm font-semibold transition-colors"
          style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #2E2E2E', fontFamily: 'Inter, sans-serif' }}
        >
          View Details
        </Link>
        <button
          onClick={onStart}
          className="flex-1 py-2 rounded text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: '#00BFA5', color: '#0D0D0D', fontFamily: 'Inter, sans-serif' }}
        >
          Start Programme
        </button>
      </div>
    </div>
  )
}
