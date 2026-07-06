// Athlete profile — one persistent record that feeds every AI feature so the
// coach knows who it's coaching. Stored in user_settings under 'athlete_profile'.

import { getSetting, upsertSetting } from './db'

export const PROFILE_KEY = 'athlete_profile'

export interface AthleteProfile {
  age?: string
  sex?: string
  bodyweightKg?: string
  trainingAgeYears?: string          // years of consistent training
  squat1RM?: string                  // kg
  bench1RM?: string                  // kg
  deadlift1RM?: string               // kg
  ohp1RM?: string                    // kg
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
  if (profile.age) lines.push(`- Age: ${profile.age}`)
  if (profile.sex) lines.push(`- Sex: ${profile.sex}`)
  if (profile.bodyweightKg) lines.push(`- Bodyweight: ${profile.bodyweightKg} kg`)
  if (profile.trainingAgeYears) lines.push(`- Training age: ${profile.trainingAgeYears} years`)
  const rms = [
    profile.squat1RM && `Squat ${profile.squat1RM} kg`,
    profile.bench1RM && `Bench ${profile.bench1RM} kg`,
    profile.deadlift1RM && `Deadlift ${profile.deadlift1RM} kg`,
    profile.ohp1RM && `OHP ${profile.ohp1RM} kg`,
  ].filter(Boolean)
  if (rms.length) lines.push(`- Current 1RMs: ${rms.join(', ')}`)
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
