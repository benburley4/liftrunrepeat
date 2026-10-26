'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Map as LeafletMap, LayerGroup } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LatLon } from '@/lib/zeppSeries'
import type { SessionData } from '@/lib/computeStats'
import { footKind, type FootKind } from '@/lib/activity'
import { ACTIVITY_COLORS } from './progressStyle'
import { Pills } from './kit'

type Filter = 'all' | FootKind
const FILTERS: { id: Filter; label: string; color?: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'run', label: 'Runs', color: ACTIVITY_COLORS.run },
  { id: 'hike', label: 'Hikes', color: ACTIVITY_COLORS.hike },
  { id: 'walk', label: 'Walks', color: ACTIVITY_COLORS.walk },
]

/** Fit the view to the area with the most routes, so one holiday abroad doesn't zoom the map out to the whole world. */
function mainCluster(routes: LatLon[][]): LatLon[][] {
  if (routes.length < 3) return routes
  const starts = routes.map(r => r[0])
  const sorted = (i: 0 | 1) => [...starts].map(p => p[i]).sort((a, b) => a - b)
  const lat = sorted(0)[Math.floor(starts.length / 2)], lon = sorted(1)[Math.floor(starts.length / 2)]
  const near = routes.filter(r => Math.abs(r[0][0] - lat) < 0.5 && Math.abs(r[0][1] - lon) < 0.5)
  return near.length ? near : routes
}

/**
 * Every recorded route drawn as a faint line on one map, so the paths you use
 * most glow brightest. Routes already have the 200 m privacy zone trimmed.
 */
export default function RouteHeatMap({ sessions, routes, span }: {
  sessions: SessionData[]
  routes: Record<string, LatLon[]>
  span: { start: string; end: string }
}) {
  const ref = useRef<HTMLDivElement>(null)
  const map = useRef<LeafletMap | null>(null)
  const layer = useRef<LayerGroup | null>(null)
  const [ready, setReady] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  const lines = useMemo(() => sessions.flatMap(s => {
    const id = s.zepp?.workoutId
    const kind = footKind(s)
    const r = id ? routes[id] : undefined
    if (!r || !kind || s.date < span.start || s.date >= span.end) return []
    if (filter !== 'all' && kind !== filter) return []
    return [{ kind, route: r }]
  }), [sessions, routes, span, filter])

  useEffect(() => {
    let cancelled = false
    import('leaflet').then(L => {
      if (cancelled || !ref.current || map.current) return
      const m = L.map(ref.current, { scrollWheelZoom: false, attributionControl: true, preferCanvas: true })
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(m)
      m.getPane('tilePane')!.style.filter = 'invert(1) hue-rotate(180deg) brightness(0.7) contrast(0.9) saturate(0.4)'
      layer.current = L.layerGroup().addTo(m)
      map.current = m
      setReady(true)
    })
    return () => { cancelled = true; map.current?.remove(); map.current = null; layer.current = null }
  }, [])

  useEffect(() => {
    if (!ready) return
    import('leaflet').then(L => {
      const m = map.current, g = layer.current
      if (!m || !g) return
      g.clearLayers()
      // Low opacity per line: overlapping routes add up to a bright "heat" path.
      const opacity = Math.max(0.12, Math.min(0.6, 6 / Math.max(1, lines.length)))
      for (const l of lines) L.polyline(l.route, { color: ACTIVITY_COLORS[l.kind], weight: 3, opacity, interactive: false }).addTo(g)
      const fit = mainCluster(lines.map(l => l.route))
      if (fit.length) m.fitBounds(L.latLngBounds(fit.flat()), { padding: [24, 24] })
    })
  }, [ready, lines])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <Pills label="Route filter" options={FILTERS} value={filter} onChange={setFilter} />
        <span className="text-xs" style={{ color: 'var(--color-text-subtle)', fontFamily: 'var(--font-mono)' }}>{lines.length} routes</span>
      </div>
      <div ref={ref} className="h-80 rounded-lg overflow-hidden" style={{ background: '#141414' }} data-noswipe
        role="img" aria-label={`Map of ${lines.length} recorded routes`} />
      <p className="text-xs mt-2" style={{ color: 'var(--color-text-subtle)' }}>
        Brighter lines are routes you repeat. The first and last 200 m of every route are hidden for privacy.
      </p>
    </div>
  )
}
