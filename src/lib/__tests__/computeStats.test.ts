import { describe, it, expect } from 'vitest'
import { computeStats, epleyRM, segKm, classifyPPL, classifyBody, SessionData, LoggedRunSegment } from '../computeStats'

function liftSession(date: string, weight: number, reps: number, name = 'Back Squat'): SessionData {
  return {
    type: 'lift', name: 'Lift', date, savedAt: `${date}T10:00:00Z`,
    exercises: [{
      id: 'e1', exerciseName: name,
      plannedSets: [{ reps: String(reps), weight: String(weight) }],
      actualSets: [{ reps: String(reps), weight: String(weight), rpe: '8' }],
    }],
  }
}

function runSession(date: string, km: number): SessionData {
  return {
    type: 'run', name: 'Run', date, savedAt: `${date}T07:00:00Z`,
    run: [{ id: 'r1', segmentType: 'easy', metric: 'distance', plannedValue: String(km), plannedPace: '', actualValue: String(km), actualPace: '' }],
  }
}

describe('epleyRM', () => {
  it('returns the weight itself for a single', () => {
    expect(epleyRM(100, 1)).toBe(100)
  })
  it('estimates 1RM for reps > 1', () => {
    expect(epleyRM(100, 5)).toBe(117) // 100 * (1 + 5/30)
  })
})

describe('segKm', () => {
  it('reads distance segments directly', () => {
    const seg: LoggedRunSegment = { id: '1', segmentType: 'easy', metric: 'distance', plannedValue: '', plannedPace: '', actualValue: '8.5', actualPace: '' }
    expect(segKm(seg)).toBe(8.5)
  })
  it('derives km from time and pace', () => {
    const seg: LoggedRunSegment = { id: '1', segmentType: 'easy', metric: 'time', plannedValue: '', plannedPace: '', actualValue: '30', actualPace: '5:00' }
    expect(segKm(seg)).toBe(6)
  })
  it('returns 0 for time segments without a pace', () => {
    const seg: LoggedRunSegment = { id: '1', segmentType: 'easy', metric: 'time', plannedValue: '', plannedPace: '', actualValue: '30', actualPace: '' }
    expect(segKm(seg)).toBe(0)
  })
})

describe('classification', () => {
  it('classifies push/pull/legs', () => {
    expect(classifyPPL('Bench Press')).toBe('Push')
    expect(classifyPPL('Barbell Row')).toBe('Pull')
    expect(classifyPPL('Back Squat')).toBe('Legs')
    expect(classifyPPL('Plank')).toBe('Core')
  })
  it('classifies body parts', () => {
    expect(classifyBody('Bench Press')).toBe('Chest')
    expect(classifyBody('Conventional Deadlift')).toBe('Back')
    expect(classifyBody('Dumbbell Curl')).toBe('Arms')
  })
})

describe('computeStats', () => {
  // Reference: Sunday 2026-06-28 — sessions fall in that week (Mon 22nd – Sun 28th)
  const REF = '2026-06-28'

  it('handles an empty history', () => {
    const stats = computeStats([], REF)
    expect(stats.totalSessions).toBe(0)
    expect(stats.strengthSummary).toBeNull()
    expect(stats.runSummary).toBeNull()
    expect(stats.overview.tsb).toBeGreaterThan(0)
  })

  it('sums weekly volume and km for the reference week', () => {
    const history = [
      liftSession('2026-06-23', 100, 5),  // 500 kg volume
      runSession('2026-06-24', 10),
    ]
    const stats = computeStats(history, REF)
    expect(stats.overview.sessionsThisWeek).toBe(2)
    expect(stats.overview.volumeThisWeek).toBe(500)
    expect(stats.overview.kmThisWeek).toBe(10)
  })

  it('reports PRs with estimated 1RM', () => {
    const history = [liftSession('2026-06-23', 100, 5)]
    const stats = computeStats(history, REF)
    expect(stats.strengthSummary).not.toBeNull()
    expect(stats.strengthSummary!.prs[0].exercise).toBe('Back Squat')
    expect(stats.strengthSummary!.prs[0].rm).toContain('117')
  })

  it('flags overtraining when volume spikes >30% week on week', () => {
    const history = [
      runSession('2026-06-16', 10),  // previous week
      runSession('2026-06-23', 20),  // reference week: +100%
      runSession('2026-06-25', 20),
    ]
    const stats = computeStats(history, REF)
    expect(stats.overview.overtrained).toBe(true)
  })

  it('keeps readiness inside 0-100', () => {
    const heavy = Array.from({ length: 6 }, (_, i) => liftSession(`2026-06-2${2 + (i % 6)}`, 200, 10))
    const stats = computeStats(heavy, REF)
    expect(stats.overview.tsb).toBeGreaterThanOrEqual(0)
    expect(stats.overview.tsb).toBeLessThanOrEqual(100)
  })
})
