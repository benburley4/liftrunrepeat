'use client'

import { useState } from 'react'
import { Plus, Trash2, ChevronDown, X } from 'lucide-react'
import { exercises } from '@/lib/mockData'
import { cn } from '@/lib/utils'

interface SetRow {
  weight: string
  reps: string
  rpe: string
}

interface ExerciseBlock {
  id: number
  exerciseId: string
  exerciseName: string
  sets: SetRow[]
}

function epley1RM(weight: number, reps: number): number {
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30))
}

function platesNeeded(target: number): { plates: number[]; remainder: number } {
  const barWeight = 20
  const available = [25, 20, 15, 10, 5, 2.5, 1.25]
  let remaining = (target - barWeight) / 2
  const plates: number[] = []
  for (const p of available) {
    while (remaining >= p) {
      plates.push(p)
      remaining -= p
    }
  }
  return { plates, remainder: Math.round(remaining * 4) / 4 }
}

interface PlateModalProps {
  weight: number
  onClose: () => void
}

function PlateModal({ weight, onClose }: PlateModalProps) {
  const { plates } = platesNeeded(weight)
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-6 max-w-sm w-full"
        style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
            Plate Calculator — {weight} kg
          </h3>
          <button onClick={onClose}><X size={18} style={{ color: '#606060' }} /></button>
        </div>
        <p className="text-xs mb-3" style={{ color: '#A0A0A0' }}>20 kg barbell + per side:</p>
        <div className="flex flex-wrap gap-2">
          {plates.length === 0 ? (
            <span className="text-sm" style={{ color: '#606060' }}>Just the bar</span>
          ) : (
            plates.map((p, i) => (
              <div
                key={i}
                className="px-3 py-1.5 rounded font-mono text-sm font-bold"
                style={{
                  background: p >= 20 ? 'rgba(0,229,200,0.15)' : p >= 10 ? 'rgba(255,107,53,0.15)' : '#242424',
                  color: p >= 20 ? '#00BFA5' : p >= 10 ? '#C8102E' : '#A0A0A0',
                  border: '1px solid #2E2E2E',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {p} kg
              </div>
            ))
          )}
        </div>
        <p className="text-xs mt-3" style={{ color: '#606060' }}>
          Total: {plates.reduce((a, b) => a + b, 0) * 2 + 20} kg loaded
        </p>
      </div>
    </div>
  )
}

export default function LiftLogger() {
  const [exerciseBlocks, setExerciseBlocks] = useState<ExerciseBlock[]>([
    {
      id: 1,
      exerciseId: 'squat',
      exerciseName: 'Back Squat',
      sets: [
        { weight: '315', reps: '5', rpe: '8' },
        { weight: '315', reps: '5', rpe: '8' },
        { weight: '315', reps: '5', rpe: '9' },
      ],
    },
  ])
  const [searchTerm, setSearchTerm] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [plateModal, setPlateModal] = useState<number | null>(null)

  const filteredExercises = exercises.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const addExercise = (ex: typeof exercises[0]) => {
    setExerciseBlocks(prev => [
      ...prev,
      {
        id: Date.now(),
        exerciseId: ex.id,
        exerciseName: ex.name,
        sets: [{ weight: '', reps: '', rpe: '' }],
      },
    ])
    setShowSearch(false)
    setSearchTerm('')
  }

  const addSet = (blockId: number) => {
    setExerciseBlocks(prev =>
      prev.map(b =>
        b.id === blockId
          ? { ...b, sets: [...b.sets, { weight: b.sets.at(-1)?.weight || '', reps: b.sets.at(-1)?.reps || '', rpe: '' }] }
          : b
      )
    )
  }

  const updateSet = (blockId: number, setIdx: number, field: keyof SetRow, value: string) => {
    setExerciseBlocks(prev =>
      prev.map(b =>
        b.id === blockId
          ? {
              ...b,
              sets: b.sets.map((s, i) => (i === setIdx ? { ...s, [field]: value } : s)),
            }
          : b
      )
    )
  }

  const removeBlock = (blockId: number) => {
    setExerciseBlocks(prev => prev.filter(b => b.id !== blockId))
  }

  const removeSet = (blockId: number, setIdx: number) => {
    setExerciseBlocks(prev =>
      prev.map(b =>
        b.id === blockId ? { ...b, sets: b.sets.filter((_, i) => i !== setIdx) } : b
      )
    )
  }

  return (
    <div className="space-y-4">
      {plateModal !== null && (
        <PlateModal weight={plateModal} onClose={() => setPlateModal(null)} />
      )}

      {/* Exercise search */}
      {showSearch && (
        <div
          className="rounded-xl p-4"
          style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}
        >
          <input
            type="text"
            placeholder="Search exercises..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 rounded text-sm outline-none"
            style={{ background: '#242424', color: '#F5F5F5', border: '1px solid #2E2E2E', fontFamily: 'Inter, sans-serif' }}
            autoFocus
          />
          <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
            {filteredExercises.map(ex => (
              <button
                key={ex.id}
                onClick={() => addExercise(ex)}
                className="w-full text-left px-3 py-2 rounded text-sm hover:bg-base-elevated flex items-center justify-between"
                style={{ color: '#F5F5F5', fontFamily: 'Inter, sans-serif' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span>{ex.name}</span>
                <span className="text-xs capitalize" style={{ color: '#606060' }}>{ex.category}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Exercise blocks */}
      {exerciseBlocks.map((block) => {
        const maxRM = block.sets.reduce((best, s) => {
          const w = parseFloat(s.weight)
          const r = parseInt(s.reps)
          if (!isNaN(w) && !isNaN(r) && r > 0) {
            return Math.max(best, epley1RM(w, r))
          }
          return best
        }, 0)

        return (
          <div
            key={block.id}
            className="rounded-xl overflow-hidden"
            style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}
          >
            {/* Exercise header */}
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: '1px solid #2E2E2E', background: '#242424' }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: '#00BFA5' }} />
                <span
                  className="font-bold text-sm"
                  style={{ color: '#F5F5F5', fontFamily: 'Montserrat, sans-serif', fontSize: '16px' }}
                >
                  {block.exerciseName.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {maxRM > 0 && (
                  <span className="text-xs" style={{ color: '#00BFA5', fontFamily: 'JetBrains Mono, monospace' }}>
                    Est. 1RM: {maxRM} kg
                  </span>
                )}
                <button onClick={() => removeBlock(block.id)}>
                  <Trash2 size={14} style={{ color: '#606060' }} />
                </button>
              </div>
            </div>

            {/* Sets table */}
            <div className="p-4">
              <div className="grid grid-cols-4 gap-2 mb-2">
                <span className="text-xs text-center" style={{ color: '#606060' }}>Set</span>
                <span className="text-xs text-center" style={{ color: '#606060' }}>Weight (kg)</span>
                <span className="text-xs text-center" style={{ color: '#606060' }}>Reps</span>
                <span className="text-xs text-center" style={{ color: '#606060' }}>RPE</span>
              </div>

              {block.sets.map((set, si) => (
                <div key={si} className="grid grid-cols-4 gap-2 mb-2 items-center">
                  <div className="text-center">
                    <button
                      onClick={() => removeSet(block.id, si)}
                      className="w-6 h-6 rounded text-xs flex items-center justify-center mx-auto"
                      style={{ background: '#242424', color: '#606060' }}
                    >
                      {si + 1}
                    </button>
                  </div>
                  <input
                    type="number"
                    value={set.weight}
                    onChange={e => updateSet(block.id, si, 'weight', e.target.value)}
                    onFocus={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) setPlateModal(v) }}
                    placeholder="0"
                    className="w-full text-center py-2 rounded text-sm outline-none"
                    style={{
                      background: '#242424',
                      color: '#F5F5F5',
                      border: '1px solid #2E2E2E',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  />
                  <input
                    type="number"
                    value={set.reps}
                    onChange={e => updateSet(block.id, si, 'reps', e.target.value)}
                    placeholder="0"
                    className="w-full text-center py-2 rounded text-sm outline-none"
                    style={{
                      background: '#242424',
                      color: '#F5F5F5',
                      border: '1px solid #2E2E2E',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  />
                  <input
                    type="number"
                    value={set.rpe}
                    onChange={e => updateSet(block.id, si, 'rpe', e.target.value)}
                    placeholder="—"
                    min="1"
                    max="10"
                    className="w-full text-center py-2 rounded text-sm outline-none"
                    style={{
                      background: '#242424',
                      color: '#F5F5F5',
                      border: '1px solid #2E2E2E',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  />
                </div>
              ))}

              <button
                onClick={() => addSet(block.id)}
                className="flex items-center gap-1.5 text-xs mt-1 px-2 py-1.5 rounded"
                style={{ color: '#00BFA5', fontFamily: 'Inter, sans-serif' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,200,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Plus size={12} />
                Add Set
              </button>
            </div>
          </div>
        )
      })}

      {/* Add exercise buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
          style={{
            background: 'rgba(0,229,200,0.08)',
            color: '#00BFA5',
            border: '1px solid rgba(0,229,200,0.2)',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <Plus size={14} />
          Add Exercise
        </button>
        <button
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
          style={{
            background: '#242424',
            color: '#A0A0A0',
            border: '1px solid #2E2E2E',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <Plus size={14} />
          Add Superset Block
        </button>
      </div>
    </div>
  )
}
