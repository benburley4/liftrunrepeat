import { describe, it, expect } from 'vitest'
import { dedupeSessions, separateSessionName } from '../sessionDedupe'

const s = (date: string, name: string, savedAt: string) => ({ date, name, savedAt })

describe('dedupeSessions', () => {
  it('keeps only the latest save per date + name (case/space-insensitive), in input order', () => {
    const a = s('2026-09-16', 'Hybrid Session', '2026-09-16T11:06:00Z')
    const b = s('2026-09-16', ' hybrid session', '2026-09-16T11:11:00Z')
    const c = s('2026-09-16', 'Outdoor Hike', '2026-09-16T12:00:00Z')
    const d = s('2026-09-17', 'Hybrid Session', '2026-09-17T09:00:00Z')
    expect(dedupeSessions([d, c, b, a])).toEqual([d, c, b])
  })

  it('treats numbered separate sessions as distinct', () => {
    const a = s('2026-10-21', 'Outdoor Hike', '2026-10-21T08:00:00Z')
    const b = s('2026-10-21', 'Outdoor Hike (2)', '2026-10-21T15:00:00Z')
    expect(dedupeSessions([a, b])).toHaveLength(2)
  })
})

describe('separateSessionName', () => {
  it('appends the next free number', () => {
    expect(separateSessionName('Outdoor Hike', ['Outdoor Hike'])).toBe('Outdoor Hike (2)')
    expect(separateSessionName('Outdoor Hike', ['Outdoor Hike', 'outdoor hike (2)'])).toBe('Outdoor Hike (3)')
  })
})
