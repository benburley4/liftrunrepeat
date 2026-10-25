'use client'

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LatLon } from '@/lib/zeppSeries'

const ROUTE_COLOR = '#84CC16'   // matches the History hike card

/**
 * GPS route on an OpenStreetMap basemap, darkened with a CSS filter. Leaflet is
 * imported on mount — it touches `window`. Routes arrive already trimmed by
 * the 200 m privacy zone at each end (see buildRoute in zeppSeries.ts).
 */
export default function RouteMap({ route }: { route: LatLon[] }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let map: LeafletMap | undefined
    let cancelled = false
    import('leaflet').then(L => {
      if (cancelled || !ref.current) return
      map = L.map(ref.current, { scrollWheelZoom: false, attributionControl: true })
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)
      // Standard OSM tiles, darkened to match the site (only the tiles — the route keeps its colour).
      map.getPane('tilePane')!.style.filter = 'invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.9) saturate(0.6)'
      const line = L.polyline(route, { color: ROUTE_COLOR, weight: 4, opacity: 0.95 }).addTo(map)
      L.circleMarker(route[0], { radius: 6, color: '#0D0D0D', weight: 2, fillColor: '#00BFA5', fillOpacity: 1 })
        .bindTooltip('Start').addTo(map)
      L.circleMarker(route[route.length - 1], { radius: 6, color: '#0D0D0D', weight: 2, fillColor: '#F5F5F5', fillOpacity: 1 })
        .bindTooltip('Finish').addTo(map)
      map.fitBounds(line.getBounds(), { padding: [20, 20] })
    })
    return () => { cancelled = true; map?.remove() }
  }, [route])

  return (
    <div>
      <div ref={ref} className="h-72 rounded-lg overflow-hidden" style={{ background: '#141414' }}
        role="img" aria-label="Map of the GPS route" />
      <p className="text-xs mt-2 flex flex-wrap gap-x-4" style={{ color: 'var(--color-text-subtle)' }}>
        <span><span style={{ color: '#00BFA5' }}>●</span> Start</span>
        <span><span style={{ color: '#F5F5F5' }}>●</span> Finish</span>
        <span>The first and last 200 m are hidden for privacy.</span>
      </p>
    </div>
  )
}
