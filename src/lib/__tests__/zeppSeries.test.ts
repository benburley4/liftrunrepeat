import { describe, it, expect } from 'vitest'
import { downsampleSeries, ZeppSample } from '../zeppSeries'

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
