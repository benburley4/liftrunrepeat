import type { Bucket, RangeId } from '@/lib/progressRange'
import type { SessionData } from '@/lib/computeStats'
import type { VolumeMultipliers } from '@/lib/exerciseLoad'

export type TabId = 'overview' | 'ai-coach' | 'prs' | 'history' | 'strength' | 'running' | 'steps' | 'hybrid'

export const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'ai-coach', label: 'Weekly Review' },
  { id: 'prs', label: 'Personal Records' },
  { id: 'history', label: 'History' },
  { id: 'strength', label: 'Strength' },
  { id: 'running', label: 'On Foot' },
  { id: 'steps', label: 'Steps' },
  { id: 'hybrid', label: 'Hybrid' },
]

export const isTabId = (v: unknown): v is TabId => TABS.some(t => t.id === v)

/** The page-wide date range every chart follows. */
export interface RangeCtx {
  range: RangeId
  compare: boolean
  buckets: Bucket[]
  prev: Bucket[]
  span: { start: string; end: string }
  today: string
  /** "last 12 weeks" etc. */
  label: string
  mults?: VolumeMultipliers
  /** Open the sessions behind one bucket of a chart. */
  openBucket: (b: Bucket) => void
  /** Open one session in History. */
  openSession: (s: SessionData) => void
}

/** Recharts chart-level click → bucket index. */
export function onBucketClick(buckets: Bucket[], open: (b: Bucket) => void) {
  return (state: { activeTooltipIndex?: unknown } | null) => {
    const i = Number(state?.activeTooltipIndex)
    if (Number.isInteger(i) && buckets[i]) open(buckets[i])
  }
}
