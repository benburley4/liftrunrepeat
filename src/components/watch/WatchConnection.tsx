'use client'

import { useEffect, useState } from 'react'
import { Watch, CheckCircle2 } from 'lucide-react'
import { getZeppDaily, getLatestWatchHrZones } from '@/lib/db'
import { fmtDay } from '@/components/recovery/chartStyle'

// Same dim → bright single-hue ramp as the History watch panel.
const ZONE_RAMP = ['#5A2A33', '#7A2534', '#9E1F35', '#C8102E', '#E2475C', '#F27D8D']
const ZONE_USE = ['Recovery / warm-up', 'Zone 2 — easy aerobic', 'Steady / tempo', 'Threshold', 'VO₂ max intervals', 'Max effort']

/**
 * Running page "wearable" section: the connected Zepp watch with its last
 * sync date and the athlete's own HR zones (as the watch defines them), so
 * easy days can be kept genuinely easy. Other services stay "coming soon".
 */
export default function WatchConnection() {
  const [lastDay, setLastDay] = useState<string | null>(null)
  const [days, setDays] = useState(0)
  const [zones, setZones] = useState<{ upperBpm: number }[] | null>(null)

  useEffect(() => {
    getZeppDaily().then(rows => { setDays(rows.length); setLastDay(rows.at(-1)?.date ?? null) }).catch(() => {})
    getLatestWatchHrZones().then(z => setZones(z?.filter(x => x.upperBpm > 0) ?? null)).catch(() => {})
  }, [])

  return (
    <div>
      <h2 className="text-3xl font-black uppercase mb-4" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>
        Your Wearable
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl p-5 flex items-center justify-between gap-3"
          style={{ background: '#1A1A1A', border: `1px solid ${lastDay ? 'rgba(0,191,165,0.35)' : '#2E2E2E'}` }}>
          <div className="flex items-center gap-3">
            <Watch size={24} style={{ color: lastDay ? '#00BFA5' : '#606060' }} aria-hidden="true" />
            <div>
              <h4 className="text-sm font-semibold" style={{ color: '#F5F5F5' }}>Amazfit / Zepp</h4>
              <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                {lastDay ? `Synced through ${fmtDay(lastDay)} · ${days} days of data` : 'Not connected'}
              </p>
            </div>
          </div>
          {lastDay && (
            <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold" style={{ background: 'rgba(0,191,165,0.1)', color: '#00BFA5' }}>
              <CheckCircle2 size={12} aria-hidden="true" /> Connected
            </span>
          )}
        </div>
        {['Garmin Connect', 'Strava'].map(service => (
          <div key={service} className="rounded-xl p-5 flex items-center justify-between"
            style={{ background: '#1A1A1A', border: '1px solid #2E2E2E', opacity: 0.6 }}>
            <div className="flex items-center gap-3">
              <Watch size={24} style={{ color: '#606060' }} aria-hidden="true" />
              <div>
                <h4 className="text-sm font-semibold" style={{ color: '#A0A0A0' }}>{service}</h4>
                <p className="text-xs" style={{ color: '#606060' }}>Auto-sync workouts and metrics</p>
              </div>
            </div>
            <span className="px-2 py-1 rounded text-xs font-semibold" style={{ background: '#242424', color: '#606060', border: '1px solid #2E2E2E' }}>
              Coming Soon
            </span>
          </div>
        ))}
      </div>

      {zones && zones.length > 1 && (
        <div className="rounded-xl p-5 mt-4" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
          <p className="text-sm font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>Your heart-rate zones</p>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-subtle)' }}>
            As your watch sets them. Keep easy runs and hikes in Zone 2 to build the aerobic base without hurting your lifting.
          </p>
          <ul className="space-y-1.5">
            {zones.map((z, i) => (
              <li key={i} className="grid items-center gap-3 text-sm" style={{ gridTemplateColumns: '12px 110px 1fr' }}>
                <span className="w-3 h-3 rounded-sm" style={{ background: ZONE_RAMP[i] ?? '#C8102E' }} aria-hidden="true" />
                <span style={{ color: '#F5F5F5', fontFamily: 'var(--font-mono)' }}>
                  {i === 0 ? `< ${z.upperBpm}` : `${zones[i - 1].upperBpm}–${z.upperBpm}`} bpm
                </span>
                <span style={{ color: i === 1 ? '#00BFA5' : '#A0A0A0', fontWeight: i === 1 ? 600 : 400 }}>{ZONE_USE[i] ?? ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
