// Athlete profile — one persistent record that feeds every AI feature so the
// coach knows who it's coaching. Stored in user_settings under 'athlete_profile'.

import { getSetting, upsertSetting } from './db'

export const PROFILE_KEY = 'athlete_profile'

export interface AthleteProfile {
  age?: string                       // legacy manual entry — superseded by dob when set
  dob?: string                       // YYYY-MM-DD; age is derived from this
  sex?: string
  bodyweightKg?: string
  trainingAgeYears?: string          // legacy manual entry — superseded by trainingStartDate when set
  trainingStartDate?: string         // YYYY-MM-DD; training age is derived from this
  squat1RM?: string                  // kg
  bench1RM?: string                  // kg
  deadlift1RM?: string               // kg
  ohp1RM?: string                    // kg
  best5k?: string                    // e.g. "22:41"
  best10k?: string                   // e.g. "48:30"
  bestHalf?: string                  // e.g. "1:45:00"
  bestMarathon?: string              // e.g. "3:50:00"
  raceDistance?: string              // e.g. "5K", "10K", "Half Marathon", "Marathon", "Trail 50K"
  raceDate?: string                  // YYYY-MM-DD
  raceTargetTime?: string            // e.g. "1:45:00"
  recentRaceResult?: string          // e.g. "10K in 48:30 (May 2026)"
  injuries?: string                  // free text
  notes?: string                     // anything else: sleep, work schedule, equipment
}

export const EMPTY_PROFILE: AthleteProfile = {}

export async function loadProfile(): Promise<AthleteProfile> {
  try {
    const raw = await getSetting(PROFILE_KEY)
    return raw ? { ...EMPTY_PROFILE, ...JSON.parse(raw) } : EMPTY_PROFILE
  } catch {
    return EMPTY_PROFILE
  }
}

export async function saveProfile(profile: AthleteProfile): Promise<void> {
  await upsertSetting(PROFILE_KEY, JSON.stringify(profile))
}

/** Whole years elapsed since a YYYY-MM-DD date, or null if missing/invalid/future. */
function yearsSince(dateStr: string | undefined, from?: Date): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return null
  const now = from ?? new Date()
  let years = now.getFullYear() - d.getFullYear()
  const anniversary = new Date(d)
  anniversary.setFullYear(now.getFullYear())
  if (now < anniversary) years--
  return years >= 0 ? years : null
}

/** Age in whole years — derived from dob, falling back to the legacy manual field. */
export function derivedAge(profile: AthleteProfile, from?: Date): string {
  const y = yearsSince(profile.dob, from)
  return y !== null ? String(y) : (profile.age ?? '')
}

/** Training age in whole years — derived from trainingStartDate, falling back to the legacy manual field. */
export function derivedTrainingYears(profile: AthleteProfile, from?: Date): string {
  const y = yearsSince(profile.trainingStartDate, from)
  return y !== null ? String(y) : (profile.trainingAgeYears ?? '')
}

/** Days until race date, or null if no/past date. */
export function daysToRace(profile: AthleteProfile, from?: Date): number | null {
  if (!profile.raceDate) return null
  const race = new Date(profile.raceDate + 'T00:00:00')
  if (isNaN(race.getTime())) return null
  const now = from ?? new Date()
  now.setHours(0, 0, 0, 0)
  const days = Math.round((race.getTime() - now.getTime()) / 86400000)
  return days >= 0 ? days : null
}

/**
 * Serialises the profile into prompt lines for the AI coach/generator.
 * Returns '' when the profile is empty so prompts stay unchanged for
 * users who haven't filled it in.
 */
export function profileToPrompt(profile: AthleteProfile | null | undefined): string {
  if (!profile) return ''
  const lines: string[] = []
  const age = derivedAge(profile)
  const trainingYears = derivedTrainingYears(profile)
  if (age) lines.push(`- Age: ${age}`)
  if (profile.sex) lines.push(`- Sex: ${profile.sex}`)
  if (profile.bodyweightKg) lines.push(`- Bodyweight: ${profile.bodyweightKg} kg`)
  if (trainingYears) lines.push(`- Training age: ${trainingYears} years`)
  const rms = [
    profile.squat1RM && `Squat ${profile.squat1RM} kg`,
    profile.bench1RM && `Bench ${profile.bench1RM} kg`,
    profile.deadlift1RM && `Deadlift ${profile.deadlift1RM} kg`,
    profile.ohp1RM && `OHP ${profile.ohp1RM} kg`,
  ].filter(Boolean)
  if (rms.length) lines.push(`- Current 1RMs: ${rms.join(', ')}`)
  const pbs = [
    profile.best5k && `5K ${profile.best5k}`,
    profile.best10k && `10K ${profile.best10k}`,
    profile.bestHalf && `Half Marathon ${profile.bestHalf}`,
    profile.bestMarathon && `Marathon ${profile.bestMarathon}`,
  ].filter(Boolean)
  if (pbs.length) lines.push(`- Race PBs: ${pbs.join(', ')}`)
  if (profile.raceDistance) {
    const days = daysToRace(profile)
    const when = profile.raceDate
      ? ` on ${profile.raceDate}${days !== null ? ` (${days} days away)` : ''}`
      : ''
    const target = profile.raceTargetTime ? `, target ${profile.raceTargetTime}` : ''
    lines.push(`- Goal race: ${profile.raceDistance}${when}${target}`)
  }
  if (profile.recentRaceResult) lines.push(`- Recent race result: ${profile.recentRaceResult}`)
  if (profile.injuries) lines.push(`- Injuries / limitations: ${profile.injuries}`)
  if (profile.notes) lines.push(`- Other context: ${profile.notes}`)
  if (!lines.length) return ''
  return `ATHLETE PROFILE:\n${lines.join('\n')}`
}
