import { describe, it, expect } from 'vitest'
import { rangeBuckets, previousBuckets, bucketIndex, bucketSpan, bucketTitle, isRangeId, MAX_ALL_MONTHS } from '../progressRange'

describe('rangeBuckets', () => {
  it('builds Monday-start weeks ending with the current week', () => {
    const b = rangeBuckets('4w', '2026-10-26')   // a Monday
    expect(b.map(x => x.start)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'])
    expect(b[3].end).toBe('2026-11-02')
    expect(b[0].label).toBe('5 Oct')
  })

  it('includes the current week when today is a Sunday', () => {
    const b = rangeBuckets('12w', '2026-10-25')
    expect(b).toHaveLength(12)
    expect(b[11].start).toBe('2026-10-19')
  })

  it('uses months from the first session for "all"', () => {
    const b = rangeBuckets('all', '2026-10-26', '2025-12-14')
    expect(b.map(x => x.key)).toEqual(['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'])
    expect(b[0]).toMatchObject({ start: '2025-12-01', end: '2026-01-01', label: 'Dec 25' })
  })

  it('caps "all" at ten years and falls back to one month without data', () => {
    expect(rangeBuckets('all', '2026-10-26', '2001-01-01')).toHaveLength(MAX_ALL_MONTHS)
    expect(rangeBuckets('all', '2026-10-26', null)).toHaveLength(1)
  })
})

describe('previousBuckets', () => {
  it('returns the same number of weeks immediately before', () => {
    const prev = previousBuckets(rangeBuckets('4w', '2026-10-26'))
    expect(prev.map(x => x.start)).toEqual(['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'])
  })
  it('handles monthly buckets across a year boundary', () => {
    const prev = previousBuckets(rangeBuckets('all', '2026-02-10', '2026-01-03'))
    expect(prev.map(x => x.key)).toEqual(['2025-11', '2025-12'])
  })
})

describe('bucketIndex / span / title', () => {
  const b = rangeBuckets('4w', '2026-10-26')
  it('finds the bucket holding a date and rejects dates outside', () => {
    expect(bucketIndex(b, '2026-10-05')).toBe(0)
    expect(bucketIndex(b, '2026-10-18')).toBe(1)
    expect(bucketIndex(b, '2026-11-01')).toBe(3)
    expect(bucketIndex(b, '2026-10-04')).toBe(-1)
    expect(bucketIndex(b, '2026-11-02')).toBe(-1)
  })
  it('spans the whole range and titles buckets', () => {
    expect(bucketSpan(b)).toEqual({ start: '2026-10-05', end: '2026-11-02' })
    expect(bucketTitle(b[0])).toBe('Week of 5 Oct')
    expect(bucketTitle(rangeBuckets('all', '2026-10-26', '2026-10-01')[0])).toBe('October 2026')
  })
  it('validates range ids', () => {
    expect(isRangeId('6m')).toBe(true)
    expect(isRangeId('3y')).toBe(false)
  })
})
