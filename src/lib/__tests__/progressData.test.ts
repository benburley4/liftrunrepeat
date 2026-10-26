import { describe, it, expect } from 'vitest'
import {
  activityKind, activityByBucket, computeOverviewStats, computeProgressStats, dayKind, e1rmByBucket,
  exerciseRanking, goalStreaks, liftRecords, nextMilestone, predictRaceTimes, prEvents, runRecords,
  runTypeByBucket, strengthShare, weekStreaks, weekSummary, bodyPartSets, paceHrPoints,
} from '../progressData'
import { rangeBuckets } from '../progressRange'
import type { SessionData, LoggedRunSegment } from '../computeStats'
import type { ZeppDay } from '../recovery'
import type { ZeppStats } from '../zeppImport'

const set = (weight: number, reps: number) => ({ weight: String(weight), reps: String(reps), rpe: '' })
const lift = (date: string, name: string, w: number, r: number, extra: Partial<SessionData> = {}): SessionData => ({
  type: 'lift', name: 'Lift', date, savedAt: `${date}T10:00:00Z-${name}`,
  exercises: [{ id: 'e', exerciseName: name, plannedSets: [], actualSets: [set(w, r)] }], ...extra,
})
const seg = (km: number, pace: string, segmentType = 'easy'): LoggedRunSegment =>
  ({ id: 's', segmentType, metric: 'distance', plannedValue: '', plannedPace: '', actualValue: String(km), actualPace: pace })
const run = (date: string, km: number, pace: string, segmentType = 'easy'): SessionData =>
  ({ type: 'run', name: 'Run', date, savedAt: `${date}T07:00:00Z`, run: [seg(km, pace, segmentType)] })
const hike = (date: string, km: number, climb = 0, extra: Partial<SessionData> = {}): SessionData =>
  ({ type: 'hike', name: 'Hike', date, savedAt: `${date}T09:00:00Z`, hikeKm: km, hikeElevationM: climb, ...extra })

describe('activityKind / dayKind', () => {
  it('classifies sessions', () => {
    expect(activityKind(lift('2026-10-01', 'Squat', 100, 5))).toBe('lift')
    expect(activityKind(run('2026-10-01', 5, '5:00'))).toBe('run')
    expect(activityKind(hike('2026-10-01', 8))).toBe('hike')
    expect(activityKind(hike('2026-10-01', 2, 10, { source: 'zepp' }))).toBe('walk')
    expect(activityKind({ ...lift('2026-10-01', 'Squat', 100, 5), run: [seg(3, '5:00')] })).toBe('hybrid')
  })
  it('merges a day: walks only count alone, lift + run is hybrid', () => {
    expect(dayKind(new Set())).toBeNull()
    expect(dayKind(new Set(['walk'] as const))).toBe('walk')
    expect(dayKind(new Set(['walk', 'lift'] as const))).toBe('lift')
    expect(dayKind(new Set(['lift', 'run'] as const))).toBe('hybrid')
  })
})

describe('activityByBucket', () => {
  it('sums tonnage, km and strength/endurance sessions per week', () => {
    const b = rangeBuckets('4w', '2026-10-26')
    const rows = activityByBucket([
      lift('2026-10-20', 'Squat', 100, 5),
      run('2026-10-21', 6, '5:30'),
      hike('2026-10-22', 10, 400),
      run('2026-09-01', 50, '5:00'),   // outside the range
    ], b)
    expect(rows[2]).toMatchObject({ sessions: 3, lift: 500, km: 16, run: 6, hike: 10, climb: 400, strengthSessions: 1, enduranceSessions: 2 })
    expect(rows[0].sessions + rows[1].sessions + rows[3].sessions).toBe(0)
    expect(strengthShare(rows[2])).toBe(33)
    expect(strengthShare(rows[0])).toBeNull()
  })
})

describe('computeOverviewStats', () => {
  it('counts this week, compares to last week and only uses sessions up to the date', () => {
    const h = [
      lift('2026-10-19', 'Bench', 80, 5), run('2026-10-20', 5, '5:00'),
      lift('2026-10-13', 'Bench', 80, 5),
      run('2026-10-28', 10, '5:00'),   // after "today": ignored
    ]
    const s = computeOverviewStats(h, undefined, '2026-10-21')
    expect(s.sessionsThisWeek).toBe(2)
    expect(s.sessionDiff).toBe(1)
    expect(s.kmThisWeek).toBe(5)
    expect(s.totalVolume).toBe(800)
    expect(s.tsb).toBeGreaterThanOrEqual(0)
    expect(s.tsb).toBeLessThanOrEqual(100)
  })
})

describe('computeProgressStats', () => {
  it('compares the last 4 weeks with the 4 before', () => {
    const h = [
      lift('2026-10-20', 'Bench', 100, 5), run('2026-10-21', 10, '5:00'),
      lift('2026-09-15', 'Bench', 90, 5), run('2026-09-16', 5, '5:00'),
    ]
    const p = computeProgressStats(h, undefined, '2026-10-26')!
    expect(p.km).toMatchObject({ from: 5, to: 10, pct: 100 })
    expect(p.sessions).toMatchObject({ from: 2, to: 2, pct: 0 })
    expect(p.lifts[0]).toMatchObject({ name: 'Bench', from: 105, to: 117 })
  })
  it('returns null without an earlier window', () => {
    expect(computeProgressStats([lift('2026-10-20', 'Bench', 100, 5)], undefined, '2026-10-26')).toBeNull()
  })
})

describe('strength helpers', () => {
  const h = [lift('2026-10-06', 'Bench', 80, 5), lift('2026-10-13', 'Bench', 85, 5), lift('2026-10-13', 'Squat', 100, 3)]
  it('ranks exercises by sets and takes best e1RM per bucket', () => {
    expect(exerciseRanking(h).map(r => r.name)).toEqual(['Bench', 'Squat'])
    const rows = e1rmByBucket(h, rangeBuckets('4w', '2026-10-26'), ['Bench'])
    expect(rows.map(r => r.Bench)).toEqual([93, 99, null, null])
  })
  it('keeps the best set per exercise as the record', () => {
    expect(liftRecords(h).find(r => r.exercise === 'Bench')).toMatchObject({ weight: 85, reps: 5, rm: 99, date: '2026-10-13' })
  })
  it('picks the next round-number milestone', () => {
    expect(nextMilestone(93)).toEqual({ target: 100, pct: 93 })
    expect(nextMilestone(100)).toEqual({ target: 120, pct: 83 })
    expect(nextMilestone(210)).toEqual({ target: 225, pct: 93 })
  })
  it('counts sets per body part within a span', () => {
    expect(bodyPartSets(h, { start: '2026-10-10', end: '2026-10-20' })).toMatchObject({ Chest: 1, Legs: 1, Back: 0 })
  })
})

describe('running records', () => {
  const h = [run('2026-09-01', 5, '5:00'), run('2026-10-01', 5.1, '4:50'), run('2026-10-05', 10, '5:10'), run('2026-10-10', 1, '4:00', 'interval')]
  it('finds the fastest effort near each key distance and the longest run', () => {
    const { records, longest } = runRecords(h)
    expect(records.map(r => [r.label, r.pace])).toEqual([['1K', '4:00'], ['5 km', '4:50'], ['10 km', '5:10']])
    expect(longest?.km).toBe(10)
  })
  it('predicts race times with Riegel from the nearest record', () => {
    const p = predictRaceTimes(runRecords(h).records)
    const tenK = p.find(x => x.label === '10 km')!
    expect(tenK.fromLabel).toBe('10 km')
    expect(Math.round(tenK.predictedSecs)).toBe(3100)
    const half = p.find(x => x.label === 'Half Marathon')!
    expect(half.fromLabel).toBe('10 km')
    expect(half.predictedSecs).toBeGreaterThan(3100 * 2.1)
  })
  it('reports type mix per bucket as percentages', () => {
    const mix = runTypeByBucket(h, rangeBuckets('all', '2026-10-26', '2026-09-01'))
    expect(mix.types).toEqual(['easy', 'interval'])
    expect(mix.rows[1].easy + mix.rows[1].interval).toBeCloseTo(100, 0)
  })
})

describe('prEvents', () => {
  it('records improvements but not first logs', () => {
    const ev = prEvents([
      lift('2026-10-01', 'Bench', 80, 5), lift('2026-10-08', 'Bench', 85, 5), lift('2026-10-15', 'Bench', 82.5, 5),
      run('2026-10-02', 5, '5:00'), run('2026-10-09', 5, '4:45'),
    ])
    expect(ev.map(e => [e.date, e.name, e.kind])).toEqual([['2026-10-08', 'Bench', 'lift'], ['2026-10-09', '5 km', 'run']])
    expect(ev[0].pct).toBe(6.5)
  })
})

describe('streaks', () => {
  it('counts consecutive active weeks, allowing an empty current week', () => {
    const dates = ['2026-10-05', '2026-10-13', '2026-10-21', '2026-09-01', '2026-09-08']
    expect(weekStreaks(dates, '2026-10-26')).toEqual({ current: 3, longest: 3 })
    expect(weekStreaks(dates, '2026-11-05')).toEqual({ current: 0, longest: 3 })
  })
  it('counts step-goal days ending today or yesterday', () => {
    const day = (date: string, steps: number) => ({ date, steps, step_goal: 10000 } as unknown as ZeppDay)
    const rows = [day('2026-10-20', 12000), day('2026-10-21', 11000), day('2026-10-22', 4000), day('2026-10-23', 10500), day('2026-10-24', 10000)]
    expect(goalStreaks(rows, '2026-10-25')).toEqual({ current: 2, longest: 2 })
    expect(goalStreaks(rows, '2026-10-27')).toEqual({ current: 0, longest: 2 })
  })
})

describe('weekSummary', () => {
  it('summarises a Monday–Sunday week with a kind per day', () => {
    const w = weekSummary([lift('2026-10-19', 'Bench', 80, 5), run('2026-10-19', 5, '5:00'), hike('2026-10-25', 12, 600)], undefined, '2026-10-19')
    expect(w).toMatchObject({ sessions: 3, liftKg: 400, km: 17, climb: 600 })
    expect(w.days).toEqual(['hybrid', null, null, null, null, null, 'hike'])
  })
})

describe('paceHrPoints', () => {
  it('keeps plausible watch outings with HR', () => {
    const z = (km: number, min: number, hr: number) => ({ distanceKm: km, durationMin: min, movingMin: min, avgHr: hr } as unknown as ZeppStats)
    const pts = paceHrPoints([
      { ...run('2026-10-01', 5, '5:00'), source: 'zepp', zepp: z(5, 25, 150) },
      { ...hike('2026-10-02', 3), source: 'zepp', zepp: z(3, 300, 100) },   // 100 min/km: implausible
    ])
    expect(pts).toHaveLength(1)
    expect(pts[0]).toMatchObject({ kind: 'run', pace: 5, hr: 150 })
  })
})
