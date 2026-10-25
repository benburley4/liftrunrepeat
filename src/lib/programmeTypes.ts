import type { ExRow, RunEntry } from '@/components/templates/ExerciseBuilder'

export type TemplateKind = 'lift' | 'run' | 'hybrid' | 'hike'

// Matches the shape stored in thhl_custom_templates (Templates tab)
export interface StoredTemplate {
  id: string
  name: string
  type: TemplateKind
  description?: string
  duration?: string
  exerciseRows?: ExRow[]
  runRows?: RunEntry[]
  hikeData?: { distanceKm: string; elevationGainM: string }
}

export interface CellData {
  template: StoredTemplate
  rpe: number
}

export interface Programme {
  id: string
  name: string
  weeks: number
  startDate: string // 'YYYY-MM-DD'
  sessionsPerDay?: 1 | 2
  cells: Record<string, CellData> // key: 'w{week}d{day}' or 'w{week}d{day}_2' for second session
  // week index → deload applied to it; `backup` holds the pre-deload cells so it can be restored
  deloads?: Record<string, { pct: number; backup: Record<string, CellData> }>
}
