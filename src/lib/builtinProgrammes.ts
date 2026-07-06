// Full periodised plans for the six built-in programme cards (B3).
// Plans use the same phase schema as the AI generator (see programmeSchema.ts)
// and are expanded into week-by-week cells with the same progressive-overload
// logic the programmes page applies to AI output.

import { AIProgramme, AIProgrammeSession } from './programmeSchema'

// ─── Expansion (mirrors programmes/page.tsx handleAIGenerate) ────────────────

interface BuiltSet { id: string; reps: string; weight: string }
interface BuiltExRow { id: string; exerciseId: string; exerciseName: string; category: string; sets: BuiltSet[] }
interface BuiltRunRow { id: string; segmentType: string; metric: 'time' | 'distance'; value: string }
interface BuiltTemplate { id: string; name: string; type: string; exerciseRows: BuiltExRow[]; runRows: BuiltRunRow[] }
export interface BuiltCell { rpe: number; template: BuiltTemplate }
export interface BuiltProgramme {
  id: string
  name: string
  weeks: number
  startDate: string
  sessionsPerDay: number
  cells: Record<string, BuiltCell>
}

function thisOrNextMonday(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  if (day !== 1) d.setDate(d.getDate() + ((8 - day) % 7 || 7))
  return d.toISOString().split('T')[0]
}

export function expandPlanToProgramme(plan: AIProgramme): BuiltProgramme {
  const weightProgress = plan.weightProgressKgPerWeek ?? 2.5
  const runProgress = plan.runProgressMinPerWeek ?? 2
  const ts = Date.now()
  const cells: Record<string, BuiltCell> = {}

  for (const phase of plan.phases) {
    for (let w = phase.startWeek; w <= phase.endWeek; w++) {
      const weekOffset = w - phase.startWeek
      const isDeload = (phase.deloadWeeks ?? []).includes(w)
      const liftMult = isDeload ? 0.7 : 1
      const runMult = isDeload ? 0.7 : 1

      for (const [dayKey, session] of Object.entries(phase.sessions) as [string, AIProgrammeSession][]) {
        const dayNum = parseInt(dayKey.replace('d', '')) - 1
        const cellKey = `w${w - 1}d${dayNum}`
        cells[cellKey] = {
          rpe: isDeload ? Math.max(5, session.rpe - 2) : session.rpe,
          template: {
            id: `builtin-${cellKey}-${ts}`,
            name: session.template.name + (isDeload ? ' (Deload)' : ''),
            type: session.template.type,
            exerciseRows: (session.template.exerciseRows ?? []).map((ex, ei) => ({
              id: `ex-${cellKey}-${ei}`,
              exerciseId: '',
              exerciseName: ex.exerciseName,
              category: ex.category ?? 'barbell',
              sets: (ex.sets ?? []).map((s, si) => {
                const base = parseFloat(s.weight) || 0
                const added = base > 0 ? Math.round((base + weekOffset * weightProgress) * liftMult / 2.5) * 2.5 : 0
                return { id: `s-${cellKey}-${ei}-${si}`, reps: s.reps, weight: added > 0 ? String(added) : s.weight }
              }),
            })),
            runRows: (session.template.runRows ?? []).map((r, ri) => {
              let val = r.value
              if (r.metric === 'time' && r.segmentType === 'easy') {
                const mins = (parseFloat(r.value) || 0) + weekOffset * runProgress
                val = String(Math.round(mins * runMult))
              }
              return { id: `run-${cellKey}-${ri}`, segmentType: r.segmentType, metric: r.metric as 'time' | 'distance', value: val }
            }),
          },
        }
      }
    }
  }

  return {
    id: `prog-${ts}`,
    name: plan.name,
    weeks: plan.weeks,
    startDate: thisOrNextMonday(),
    sessionsPerDay: 1,
    cells,
  }
}

// ─── Session shorthands ───────────────────────────────────────────────────────

type Sets = { reps: string; weight: string }[]
const sets = (n: number, reps: string, weight: string): Sets =>
  Array.from({ length: n }, () => ({ reps, weight }))

function lift(name: string, rpe: number, exercises: [string, string, Sets][]): AIProgrammeSession {
  return {
    rpe,
    template: {
      name,
      type: 'lift',
      exerciseRows: exercises.map(([exerciseName, category, s]) => ({ exerciseName, category, sets: s })),
    },
  }
}

function run(name: string, rpe: number, rows: [string, 'time' | 'distance', string][]): AIProgrammeSession {
  return {
    rpe,
    template: {
      name,
      type: 'run',
      runRows: rows.map(([segmentType, metric, value]) => ({ segmentType, metric, value })),
    },
  }
}

// ─── The six plans (keyed by the programme card ids in exerciseLibrary.ts) ───

export const BUILTIN_PLANS: Record<string, AIProgramme> = {
  'hybrid-beginner': {
    name: 'Hybrid Beginner',
    weeks: 12,
    weightProgressKgPerWeek: 2.5,
    runProgressMinPerWeek: 2,
    phases: [
      {
        name: 'Base',
        startWeek: 1,
        endWeek: 6,
        deloadWeeks: [4],
        sessions: {
          d1: lift('Full Body A', 6, [
            ['Back Squat', 'barbell', sets(3, '5', '40')],
            ['Bench Press', 'barbell', sets(3, '5', '30')],
            ['Barbell Row', 'barbell', sets(3, '8', '30')],
            ['Plank', 'bodyweight', sets(3, '30s', '')],
          ]),
          d2: run('Easy Run', 4, [['warm-up', 'time', '5'], ['easy', 'time', '20'], ['cool-down', 'time', '5']]),
          d4: lift('Full Body B', 6, [
            ['Conventional Deadlift', 'barbell', sets(3, '5', '50')],
            ['Overhead Press', 'barbell', sets(3, '5', '20')],
            ['Lat Pulldown', 'machine', sets(3, '10', '35')],
            ['Glute Bridge', 'bodyweight', sets(3, '12', '')],
          ]),
          d5: run('Easy Run', 4, [['warm-up', 'time', '5'], ['easy', 'time', '20'], ['cool-down', 'time', '5']]),
          d6: lift('Full Body C', 6, [
            ['Goblet Squat', 'dumbbell', sets(3, '10', '16')],
            ['Incline Dumbbell Bench Press', 'dumbbell', sets(3, '10', '12')],
            ['Seated Cable Row', 'machine', sets(3, '10', '35')],
            ['Dead Bug', 'bodyweight', sets(3, '10', '')],
          ]),
        },
      },
      {
        name: 'Build',
        startWeek: 7,
        endWeek: 12,
        deloadWeeks: [8, 12],
        sessions: {
          d1: lift('Full Body A', 7, [
            ['Back Squat', 'barbell', sets(3, '5', '55')],
            ['Bench Press', 'barbell', sets(3, '5', '42.5')],
            ['Barbell Row', 'barbell', sets(3, '8', '40')],
            ['Plank', 'bodyweight', sets(3, '45s', '')],
          ]),
          d2: run('Tempo Run', 6, [['warm-up', 'time', '10'], ['tempo', 'time', '15'], ['cool-down', 'time', '5']]),
          d4: lift('Full Body B', 7, [
            ['Conventional Deadlift', 'barbell', sets(3, '5', '65')],
            ['Overhead Press', 'barbell', sets(3, '5', '27.5')],
            ['Pull-up', 'bodyweight', sets(3, 'max', '')],
            ['Glute Bridge', 'bodyweight', sets(3, '15', '')],
          ]),
          d5: run('Easy Run', 4, [['warm-up', 'time', '5'], ['easy', 'time', '30'], ['cool-down', 'time', '5']]),
          d6: run('Long Run', 5, [['easy', 'distance', '6']]),
        },
      },
    ],
  },

  '531-easy-miles': {
    name: '5/3/1 + Easy Kms',
    weeks: 16,
    weightProgressKgPerWeek: 1.25,
    runProgressMinPerWeek: 1,
    phases: [
      {
        name: 'Cycle 1-2',
        startWeek: 1,
        endWeek: 8,
        deloadWeeks: [4, 8],
        sessions: {
          d1: lift('Squat Day', 8, [
            ['Back Squat', 'barbell', [{ reps: '5', weight: '80' }, { reps: '5', weight: '90' }, { reps: '5+', weight: '100' }]],
            ['Leg Press', 'machine', sets(3, '10', '120')],
            ['Walking Lunge', 'bodyweight', sets(3, '10', '')],
            ['Plank', 'bodyweight', sets(3, '45s', '')],
          ]),
          d2: run('Easy Run', 4, [['easy', 'time', '30']]),
          d3: lift('Bench Day', 8, [
            ['Bench Press', 'barbell', [{ reps: '5', weight: '55' }, { reps: '5', weight: '62.5' }, { reps: '5+', weight: '70' }]],
            ['Dumbbell Bench Press', 'dumbbell', sets(3, '10', '24')],
            ['Barbell Row', 'barbell', sets(4, '8', '50')],
            ['Tricep Pushdown', 'machine', sets(3, '12', '25')],
          ]),
          d4: run('Easy Run', 4, [['easy', 'time', '25']]),
          d5: lift('Deadlift Day', 8, [
            ['Conventional Deadlift', 'barbell', [{ reps: '5', weight: '100' }, { reps: '5', weight: '112.5' }, { reps: '5+', weight: '125' }]],
            ['Romanian Deadlift', 'barbell', sets(3, '8', '70')],
            ['Pull-up', 'bodyweight', sets(3, 'max', '')],
            ['Hollow Body Hold', 'bodyweight', sets(3, '30s', '')],
          ]),
          d6: lift('OHP Day', 7, [
            ['Overhead Press', 'barbell', [{ reps: '5', weight: '32.5' }, { reps: '5', weight: '37.5' }, { reps: '5+', weight: '42.5' }]],
            ['Dip', 'bodyweight', sets(3, '8', '')],
            ['Dumbbell Lateral Raise', 'dumbbell', sets(3, '15', '8')],
            ['Hammer Curl', 'dumbbell', sets(3, '10', '12')],
          ]),
        },
      },
      {
        name: 'Cycle 3-4',
        startWeek: 9,
        endWeek: 16,
        deloadWeeks: [12, 16],
        sessions: {
          d1: lift('Squat Day', 8, [
            ['Back Squat', 'barbell', [{ reps: '3', weight: '90' }, { reps: '3', weight: '100' }, { reps: '3+', weight: '110' }]],
            ['Front Squat', 'barbell', sets(3, '5', '60')],
            ['Dumbbell Bulgarian Split Squat', 'dumbbell', sets(3, '8', '14')],
            ['Plank', 'bodyweight', sets(3, '60s', '')],
          ]),
          d2: run('Easy Run', 4, [['easy', 'time', '35']]),
          d3: lift('Bench Day', 8, [
            ['Bench Press', 'barbell', [{ reps: '3', weight: '62.5' }, { reps: '3', weight: '70' }, { reps: '3+', weight: '77.5' }]],
            ['Close Grip Bench Press', 'barbell', sets(3, '8', '50')],
            ['Barbell Row', 'barbell', sets(4, '8', '57.5')],
            ['Dumbbell Fly', 'dumbbell', sets(3, '12', '12')],
          ]),
          d4: run('Easy Run', 4, [['easy', 'time', '30']]),
          d5: lift('Deadlift Day', 8, [
            ['Conventional Deadlift', 'barbell', [{ reps: '3', weight: '112.5' }, { reps: '3', weight: '125' }, { reps: '3+', weight: '137.5' }]],
            ['Hip Thrust', 'machine', sets(3, '10', '80')],
            ['Chin Ups', 'bodyweight', sets(3, 'max', '')],
            ['Leg Raise', 'bodyweight', sets(3, '12', '')],
          ]),
          d6: lift('OHP Day', 7, [
            ['Overhead Press', 'barbell', [{ reps: '3', weight: '37.5' }, { reps: '3', weight: '42.5' }, { reps: '3+', weight: '47.5' }]],
            ['Push Press', 'barbell', sets(3, '5', '40')],
            ['Dumbbell Lateral Raise', 'dumbbell', sets(3, '15', '10')],
            ['EZ Bar Curl', 'dumbbell', sets(3, '10', '25')],
          ]),
        },
      },
    ],
  },

  'running-priority': {
    name: 'Running Priority',
    weeks: 20,
    weightProgressKgPerWeek: 1.25,
    runProgressMinPerWeek: 2,
    phases: [
      {
        name: 'Base',
        startWeek: 1,
        endWeek: 8,
        deloadWeeks: [4, 8],
        sessions: {
          d1: run('Easy Run', 4, [['easy', 'distance', '8']]),
          d2: lift('Upper Maintenance', 6, [
            ['Bench Press', 'barbell', sets(3, '5', '60')],
            ['Barbell Row', 'barbell', sets(3, '8', '50')],
            ['Overhead Press', 'barbell', sets(3, '8', '32.5')],
            ['Pull-up', 'bodyweight', sets(3, 'max', '')],
          ]),
          d3: run('Tempo Run', 7, [['warm-up', 'time', '10'], ['tempo', 'time', '20'], ['cool-down', 'time', '10']]),
          d4: run('Easy Run', 4, [['easy', 'distance', '6']]),
          d5: lift('Lower Maintenance', 6, [
            ['Back Squat', 'barbell', sets(3, '5', '70')],
            ['Romanian Deadlift', 'barbell', sets(3, '8', '60')],
            ['Machine Calf Raise', 'machine', sets(3, '15', '60')],
            ['Side Plank', 'bodyweight', sets(3, '30s', '')],
          ]),
          d6: run('Long Run', 5, [['easy', 'distance', '14']]),
        },
      },
      {
        name: 'Build',
        startWeek: 9,
        endWeek: 16,
        deloadWeeks: [12, 16],
        sessions: {
          d1: run('Easy Run', 4, [['easy', 'distance', '10']]),
          d2: lift('Upper Maintenance', 6, [
            ['Bench Press', 'barbell', sets(3, '5', '65')],
            ['Barbell Row', 'barbell', sets(3, '8', '55')],
            ['Overhead Press', 'barbell', sets(3, '8', '35')],
            ['Chin Ups', 'bodyweight', sets(3, 'max', '')],
          ]),
          d3: run('Intervals', 8, [['warm-up', 'time', '12'], ['interval', 'time', '20'], ['cool-down', 'time', '10']]),
          d4: run('Easy Run', 4, [['easy', 'distance', '7']]),
          d5: lift('Lower Maintenance', 6, [
            ['Back Squat', 'barbell', sets(3, '5', '75')],
            ['Hip Thrust', 'machine', sets(3, '10', '80')],
            ['Machine Calf Raise', 'machine', sets(3, '15', '70')],
            ['Bird Dog', 'bodyweight', sets(3, '10', '')],
          ]),
          d6: run('Long Run', 6, [['easy', 'distance', '18']]),
        },
      },
      {
        name: 'Peak & Taper',
        startWeek: 17,
        endWeek: 20,
        deloadWeeks: [19, 20],
        sessions: {
          d1: run('Easy Run', 4, [['easy', 'distance', '8']]),
          d2: lift('Full Body Maintenance', 5, [
            ['Back Squat', 'barbell', sets(2, '5', '70')],
            ['Bench Press', 'barbell', sets(2, '5', '60')],
            ['Barbell Row', 'barbell', sets(2, '8', '50')],
          ]),
          d3: run('Race Pace', 8, [['warm-up', 'time', '10'], ['tempo', 'distance', '8'], ['cool-down', 'time', '10']]),
          d5: run('Easy Run', 3, [['easy', 'distance', '5']]),
          d6: run('Long Run', 5, [['easy', 'distance', '16']]),
        },
      },
    ],
  },

  'powerbuilding-tempo': {
    name: 'Powerbuilding + Tempo',
    weeks: 12,
    weightProgressKgPerWeek: 2.5,
    runProgressMinPerWeek: 1,
    phases: [
      {
        name: 'Hypertrophy',
        startWeek: 1,
        endWeek: 6,
        deloadWeeks: [4],
        sessions: {
          d1: lift('Upper Power', 8, [
            ['Bench Press', 'barbell', sets(4, '5', '70')],
            ['Barbell Row', 'barbell', sets(4, '6', '60')],
            ['Overhead Press', 'barbell', sets(3, '6', '40')],
            ['Pull-up', 'bodyweight', sets(3, '8', '')],
          ]),
          d2: run('Easy Run', 4, [['easy', 'distance', '8']]),
          d3: lift('Lower Power', 8, [
            ['Back Squat', 'barbell', sets(4, '5', '90')],
            ['Romanian Deadlift', 'barbell', sets(3, '8', '70')],
            ['Leg Press', 'machine', sets(3, '10', '140')],
            ['Machine Calf Raise', 'machine', sets(4, '12', '70')],
          ]),
          d4: run('Tempo Run', 7, [['warm-up', 'time', '10'], ['tempo', 'distance', '6'], ['cool-down', 'time', '5']]),
          d5: lift('Upper Volume', 7, [
            ['Incline Dumbbell Bench Press', 'dumbbell', sets(4, '10', '24')],
            ['Seated Cable Row', 'machine', sets(4, '10', '50')],
            ['Dumbbell Lateral Raise', 'dumbbell', sets(4, '15', '10')],
            ['EZ Bar Curl', 'dumbbell', sets(3, '12', '25')],
            ['Tricep Pushdown', 'machine', sets(3, '12', '25')],
          ]),
          d6: {
            rpe: 7,
            template: {
              name: 'Lower Volume + Easy Run',
              type: 'hybrid',
              exerciseRows: [
                { exerciseName: 'Front Squat', category: 'barbell', sets: sets(3, '8', '60') },
                { exerciseName: 'Hip Thrust', category: 'machine', sets: sets(3, '10', '80') },
                { exerciseName: 'Seated Leg Curl', category: 'machine', sets: sets(3, '12', '45') },
              ],
              runRows: [{ segmentType: 'easy', metric: 'time', value: '25' }],
            },
          },
        },
      },
      {
        name: 'Intensity',
        startWeek: 7,
        endWeek: 12,
        deloadWeeks: [8, 12],
        sessions: {
          d1: lift('Upper Power', 8, [
            ['Bench Press', 'barbell', sets(4, '3', '80')],
            ['Barbell Row', 'barbell', sets(4, '5', '70')],
            ['Push Press', 'barbell', sets(3, '5', '47.5')],
            ['Chin Ups', 'bodyweight', sets(3, '8', '')],
          ]),
          d2: run('Easy Run', 4, [['easy', 'distance', '8']]),
          d3: lift('Lower Power', 8, [
            ['Back Squat', 'barbell', sets(4, '3', '105')],
            ['Conventional Deadlift', 'barbell', sets(3, '3', '120')],
            ['Dumbbell Bulgarian Split Squat', 'dumbbell', sets(3, '8', '16')],
          ]),
          d4: run('Threshold Run', 8, [['warm-up', 'time', '10'], ['tempo', 'distance', '8'], ['cool-down', 'time', '5']]),
          d5: lift('Upper Volume', 7, [
            ['Dumbbell Bench Press', 'dumbbell', sets(4, '8', '28')],
            ['T-Bar Row', 'barbell', sets(4, '8', '50')],
            ['Machine Shoulder Press', 'machine', sets(3, '10', '40')],
            ['Preacher Curl', 'barbell', sets(3, '10', '25')],
            ['Lying Tricep Extension', 'barbell', sets(3, '10', '25')],
          ]),
          d6: {
            rpe: 7,
            template: {
              name: 'Lower Volume + Easy Run',
              type: 'hybrid',
              exerciseRows: [
                { exerciseName: 'Hack Squat Machine', category: 'machine', sets: sets(3, '10', '100') },
                { exerciseName: 'Romanian Deadlift', category: 'barbell', sets: sets(3, '8', '80') },
                { exerciseName: 'Machine Calf Raise', category: 'machine', sets: sets(4, '12', '80') },
              ],
              runRows: [{ segmentType: 'easy', metric: 'time', value: '25' }],
            },
          },
        },
      },
    ],
  },

  'concurrent-peaking': {
    name: 'Concurrent Peaking',
    weeks: 16,
    weightProgressKgPerWeek: 1.25,
    runProgressMinPerWeek: 2,
    phases: [
      {
        name: 'Base',
        startWeek: 1,
        endWeek: 6,
        deloadWeeks: [4],
        sessions: {
          d1: lift('Heavy Squat', 8, [
            ['Back Squat', 'barbell', sets(4, '5', '100')],
            ['Romanian Deadlift', 'barbell', sets(3, '8', '80')],
            ['Walking Lunge', 'bodyweight', sets(3, '10', '')],
          ]),
          d2: run('Easy Run', 4, [['easy', 'distance', '10']]),
          d3: run('Intervals', 8, [['warm-up', 'time', '12'], ['interval', 'time', '18'], ['cool-down', 'time', '10']]),
          d4: lift('Bench + OHP', 7, [
            ['Bench Press', 'barbell', sets(4, '5', '75')],
            ['Overhead Press', 'barbell', sets(3, '6', '42.5')],
            ['Pull-up', 'bodyweight', sets(4, 'max', '')],
          ]),
          d5: run('Tempo Run', 7, [['warm-up', 'time', '10'], ['tempo', 'distance', '6'], ['cool-down', 'time', '10']]),
          d6: lift('Deadlift', 8, [
            ['Conventional Deadlift', 'barbell', sets(4, '4', '130')],
            ['Barbell Row', 'barbell', sets(3, '8', '65')],
            ['Hollow Body Hold', 'bodyweight', sets(3, '30s', '')],
          ]),
          d7: run('Long Run', 5, [['easy', 'distance', '18']]),
        },
      },
      {
        name: 'Build',
        startWeek: 7,
        endWeek: 12,
        deloadWeeks: [8, 12],
        sessions: {
          d1: lift('Heavy Squat', 8, [
            ['Back Squat', 'barbell', sets(4, '3', '110')],
            ['Front Squat', 'barbell', sets(3, '5', '70')],
            ['Glute Bridge', 'bodyweight', sets(3, '15', '')],
          ]),
          d2: run('Easy Run', 4, [['easy', 'distance', '10']]),
          d3: run('Intervals', 8, [['warm-up', 'time', '12'], ['interval', 'time', '24'], ['cool-down', 'time', '10']]),
          d4: lift('Bench + OHP', 7, [
            ['Bench Press', 'barbell', sets(4, '3', '82.5')],
            ['Push Press', 'barbell', sets(3, '5', '50')],
            ['Chin Ups', 'bodyweight', sets(4, 'max', '')],
          ]),
          d5: run('Tempo Run', 7, [['warm-up', 'time', '10'], ['tempo', 'distance', '8'], ['cool-down', 'time', '10']]),
          d6: lift('Deadlift', 8, [
            ['Conventional Deadlift', 'barbell', sets(4, '2', '145')],
            ['T-Bar Row', 'barbell', sets(3, '8', '55')],
            ['Leg Raise', 'bodyweight', sets(3, '12', '')],
          ]),
          d7: run('Long Run', 6, [['easy', 'distance', '24']]),
        },
      },
      {
        name: 'Peak & Taper',
        startWeek: 13,
        endWeek: 16,
        deloadWeeks: [15, 16],
        sessions: {
          d1: lift('Squat Peak', 9, [
            ['Back Squat', 'barbell', sets(3, '2', '120')],
            ['Glute Bridge', 'bodyweight', sets(3, '12', '')],
          ]),
          d2: run('Easy Run', 3, [['easy', 'distance', '8']]),
          d3: run('Race Pace', 8, [['warm-up', 'time', '10'], ['tempo', 'distance', '10'], ['cool-down', 'time', '10']]),
          d4: lift('Bench Peak', 9, [
            ['Bench Press', 'barbell', sets(3, '2', '90')],
            ['Pull-up', 'bodyweight', sets(3, '8', '')],
          ]),
          d6: run('Easy Run', 3, [['easy', 'distance', '6']]),
          d7: run('Long Run', 5, [['easy', 'distance', '26']]),
        },
      },
    ],
  },

  'couch-to-hybrid': {
    name: 'Couch to Hybrid',
    weeks: 16,
    weightProgressKgPerWeek: 2.5,
    runProgressMinPerWeek: 2,
    phases: [
      {
        name: 'Foundation',
        startWeek: 1,
        endWeek: 8,
        deloadWeeks: [4, 8],
        sessions: {
          d1: lift('Full Body A', 5, [
            ['Bodyweight Squat', 'bodyweight', sets(3, '12', '')],
            ['Push Ups', 'bodyweight', sets(3, '8', '')],
            ['Lat Pulldown', 'machine', sets(3, '10', '25')],
            ['Plank', 'bodyweight', sets(3, '20s', '')],
          ]),
          d2: run('Walk/Run Intervals', 4, [['warm-up', 'time', '5'], ['easy', 'time', '15'], ['cool-down', 'time', '5']]),
          d4: lift('Full Body B', 5, [
            ['Goblet Squat', 'dumbbell', sets(3, '10', '8')],
            ['Dumbbell Shoulder Press', 'dumbbell', sets(3, '10', '6')],
            ['Seated Cable Row', 'machine', sets(3, '10', '25')],
            ['Glute Bridge', 'bodyweight', sets(3, '12', '')],
          ]),
          d5: run('Walk/Run Intervals', 4, [['warm-up', 'time', '5'], ['easy', 'time', '15'], ['cool-down', 'time', '5']]),
          d7: lift('Full Body C', 5, [
            ['Reverse Lunge', 'bodyweight', sets(3, '8', '')],
            ['Incline Dumbbell Bench Press', 'dumbbell', sets(3, '10', '8')],
            ['Dumbbell Row', 'dumbbell', sets(3, '10', '10')],
            ['Dead Bug', 'bodyweight', sets(3, '8', '')],
          ]),
        },
      },
      {
        name: 'Progression',
        startWeek: 9,
        endWeek: 16,
        deloadWeeks: [12, 16],
        sessions: {
          d1: lift('Full Body A', 6, [
            ['Back Squat', 'barbell', sets(3, '5', '30')],
            ['Bench Press', 'barbell', sets(3, '5', '25')],
            ['Lat Pulldown', 'machine', sets(3, '10', '35')],
            ['Plank', 'bodyweight', sets(3, '40s', '')],
          ]),
          d2: run('Easy Run', 4, [['warm-up', 'time', '5'], ['easy', 'time', '20'], ['cool-down', 'time', '5']]),
          d4: lift('Full Body B', 6, [
            ['Conventional Deadlift', 'barbell', sets(3, '5', '40')],
            ['Overhead Press', 'barbell', sets(3, '5', '20')],
            ['Seated Cable Row', 'machine', sets(3, '10', '35')],
            ['Glute Bridge', 'bodyweight', sets(3, '15', '')],
          ]),
          d5: run('Easy Run', 4, [['warm-up', 'time', '5'], ['easy', 'time', '20'], ['cool-down', 'time', '5']]),
          d7: run('Long Walk/Run', 5, [['easy', 'distance', '5']]),
        },
      },
    ],
  },
}

/** True when a full startable plan exists for this programme card id. */
export function hasBuiltinPlan(cardId: string): boolean {
  return cardId in BUILTIN_PLANS
}
