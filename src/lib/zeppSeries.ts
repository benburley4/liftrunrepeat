// Per-minute workout trace for the History detail view (zepp_workout_series).
// ZeppBridge stores ~1 sample/second; one point per minute keeps a 3-hour hike
// to ~180 points (~4 KB) while still showing the HR and elevation shape.
// Dependency-free so scripts/zepp-sync.mjs can import it directly.

export interface ZeppSample {
  timestamp: string
  heartRate: number | null
  altitude: number | null
  speed: number | null      // m/s
}

/** [minute offset, avg HR, altitude m, pace min/km] — null where unknown. */
export type SeriesPoint = [number, number | null, number | null, number | null]

// Below this speed the athlete is effectively standing still — no pace.
const MIN_MOVING_SPEED = 0.3

const avg = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null)

export function downsampleSeries(samples: ZeppSample[], startTime: string, bucketSeconds = 60): SeriesPoint[] {
  const start = new Date(startTime).getTime()
  const buckets = new Map<number, { hr: number[]; alt: number[]; speed: number[] }>()
  for (const s of samples) {
    const idx = Math.floor((new Date(s.timestamp).getTime() - start) / 1000 / bucketSeconds)
    if (idx < 0) continue
    if (!buckets.has(idx)) buckets.set(idx, { hr: [], alt: [], speed: [] })
    const b = buckets.get(idx)!
    if (s.heartRate != null && s.heartRate > 0) b.hr.push(s.heartRate)
    if (s.altitude != null) b.alt.push(s.altitude)
    if (s.speed != null && s.speed >= MIN_MOVING_SPEED) b.speed.push(s.speed)
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([idx, b]) => {
      const hr = avg(b.hr), alt = avg(b.alt), speed = avg(b.speed)
      return [
        Math.round((idx * bucketSeconds) / 60 * 10) / 10,
        hr == null ? null : Math.round(hr),
        alt == null ? null : Math.round(alt),
        speed == null ? null : Math.round((1000 / speed / 60) * 10) / 10,
      ] as SeriesPoint
    })
    .filter(p => p[1] != null || p[2] != null)
}
