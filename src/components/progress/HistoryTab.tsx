'use client'

import { useCallback, useState } from 'react'
import type { SessionData } from '@/lib/computeStats'
import type { VolumeMultipliers } from '@/lib/exerciseLoad'
import { footKind, isWatchSession } from '@/lib/activity'
import type { ExerciseStat } from '@/lib/progressData'
import HistorySessions from './HistorySessions'
import ExerciseGrid from './ExerciseGrid'
import ExerciseDetail from './ExerciseDetail'
import SessionDetail from './SessionDetail'
import { Pills } from './kit'

const SHORT_WALK_KM = 2

export default function HistoryTab({ history, selected, analysis, bodyweight, mults, demo, onBodyweight, onOpen, onBack, onSave, onDelete }: {
  history: SessionData[]
  selected: SessionData | null
  analysis: ExerciseStat[]
  bodyweight: number
  mults?: VolumeMultipliers
  demo: boolean
  onBodyweight: (kg: number) => void
  onOpen: (s: SessionData) => void
  onBack: () => void
  onSave: (s: SessionData) => Promise<void>
  onDelete: (savedAt: string) => void
}) {
  const [sub, setSub] = useState<'sessions' | 'exercises'>('sessions')
  const [exercise, setExercise] = useState<string | null>(null)
  // Short watch walks still count in every stat; they're only hidden from this list.
  const isShortWalk = useCallback((s: SessionData) => isWatchSession(s) && footKind(s) === 'walk' && (s.hikeKm ?? 0) < SHORT_WALK_KM, [])

  if (selected) return <SessionDetail key={selected.savedAt} session={selected} demo={demo} onBack={onBack} onSave={onSave} onDelete={onDelete} />

  const ex = exercise ? analysis.find(e => e.name === exercise) : null
  return (
    <div className="space-y-4">
      <Pills label="History view" value={sub} onChange={v => { setSub(v); setExercise(null) }}
        options={[{ id: 'sessions', label: 'Sessions' }, { id: 'exercises', label: 'Exercises' }]} />
      {sub === 'sessions' && (
        <HistorySessions sessions={history} mults={mults} demo={demo} onOpen={onOpen} onDelete={onDelete} shortWalkKm={SHORT_WALK_KM} isShortWalk={isShortWalk} />
      )}
      {sub === 'exercises' && (ex
        ? <ExerciseDetail ex={ex} bodyweight={bodyweight} onBack={() => setExercise(null)} />
        : <ExerciseGrid analysis={analysis} bodyweight={bodyweight} onBodyweight={onBodyweight} onSelect={setExercise} />)}
    </div>
  )
}
