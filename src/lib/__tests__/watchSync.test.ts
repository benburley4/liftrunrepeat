import { describe, it, expect } from 'vitest'
import { syncState, fmtAgo, parseJson } from '../watchSync'

const now = new Date('2026-10-25T10:00:00Z')

describe('syncState', () => {
  it('is "never" without a watch', () => {
    expect(syncState(null, null, now)).toEqual({ kind: 'never' })
  })
  it('reports the last sync and whether it is stale', () => {
    expect(syncState({ at: '2026-10-25T09:48:00Z', ok: true }, null, now)).toEqual({ kind: 'synced', at: '2026-10-25T09:48:00Z', ok: true, stale: false })
    expect(syncState({ at: '2026-10-25T01:00:00Z', ok: true }, null, now)).toMatchObject({ kind: 'synced', stale: true })
  })
  it('is pending while a newer request waits for the PC, then unanswered after 3 minutes', () => {
    const status = { at: '2026-10-25T08:00:00Z', ok: true }
    expect(syncState(status, { at: '2026-10-25T09:59:00Z' }, now)).toEqual({ kind: 'pending', since: '2026-10-25T09:59:00Z' })
    expect(syncState(status, { at: '2026-10-25T09:50:00Z' }, now)).toEqual({ kind: 'unanswered' })
  })
  it('treats a request older than the last sync as answered', () => {
    expect(syncState({ at: '2026-10-25T09:59:30Z', ok: true }, { at: '2026-10-25T09:59:00Z' }, now)).toMatchObject({ kind: 'synced' })
  })
})

describe('fmtAgo', () => {
  it('formats relative times', () => {
    expect(fmtAgo('2026-10-25T09:59:40Z', now)).toBe('just now')
    expect(fmtAgo('2026-10-25T09:48:00Z', now)).toBe('12 min ago')
    expect(fmtAgo('2026-10-25T07:00:00Z', now)).toBe('3 h ago')
    expect(fmtAgo('2026-10-22T10:00:00Z', now)).toBe('3 d ago')
  })
})

describe('parseJson', () => {
  it('returns null for missing or malformed values', () => {
    expect(parseJson(null)).toBeNull()
    expect(parseJson('{oops')).toBeNull()
    expect(parseJson<{ at: string }>('{"at":"x"}')).toEqual({ at: 'x' })
  })
})
