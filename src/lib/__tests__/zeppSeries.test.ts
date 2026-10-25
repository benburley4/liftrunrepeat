import { describe, it, expect } from 'vitest'
import { downsampleSeries, ZeppSample, distanceM, simplifyRoute, trimPrivacyZone, buildRoute, LatLon } from '../zeppSeries'

const start = '2026-10-25T04:00:00+00:00'
const at = (sec: number, hr: number | null, alt: number | null, speed: number | null): ZeppSample =>
  ({ timestamp: new Date(new Date(start).getTime() + sec * 1000).toISOString(), heartRate: hr, altitude: alt, speed })

describe('downsampleSeries', () => {
  it('averages each minute into [minute, hr, altitude, pace]', () => {
    const points = downsampleSeries([
      at(0, 100, 50, 1.0), at(30, 110, 52, 1.0),   // minute 0: 1 m/s = 16.7 min/km
      at(60, 120, 60, 0.1), at(90, 124, 62, null), // minute 1: standing still → no pace
    ], start)
    expect(points).toEqual([[0, 105, 51, 16.7], [1, 122, 61, null]])
  })
  it('ignores zero HR readings and drops empty minutes', () => {
    expect(downsampleSeries([at(0, 0, null, 2), at(120, 90, null, null)], start)).toEqual([[2, 90, null, null]])
  })
})

// A straight 1 km line north from Hong Kong, one point every ~11 m.
const line: LatLon[] = Array.from({ length: 91 }, (_, i) => [22.25 + i * 0.0001, 114.17])

describe('routes', () => {
  it('measures distance in metres', () => {
    expect(distanceM(line[0], line[90])).toBeCloseTo(1000.8, 0)
  })
  it('simplifies a straight line to its end points', () => {
    expect(simplifyRoute(line)).toEqual([line[0], line[90]])
  })
  it('keeps a corner', () => {
    const corner: LatLon[] = [...line, [22.259, 114.171], [22.259, 114.172]]
    expect(simplifyRoute(corner)).toEqual([line[0], line[90], [22.259, 114.172]])
  })
  it('hides the first and last 200 m', () => {
    const trimmed = trimPrivacyZone(line)
    expect(distanceM(line[0], trimmed[0])).toBeGreaterThanOrEqual(200)
    expect(distanceM(trimmed.at(-1)!, line[90])).toBeGreaterThanOrEqual(200)
    expect(distanceM(line[0], trimmed[0])).toBeLessThan(215)
  })
  it('builds a rounded, trimmed route and rejects routes shorter than the privacy zones', () => {
    const route = buildRoute(line.map(([latitude, longitude]) => ({ latitude, longitude })))!
    expect(route).toHaveLength(2)
    expect(route[0][0]).toBe(22.2518)
    expect(buildRoute(line.slice(0, 30).map(([latitude, longitude]) => ({ latitude, longitude })))).toBeNull()
  })
})
