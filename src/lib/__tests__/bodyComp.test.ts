import { describe, expect, it } from 'vitest'
import { offsetMinutes, toBodyReading, type BodyReading } from '../renpho'
import { bucketBody, compChange, dailyBody, linearFit, linearTrend, lowestWeights, weightChanges, type BodyDay } from '../bodyComp'

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

  it("can take the day's lightest reading instead", () => {
    const days = dailyBody([
      reading('2026-11-01', '2026-10-31T23:00:00Z', { weight_kg: 96, body_fat_pct: 19 }),
      reading('2026-11-01', '2026-11-01T01:00:00Z', { weight_kg: 95, body_fat_pct: 18 }),
      reading('2026-11-01', '2026-11-01T12:00:00Z', { weight_kg: 94, body_fat_pct: null }),
    ], 'lowest')
    expect(days[0].body_fat_pct).toBe(18)
  })

  it('takes the earlier reading when two tie for lowest', () => {
    const days = dailyBody([
      reading('2026-11-01', '2026-11-01T12:00:00Z', { weight_kg: 95, body_fat_pct: 21 }),
      reading('2026-11-01', '2026-11-01T01:00:00Z', { weight_kg: 95, body_fat_pct: 19 }),
    ], 'lowest')
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

describe('lowestWeights', () => {
  it('keeps the lowest reading each day, including weight-only ones', () => {
    expect(lowestWeights([
      reading('2026-11-02', '2026-11-02T00:00:00Z', { weight_kg: 96 }),
      reading('2026-11-01', '2026-11-01T00:00:00Z', { weight_kg: 97 }),
      reading('2026-11-01', '2026-11-01T12:00:00Z', { weight_kg: 95.5, body_fat_pct: null }),
    ])).toEqual([
      { date: '2026-11-01', weightKg: 95.5, morningKg: 95.5 },
      { date: '2026-11-02', weightKg: 96, morningKg: 96 },
    ])
  })
})

describe('linearTrend', () => {
  const line = (values: (number | null)[], stepDays = 7) => values.map((value, i) => ({
    date: new Date(Date.UTC(2026, 0, 1 + i * stepDays)).toISOString().slice(0, 10), value,
  }))

  it('reads a steady fall as decreasing, with the rate per week', () => {
    expect(linearTrend(line([100, 99.5, 99, 98.5]), 0.3)).toEqual({ direction: 'down', perWeek: -0.5, total: -1.5 })
  })

  it('reads a rise as increasing', () => {
    expect(linearTrend(line([90, 91, 92]), 0.3)?.direction).toBe('up')
  })

  it('calls a change inside the noise band steady', () => {
    expect(linearTrend(line([95, 95.1, 95, 95.1]), 0.3)?.direction).toBe('flat')
  })

  it("isn't set by one odd reading at the end", () => {
    const t = linearTrend(line([95, 95, 95, 95, 95, 95, 95, 95, 95, 96.5]), 0.3)!
    expect(t.total).toBeLessThan(1.5)
  })

  it('skips gaps', () => {
    expect(linearTrend(line([100, null, 99, null, 98]), 0.3)?.perWeek).toBe(-0.5)
  })

  it('needs 3 readings across at least a week', () => {
    expect(linearTrend(line([100, 99]), 0.3)).toBeNull()
    expect(linearTrend(line([100, 99, 98], 1), 0.3)).toBeNull()
  })
})

describe('weightChanges', () => {
  const points = [
    { date: '2026-11-02', weightKg: 100 },   // Monday
    { date: '2026-11-03', weightKg: 98 },
    { date: '2026-11-09', weightKg: 98.5 },  // next Monday
    { date: '2026-11-16', weightKg: 99 },
  ]

  it('compares each week with the one before', () => {
    expect(weightChanges(points, 'week')).toEqual([
      { date: '2026-11-09', avgKg: 98.5, changeKg: -0.5 },
      { date: '2026-11-16', avgKg: 99, changeKg: 0.5 },
    ])
  })

  it('keeps the comparison for the first period in a range', () => {
    expect(weightChanges(points, 'week', '2026-11-09')[0].changeKg).toBe(-0.5)
    expect(weightChanges(points, 'week', '2026-11-16')).toHaveLength(1)
  })

  it('works by month', () => {
    expect(weightChanges([{ date: '2026-10-05', weightKg: 100 }, ...points], 'month')).toEqual([
      { date: '2026-11-01', avgKg: 98.88, changeKg: -1.12 },
    ])
  })
})

describe('compChange', () => {
  const d = (date: string, fat: number, fatFree: number) =>
    ({ date, fat_mass_kg: fat, fat_free_kg: fatFree, body_fat_pct: Math.round(fat / (fat + fatFree) * 1000) / 10 }) as BodyDay

  it('compares the week up to the start with the week up to today', () => {
    const days = [d('2026-10-28', 18, 78), d('2026-11-01', 18, 78.2), d('2026-11-05', 17.2, 77.8), d('2026-11-07', 17, 77.6)]
    const c = compChange(days, '2026-11-02', '2026-11-08')!
    expect(c.from).toMatchObject({ date: '2026-11-01', fatKg: 18, fatFreeKg: 78.1 })
    expect(c.to).toMatchObject({ date: '2026-11-07', fatKg: 17.1, fatFreeKg: 77.7 })
    expect(c).toMatchObject({ fatKg: -0.9, fatFreeKg: -0.4 })
    expect(c.fatShare).toBe(69) // 0.9 of 1.3 kg
  })

  it('needs readings at both ends and holds back the fat share under 0.5 kg', () => {
    expect(compChange([d('2026-11-07', 17, 77.6)], '2026-11-07', '2026-11-08')).toBeNull()
    expect(compChange([], '2026-11-02', '2026-11-08')).toBeNull()
    const small = compChange([d('2026-11-01', 18, 78), d('2026-11-07', 17.9, 77.9)], '2026-11-02', '2026-11-08')!
    expect(small.fatShare).toBeNull()
  })
})

describe('linearFit', () => {
  it('reads the fitted line on any date', () => {
    const pts = [{ date: '2026-11-01', value: 20 }, { date: '2026-11-04', value: 19.4 }, { date: '2026-11-08', value: 18.6 }]
    const fit = linearFit(pts)!
    expect(fit.slope).toBeCloseTo(-0.2, 5)
    expect(fit.at('2026-11-01')).toBeCloseTo(20, 5)
    expect(fit.at('2026-11-15')).toBeCloseTo(17.2, 5)
  })

  it('needs enough points over a week', () => {
    expect(linearFit([{ date: '2026-11-01', value: 1 }, { date: '2026-11-08', value: 2 }])).toBeNull()
  })
})
