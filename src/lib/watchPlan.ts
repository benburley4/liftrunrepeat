// Run templates / programme days → ZeppBridge "zeppbridge-plan/3" plans, which
// scripts/zepp-watch-push.mjs hands to ZeppBridge's MCP tools
// (draft_training_plan → publish_training_plan) to put guided workouts on the
// Amazfit watch. Pure and dependency-free: the Node script imports it directly.
//
// Zepp limits (from ZeppBridge's tool contract): only running / cycling /
// swimming reach the watch; name ≤ 14 chars; focus + description required;
// repeats can't nest; dates from today to today + 56 days.

export interface PlanRunSegment { segmentType: string; metric: 'distance' | 'time' | 'pace' | 'hr'; value: string; pace?: string }
export interface PlanRepeatBlock { kind: 'repeat'; count: string; laps: PlanRunSegment[] }
export type PlanRunEntry = PlanRunSegment | PlanRepeatBlock

export interface PlanTemplate { name: string; type: string; runRows?: PlanRunEntry[] }
export interface PlanProgramme { name: string; weeks: number; startDate: string; cells: Record<string, { template: PlanTemplate }> }

export type StepKind = 'warmup' | 'active' | 'interval' | 'recovery' | 'rest' | 'cooldown'
export interface ZeppStep { kind: StepKind; duration: string; target?: string; note?: string }
export interface ZeppRepeat { repeat: number; steps: ZeppStep[] }
export interface ZeppPlanWorkout {
  date: string
  sport: 'running'
  variant: 'outdoor' | 'treadmill' | 'track' | 'trail'
  name: string
  focus: string
  description: string
  steps: (ZeppStep | ZeppRepeat)[]
}
export interface ZeppPlan {
  format: 'zeppbridge-plan/3'
  summary: string
  from: string
  to: string
  workouts: ZeppPlanWorkout[]
}

export const PLAN_FORMAT = 'zeppbridge-plan/3'
export const MAX_DAYS_AHEAD = 56
export const NAME_MAX = 14

const KIND: Record<string, StepKind> = {
  'warm-up': 'warmup',
  'cool-down': 'cooldown',
  easy: 'active',
  tempo: 'active',
  custom: 'active',
  interval: 'interval',
  hills: 'interval',
  strides: 'interval',
  rest: 'recovery',
}

const LABEL: Record<string, string> = {
  'warm-up': 'warm-up', 'cool-down': 'cool-down', easy: 'easy', tempo: 'tempo', custom: 'run',
  interval: 'interval', hills: 'hills', strides: 'strides', rest: 'recovery',
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** "30:00" → 30, "25" → 25, "1:05:00" → 65, "45s"-style input is not used by the builder. */
export function parseMinutes(value: string): number | null {
  const v = value.trim()
  if (!v) return null
  if (/^\d+(\.\d+)?$/.test(v)) return parseFloat(v)
  const parts = v.split(':').map(Number)
  if (parts.some(n => !Number.isFinite(n))) return null
  if (parts.length === 2) return parts[0] + parts[1] / 60
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60
  return null
}

/** "5:30" → 330 s/km */
function paceSeconds(pace: string): number | null {
  const [m, s] = pace.trim().split(':').map(Number)
  return Number.isFinite(m) ? m * 60 + (Number.isFinite(s) ? s : 0) : null
}
const fmtPace = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`

function fmtDuration(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)}s`
  if (minutes % 60 === 0) return `${minutes / 60}h`
  return Number.isInteger(minutes) ? `${minutes}min` : `${Math.round(minutes * 60)}s`
}

function fmtDistance(km: number): string {
  return km < 1 || !Number.isInteger(km) ? `${Math.round(km * 1000)}m` : `${km}km`
}

/** Pace target as a ±5 s band ("pace 5:25-5:35"); HR as ±5 bpm. */
function target(seg: PlanRunSegment): string | undefined {
  const pace = seg.metric === 'pace' ? seg.value : seg.pace
  const p = pace ? paceSeconds(pace) : null
  if (p) return `pace ${fmtPace(p - 5)}-${fmtPace(p + 5)}`
  if (seg.metric === 'hr') {
    const hr = parseInt(seg.value)
    if (hr > 0) return `hr ${hr - 5}-${hr + 5}`
  }
  return undefined
}

export interface StepResult { step: ZeppStep | null; issue?: string }

export function segmentToStep(seg: PlanRunSegment): StepResult {
  const kind = KIND[seg.segmentType] ?? 'active'
  const label = LABEL[seg.segmentType] ?? seg.segmentType
  let duration: string | null = null
  if (seg.metric === 'distance') {
    const km = parseFloat(seg.value)
    if (km > 0) duration = fmtDistance(km)
  } else if (seg.metric === 'time') {
    const min = parseMinutes(seg.value)
    if (min && min > 0) duration = fmtDuration(min)
  }
  if (!duration) return { step: null, issue: `${label}: needs a distance or time` }
  const t = target(seg)
  return { step: { kind, duration, ...(t ? { target: t } : {}) } }
}

/** Builder entries → watch steps. Nested repeats aren't possible in the builder; empty ones are dropped. */
export function entriesToSteps(entries: PlanRunEntry[]): { steps: (ZeppStep | ZeppRepeat)[]; issues: string[] } {
  const steps: (ZeppStep | ZeppRepeat)[] = []
  const issues: string[] = []
  for (const e of entries) {
    if ('kind' in e && e.kind === 'repeat') {
      const inner = e.laps.map(segmentToStep)
      inner.forEach(r => r.issue && issues.push(r.issue))
      const ok = inner.map(r => r.step).filter((s): s is ZeppStep => !!s)
      const n = parseInt(e.count) || 1
      if (ok.length) steps.push(n > 1 ? { repeat: n, steps: ok } : ok[0])
      if (ok.length > 1 && n <= 1) steps.push(...ok.slice(1))
    } else {
      const r = segmentToStep(e as PlanRunSegment)
      if (r.issue) issues.push(r.issue)
      if (r.step) steps.push(r.step)
    }
  }
  return { steps, issues }
}

function describe(steps: (ZeppStep | ZeppRepeat)[]): string {
  const one = (s: ZeppStep) => `${s.duration} ${s.kind}${s.target ? ` @ ${s.target.replace(/^(pace|hr) /, '')}${s.target.startsWith('hr') ? ' bpm' : '/km'}` : ''}`
  return steps.map(s => ('repeat' in s ? `${s.repeat}× (${s.steps.map(one).join(', ')})` : one(s))).join(' · ')
}

function variantFor(name: string): ZeppPlanWorkout['variant'] {
  const n = name.toLowerCase()
  if (n.includes('treadmill')) return 'treadmill'
  if (n.includes('track')) return 'track'
  if (n.includes('trail')) return 'trail'
  return 'outdoor'
}

function focusFor(entries: PlanRunEntry[]): string {
  const types = entries.flatMap(e => ('kind' in e && e.kind === 'repeat' ? e.laps : [e as PlanRunSegment])).map(s => s.segmentType)
  if (types.some(t => t === 'interval' || t === 'strides')) return 'Intervals'
  if (types.includes('hills')) return 'Hills'
  if (types.includes('tempo')) return 'Tempo'
  return 'Easy aerobic'
}

/** One template on one date → a watch workout (or the reason it can't be sent). */
export function templateToWorkout(t: PlanTemplate, date: string): { workout: ZeppPlanWorkout | null; issues: string[] } {
  const entries = t.runRows ?? []
  if (!entries.length) return { workout: null, issues: [`${t.name}: no run segments`] }
  const { steps, issues } = entriesToSteps(entries)
  if (!steps.length) return { workout: null, issues: issues.length ? issues : [`${t.name}: no usable run segments`] }
  return {
    workout: {
      date,
      sport: 'running',
      variant: variantFor(t.name),
      name: t.name.trim().slice(0, NAME_MAX) || 'Run',
      focus: focusFor(entries),
      description: `${t.type === 'hybrid' ? 'Run part of a hybrid session: ' : ''}${describe(steps)}`.slice(0, 280),
      steps,
    },
    issues,
  }
}

/** Programmed sessions with run segments (run + hybrid templates) between two dates. */
export function programmeRunsBetween(p: PlanProgramme, from: string, to: string): { date: string; template: PlanTemplate }[] {
  // Weeks run Monday–Sunday from the Monday of the start date (as the calendar and Today page do).
  const dow = new Date(`${p.startDate}T00:00:00Z`).getUTCDay()
  const monday = shiftDate(p.startDate, dow === 0 ? -6 : 1 - dow)
  const out: { date: string; template: PlanTemplate }[] = []
  for (let date = from; date <= to; date = shiftDate(date, 1)) {
    const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${monday}T00:00:00Z`)) / 86400000)
    if (days < 0 || Math.floor(days / 7) >= p.weeks) continue
    for (const sfx of ['', '_2']) {
      const cell = p.cells[`w${Math.floor(days / 7)}d${days % 7}${sfx}`]
      if (cell && (cell.template.runRows ?? []).length && (cell.template.type === 'run' || cell.template.type === 'hybrid'))
        out.push({ date, template: cell.template })
    }
  }
  return out
}

export interface BuiltPlan { plan: ZeppPlan | null; issues: string[] }

/**
 * Wraps workouts into a plan for `from`–`to`. Note ZeppBridge treats days in
 * that range without a workout as rest days and clears its own earlier plan
 * for them — callers pick the range accordingly.
 */
export function buildPlan(items: { date: string; template: PlanTemplate }[], from: string, to: string, summary: string, today: string): BuiltPlan {
  const issues: string[] = []
  if (from < today) issues.push('Dates must be today or later')
  if (to > shiftDate(today, MAX_DAYS_AHEAD)) issues.push(`Dates must be within ${MAX_DAYS_AHEAD} days`)
  const workouts: ZeppPlanWorkout[] = []
  for (const { date, template } of items) {
    const r = templateToWorkout(template, date)
    issues.push(...r.issues)
    if (r.workout) workouts.push(r.workout)
  }
  if (!workouts.length) issues.push('No runs to send')
  const blocking = !workouts.length || from < today || to > shiftDate(today, MAX_DAYS_AHEAD)
  return { plan: blocking ? null : { format: PLAN_FORMAT, summary, from, to, workouts }, issues }
}

/**
 * Every push to ZeppBridge replaces the 7-day windows it covers, so a send
 * must re-include runs sent earlier or they'd vanish from the watch. Merges
 * the ledger of already-sent runs with the new ones (a new run replaces any
 * earlier run on its date; past dates drop off) into one plan from today to
 * the last run.
 */
export function mergeWithSent(sent: ZeppPlanWorkout[], incoming: ZeppPlanWorkout[], today: string, summary: string): ZeppPlan | null {
  const newDates = new Set(incoming.map(w => w.date))
  const workouts = [...sent.filter(w => w.date >= today && !newDates.has(w.date)), ...incoming.filter(w => w.date >= today)]
    .sort((a, b) => a.date.localeCompare(b.date))
  if (!workouts.length) return null
  return { format: PLAN_FORMAT, summary, from: today, to: workouts[workouts.length - 1].date, workouts }
}
