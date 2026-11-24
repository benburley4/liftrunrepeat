// Everything the AI programme generator / review / revamp should know about
// the athlete: the stated profile plus what the watch measured. Client-side
// (reads through db.ts / RLS). Watch parts are optional and fail soft.

import { loadProfile, profileToPrompt } from './athleteProfile'
import { getSessions, getZeppDaily } from './db'
import { watchContextToPrompt } from './activity'
import { localToday, programmeResponseToPrompt } from './recovery'
import type { SessionData } from './computeStats'

/**
 * Profile + WATCH DATA (last 4 weeks) and, when `programmeStart` is given,
 * the athlete's week-by-week response since that programme started.
 */
export async function loadAthleteContext(opts: { programmeStart?: string } = {}): Promise<string> {
  const today = localToday()
  // Only the last 4 weeks of watch data is used here (plus, when given, the
  // weeks since the programme started) — window the read so the AI context
  // doesn't detoast the full 2018→now daily history.
  let sinceDays = 28
  if (opts.programmeStart) {
    const since = Math.ceil((Date.now() - new Date(opts.programmeStart).getTime()) / 86400e3)
    if (Number.isFinite(since)) sinceDays = Math.max(sinceDays, since + 1)
  }
  const [profile, rows, sessions] = await Promise.all([
    loadProfile().catch(() => null),
    getZeppDaily({ sinceDays }).catch(() => []),
    getSessions().catch(() => []),
  ])
  return [
    profileToPrompt(profile),
    watchContextToPrompt(rows, sessions as unknown as SessionData[], today),
    opts.programmeStart ? programmeResponseToPrompt(rows, opts.programmeStart, today) : '',
  ].filter(Boolean).join('\n\n')
}
