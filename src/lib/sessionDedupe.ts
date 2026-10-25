// One rule for duplicate sessions, used everywhere sessions are read.
//
// A session logged twice for the same day under the same name (e.g. saved,
// page reloaded, logged again) is the same workout: only the latest save
// counts. Genuinely separate sessions get distinct names at save time
// ("Outdoor Hike (2)"), so they never collide here.

interface SessionLike { date: string; name?: string; savedAt: string }

export function sessionKey(s: { date: string; name?: string }): string {
  return `${s.date}|${(s.name ?? '').trim().toLowerCase()}`
}

/** Keeps the latest save per date + name, preserving the input order. */
export function dedupeSessions<T extends SessionLike>(sessions: T[]): T[] {
  const latest = new Map<string, T>()
  for (const s of sessions) {
    const key = sessionKey(s)
    const cur = latest.get(key)
    if (!cur || s.savedAt > cur.savedAt) latest.set(key, s)
  }
  return sessions.filter(s => latest.get(sessionKey(s)) === s)
}

/** "Weights 2" → "Weights 2 (2)", or the next free number if that's taken too. */
export function separateSessionName(name: string, takenNames: string[]): string {
  const taken = new Set(takenNames.map(n => n.trim().toLowerCase()))
  for (let i = 2; ; i++) {
    const candidate = `${name} (${i})`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
}
