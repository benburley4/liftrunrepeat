import { describe, it, expect } from 'vitest'
import { demoSessions, demoZeppDaily, demoRoutes, demoCoachReports, DEMO_DAYS } from '../demoData'
import { prEvents, runRecords, liftRecords, exerciseAnalysis } from '../progressData'
import { freshWatchReadiness } from '../recovery'
import { plausibleRecording, footKind } from '../activity'

const TODAY = '2026-10-26'

describe('demo athlete', () => {
  const sessions = demoSessions(TODAY)

  it('is deterministic and dated up to today', () => {
    expect(demoSessions(TODAY)).toEqual(sessions)
    expect(sessions[0].date <= TODAY).toBe(true)
    expect(sessions.at(-1)!.date >= '2025-09-01').toBe(true)
    expect(new Set(sessions.map(s => s.savedAt)).size).toBe(sessions.length)
  })

  it('trains every kind of session, several times a week', () => {
    const kinds = new Set(sessions.map(s => s.type))
    expect([...kinds].sort()).toEqual(['hike', 'hybrid', 'lift', 'run'])
    expect(sessions.length / (DEMO_DAYS / 7)).toBeGreaterThan(4)
    expect(sessions.some(s => footKind(s) === 'walk')).toBe(true)
  })

  it('gets stronger and sets records, with one plateau', () => {
    expect(prEvents(sessions).length).toBeGreaterThan(20)
    expect(runRecords(sessions).records.map(r => r.label)).toEqual(expect.arrayContaining(['1K', '5 km', '10 km', 'Half Marathon']))
    expect(liftRecords(sessions).length).toBeGreaterThanOrEqual(10)
    const ohp = exerciseAnalysis(sessions, 78, {}, TODAY).find(e => e.name === 'Overhead Press')!
    expect(ohp.plateau).toBe(true)
  })

  it('has plausible watch recordings and routes', () => {
    const watched = sessions.filter(s => s.zepp)
    expect(watched.filter(plausibleRecording).length / watched.length).toBeGreaterThan(0.95)
    const routes = demoRoutes(sessions)
    expect(Object.keys(routes).length).toBeGreaterThan(100)
    for (const r of Object.values(routes).slice(0, 5)) expect(r.length).toBeGreaterThan(10)
  })

  it('has daily watch rows with a fresh readiness score and steps', () => {
    const rows = demoZeppDaily(TODAY, sessions)
    expect(rows).toHaveLength(DEMO_DAYS + 1)
    expect(rows.at(-1)!.date).toBe(TODAY)
    expect(freshWatchReadiness(rows, TODAY)).not.toBeNull()
    expect(rows.every(r => (r.steps ?? 0) > 1000)).toBe(true)
  })

  it('has a coach report for the last full week', () => {
    const [r] = demoCoachReports(TODAY)
    expect(r.weekEnding).toBe('2026-10-25')
    expect(r.reportText).toMatch(/^## /m)
  })
})
