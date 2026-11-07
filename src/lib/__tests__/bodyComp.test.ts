import { describe, expect, it } from 'vitest'
import { offsetMinutes, toBodyReading, type BodyReading } from '../renpho'
import { bucketBody, dailyBody, metricChange } from '../bodyComp'

const ME = '5975813831868809088'

const raw = (over: Record<string, unknown> = {}) => ({
  id: 'r1', bUserId: ME, timeStamp: 1793980301, timeZone: '+8:00', weight: 94.6, bodyfat: 18.1096, bmi: 28.6, water: 59.1,
  muscle: 52.9, bone: 3.87, bmr: 2042, visfat: 11, subfat: 15.1, protein: 18.7, bodyage: 48, sinew: 73.6, fatFreeWeight: 77.4,
  heartRate: 0, ...over,
})

const reading = (date: string, measured_at: string, over: Partial<BodyReading> = {}): BodyReading => ({
  reading_id: measured_at, measured_at, date, weight_kg: 100, bmi: 30, body_fat_pct: 20, water_pct: 59, muscle_pct: 52, bone_kg: 4,
  bmr_kcal: 2000, visceral_fat: 11, subcutaneous_fat_pct: 15, protein_pct: 18, body_age: 48, lean_mass_kg: 76, fat_free_kg: 80, ...over,
})

describe('toBodyReading', () => {
  it('maps a reading and rounds to 2 places', () => {
    expect(toBodyReading(raw(), ME)).toMatchObject({
      reading_id: 'r1', weight_kg: 94.6, body_fat_pct: 18.11, bone_kg: 3.87, fat_free_kg: 77.4, lean_mass_kg: 73.6,
    })
  })

  it("drops another person's profile on the same account", () => {
    expect(toBodyReading(raw({ bUserId: '5975813831868809999' }), ME)).toBeNull()
  })

  it('compares long ids exactly, as strings', () => {
    expect(toBodyReading(raw({ bUserId: '5975813831868809089' }), ME)).toBeNull()
  })

  it('treats 0 as not measured', () => {
    expect(toBodyReading(raw({ bodyfat: 0, muscle: 0 }), ME)).toMatchObject({ body_fat_pct: null, muscle_pct: null, weight_kg: 94.6 })
  })

  it('skips records with no weight or time', () => {
    expect(toBodyReading(raw({ weight: 0 }), ME)).toBeNull()
    expect(toBodyReading(raw({ timeStamp: 0 }), ME)).toBeNull()
  })

  it("dates the reading in its own time zone", () => {
    // 2026-11-05 23:31 UTC is already 6 Nov in Hong Kong, still 5 Nov in London.
    const ts = Date.parse('2026-11-05T23:31:00Z') / 1000
    expect(toBodyReading(raw({ timeStamp: ts }), ME)?.date).toBe('2026-11-06')
    expect(toBodyReading(raw({ timeStamp: ts, timeZone: '+0:00' }), ME)?.date).toBe('2026-11-05')
  })
})

describe('offsetMinutes', () => {
  it('parses zones and falls back to Hong Kong', () => {
    expect(offsetMinutes('+9:00')).toBe(540)
    expect(offsetMinutes('-5:30')).toBe(-330)
    expect(offsetMinutes(undefined)).toBe(480)
  })
})

describe('dailyBody', () => {
  it('keeps the first reading of the day that has composition', () => {
    const days = dailyBody([
      reading('2026-11-01', '2026-10-31T22:00:00Z', { body_fat_pct: null }),
      reading('2026-11-01', '2026-11-01T12:00:00Z', { body_fat_pct: 21 }),
      reading('2026-11-01', '2026-10-31T23:00:00Z', { body_fat_pct: 19 }),
    ])
    expect(days).toHaveLength(1)
    expect(days[0].body_fat_pct).toBe(19)
  })

  it('derives fat mass from that reading', () => {
    expect(dailyBody([reading('2026-11-01', '2026-11-01T00:00:00Z', { weight_kg: 94.6, body_fat_pct: 18.1 })])[0].fat_mass_kg).toBe(17.1)
  })

  it('leaves out days with weight only, oldest first', () => {
    const days = dailyBody([
      reading('2026-11-02', '2026-11-02T00:00:00Z'),
      reading('2026-11-03', '2026-11-03T00:00:00Z', { body_fat_pct: null }),
      reading('2026-11-01', '2026-11-01T00:00:00Z'),
    ])
    expect(days.map(d => d.date)).toEqual(['2026-11-01', '2026-11-02'])
  })
})

describe('bucketBody', () => {
  const days = dailyBody([
    reading('2026-11-02', '2026-11-02T00:00:00Z', { body_fat_pct: 18 }),   // Monday
    reading('2026-11-03', '2026-11-03T00:00:00Z', { body_fat_pct: 20, water_pct: null }),
    reading('2026-11-09', '2026-11-09T00:00:00Z', { body_fat_pct: 22 }),   // next Monday
  ])

  it('passes days through', () => {
    expect(bucketBody(days, 'day')).toBe(days)
  })

  it('averages each metric per week, ignoring gaps', () => {
    const weeks = bucketBody(days, 'week')
    expect(weeks.map(w => w.date)).toEqual(['2026-11-02', '2026-11-09'])
    expect(weeks[0]).toMatchObject({ body_fat_pct: 19, water_pct: 59 })
  })

  it('averages per calendar month', () => {
    const months = bucketBody(days, 'month')
    expect(months).toHaveLength(1)
    expect(months[0]).toMatchObject({ date: '2026-11-01', body_fat_pct: 20 })
  })
})

describe('metricChange', () => {
  const days = dailyBody([
    reading('2026-11-01', '2026-11-01T00:00:00Z', { body_fat_pct: 20 }),
    reading('2026-11-02', '2026-11-02T00:00:00Z', { body_fat_pct: 18.5 }),
  ])

  it('reports the latest value and change across the range', () => {
    expect(metricChange(days, 'body_fat_pct')).toEqual({ latest: 18.5, change: -1.5 })
  })

  it('has no change from a single value, and nothing from none', () => {
    expect(metricChange(days.slice(0, 1), 'body_fat_pct')).toEqual({ latest: 20, change: null })
    expect(metricChange([], 'body_fat_pct')).toBeNull()
  })
})
