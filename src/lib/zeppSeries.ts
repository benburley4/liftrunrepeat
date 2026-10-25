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

// ─── GPS routes ──────────────────────────────────────────────────────────────

export interface RoutePoint { latitude: number; longitude: number }

/** [lat, lon] rounded to 5 dp (~1 m). */
export type LatLon = [number, number]

/** Hidden distance at each end of a route so it doesn't reveal home / start points. */
export const PRIVACY_ZONE_M = 200
/** Simplification tolerance: points within this many metres of the line are dropped. */
export const ROUTE_TOLERANCE_M = 8

const R_EARTH = 6371000
const toRad = (d: number) => (d * Math.PI) / 180

export function distanceM(a: LatLon, b: LatLon): number {
  const dLat = toRad(b[0] - a[0]), dLon = toRad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2
  return 2 * R_EARTH * Math.asin(Math.sqrt(h))
}

/** Perpendicular distance (m) of p from segment a–b, on a local flat projection. */
function offLineM(p: LatLon, a: LatLon, b: LatLon): number {
  const kx = Math.cos(toRad(a[0])) * R_EARTH * Math.PI / 180, ky = R_EARTH * Math.PI / 180
  const ax = a[1] * kx, ay = a[0] * ky, bx = b[1] * kx - ax, by = b[0] * ky - ay, px = p[1] * kx - ax, py = p[0] * ky - ay
  const len2 = bx * bx + by * by
  const t = len2 ? Math.max(0, Math.min(1, (px * bx + py * by) / len2)) : 0
  return Math.hypot(px - t * bx, py - t * by)
}

/** Ramer–Douglas–Peucker simplification (iterative, keeps first and last points). */
export function simplifyRoute(points: LatLon[], toleranceM = ROUTE_TOLERANCE_M): LatLon[] {
  if (points.length <= 2) return points
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length) {
    const [s, e] = stack.pop()!
    let max = 0, idx = -1
    for (let i = s + 1; i < e; i++) {
      const d = offLineM(points[i], points[s], points[e])
      if (d > max) { max = d; idx = i }
    }
    if (idx >= 0 && max > toleranceM) {
      keep[idx] = 1
      stack.push([s, idx], [idx, e])
    }
  }
  return points.filter((_, i) => keep[i])
}

/** Drops the first and last `zoneM` metres of a route (privacy zone). */
export function trimPrivacyZone(points: LatLon[], zoneM = PRIVACY_ZONE_M): LatLon[] {
  const cut = (list: LatLon[]) => {
    let d = 0
    for (let i = 1; i < list.length; i++) {
      d += distanceM(list[i - 1], list[i])
      if (d >= zoneM) return list.slice(i)
    }
    return []
  }
  return cut([...cut(points)].reverse()).reverse()
}

/** Privacy-trimmed, simplified [lat, lon] route, or null when too little remains. */
export function buildRoute(points: RoutePoint[]): LatLon[] | null {
  const raw: LatLon[] = points
    .filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && (p.latitude !== 0 || p.longitude !== 0))
    .map(p => [p.latitude, p.longitude])
  const route = simplifyRoute(trimPrivacyZone(raw)).map(([la, lo]) => [Math.round(la * 1e5) / 1e5, Math.round(lo * 1e5) / 1e5] as LatLon)
  return route.length >= 2 ? route : null
}

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
