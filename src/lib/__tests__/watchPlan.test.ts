import { describe, it, expect } from 'vitest'
import { parseMinutes, segmentToStep, entriesToSteps, templateToWorkout, programmeRunsBetween, buildPlan, mergeWithSent, PlanTemplate, PlanProgramme } from '../watchPlan'

const intervals: PlanTemplate = {
  name: 'Track Intervals Session',
  type: 'run',
  runRows: [
    { segmentType: 'warm-up', metric: 'time', value: '10:00' },
    { kind: 'repeat', count: '4', laps: [
      { segmentType: 'interval', metric: 'distance', value: '0.8', pace: '4:30' },
      { segmentType: 'rest', metric: 'time', value: '2' },
    ] },
    { segmentType: 'cool-down', metric: 'time', value: '10' },
  ],
}

describe('parseMinutes', () => {
  it('reads plain minutes and clock formats', () => {
    expect(parseMinutes('25')).toBe(25)
    expect(parseMinutes('30:00')).toBe(30)
    expect(parseMinutes('1:05:00')).toBe(65)
    expect(parseMinutes('')).toBeNull()
  })
})

describe('segmentToStep', () => {
  it('maps type, duration and a pace band', () => {
    expect(segmentToStep({ segmentType: 'tempo', metric: 'distance', value: '5', pace: '5:30' }))
      .toEqual({ step: { kind: 'active', duration: '5km', target: 'pace 5:25-5:35' } })
    expect(segmentToStep({ segmentType: 'interval', metric: 'distance', value: '0.4' }).step).toEqual({ kind: 'interval', duration: '400m' })
    expect(segmentToStep({ segmentType: 'strides', metric: 'time', value: '0:30' }).step).toEqual({ kind: 'interval', duration: '30s' })
  })
  it('flags segments without a distance or time', () => {
    expect(segmentToStep({ segmentType: 'easy', metric: 'pace', value: '6:00' })).toEqual({ step: null, issue: 'easy: needs a distance or time' })
  })
})

describe('entriesToSteps', () => {
  it('keeps repeat blocks as watch repeats', () => {
    expect(entriesToSteps(intervals.runRows!).steps).toEqual([
      { kind: 'warmup', duration: '10min' },
      { repeat: 4, steps: [{ kind: 'interval', duration: '800m', target: 'pace 4:25-4:35' }, { kind: 'recovery', duration: '2min' }] },
      { kind: 'cooldown', duration: '10min' },
    ])
  })
})

describe('templateToWorkout', () => {
  it('builds a named, focused, described workout', () => {
    const { workout } = templateToWorkout(intervals, '2026-10-28')
    expect(workout).toMatchObject({ date: '2026-10-28', sport: 'running', variant: 'track', name: 'Track Interval', focus: 'Intervals' })
    expect(workout!.description).toBe('10min warmup · 4× (800m interval @ 4:25-4:35/km, 2min recovery) · 10min cooldown')
  })
  it('refuses templates without run segments', () => {
    expect(templateToWorkout({ name: 'Upper A', type: 'lift' }, '2026-10-28').workout).toBeNull()
  })
})

describe('programmeRunsBetween', () => {
  const prog: PlanProgramme = {
    name: 'Hybrid', weeks: 2, startDate: '2026-10-19',
    cells: {
      w1d1: { template: intervals },                                      // Tue 27 Oct
      w1d3: { template: { name: 'Upper A', type: 'lift' } },              // lifting day — not sent
      w1d5: { template: { name: 'Long Run', type: 'run', runRows: [{ segmentType: 'easy', metric: 'time', value: '60' }] } }, // Sat 31 Oct
    },
  }
  it('counts weeks from the Monday of a mid-week start date', () => {
    expect(programmeRunsBetween({ ...prog, startDate: '2026-10-22' }, '2026-10-26', '2026-11-01').map(r => r.date)).toEqual(['2026-10-27', '2026-10-31'])
  })
  it('finds programmed runs by date', () => {
    expect(programmeRunsBetween(prog, '2026-10-26', '2026-11-01').map(r => [r.date, r.template.name]))
      .toEqual([['2026-10-27', 'Track Intervals Session'], ['2026-10-31', 'Long Run']])
  })
})

describe('buildPlan', () => {
  it('wraps workouts in a zeppbridge-plan/3 plan', () => {
    const { plan, issues } = buildPlan([{ date: '2026-10-28', template: intervals }], '2026-10-28', '2026-10-28', 'Track intervals', '2026-10-25')
    expect(issues).toEqual([])
    expect(plan).toMatchObject({ format: 'zeppbridge-plan/3', from: '2026-10-28', to: '2026-10-28', summary: 'Track intervals' })
    expect(plan!.workouts).toHaveLength(1)
  })
  it('rejects past dates and empty plans', () => {
    expect(buildPlan([{ date: '2026-10-20', template: intervals }], '2026-10-20', '2026-10-20', 'x', '2026-10-25').plan).toBeNull()
    expect(buildPlan([], '2026-10-26', '2026-11-01', 'x', '2026-10-25')).toEqual({ plan: null, issues: ['No runs to send'] })
  })
})

describe('mergeWithSent', () => {
  const run = (date: string, name: string) => ({ ...templateToWorkout(intervals, date).workout!, name })
  it('keeps earlier sends, replaces same-day runs and drops past dates', () => {
    const sent = [run('2026-10-20', 'Old past'), run('2026-10-27', 'Tue v1'), run('2026-10-31', 'Sat long')]
    const plan = mergeWithSent(sent, [run('2026-10-27', 'Tue v2'), run('2026-10-29', 'Thu')], '2026-10-25', 'Week')!
    expect(plan.from).toBe('2026-10-25')
    expect(plan.to).toBe('2026-10-31')
    expect(plan.workouts.map(w => `${w.date} ${w.name}`)).toEqual(['2026-10-27 Tue v2', '2026-10-29 Thu', '2026-10-31 Sat long'])
  })
  it('returns null when nothing is left to send', () => {
    expect(mergeWithSent([run('2026-10-20', 'Past')], [], '2026-10-25', 'x')).toBeNull()
  })
})
