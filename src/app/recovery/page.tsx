'use client'

import { useEffect, useState } from 'react'
import { Watch } from 'lucide-react'
import Card from '@/components/ui/Card'
import QuickLogFAB from '@/components/log/QuickLogFAB'
import ReadinessToday from '@/components/recovery/ReadinessToday'
import RecoveryTrends from '@/components/recovery/RecoveryTrends'
import RecoveryExtras from '@/components/recovery/RecoveryExtras'
import { getZeppDaily } from '@/lib/db'
import { localToday, currentIllnessSigns, ZeppDay } from '@/lib/recovery'

export default function RecoveryPage() {
  const [rows, setRows] = useState<ZeppDay[] | null>(null)
  const [error, setError] = useState('')
  const today = localToday()

  useEffect(() => {
    getZeppDaily()
      .then(setRows)
      .catch(e => { setError(e instanceof Error ? e.message : 'Failed to load recovery data'); setRows([]) })
  }, [])

  return (
    <div style={{ background: '#0D0D0D', minHeight: '100vh' }}>
      <QuickLogFAB />

      {/* Hero */}
      <div
        className="pt-16 pb-12"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,191,165,0.08) 0%, transparent 70%)',
          borderBottom: '1px solid #1A1A1A',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10">
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#00BFA5' }}>Insights</p>
          <h1 className="text-5xl sm:text-6xl font-black uppercase mb-3" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>
            Recovery
          </h1>
          <p className="text-lg" style={{ color: '#A0A0A0' }}>
            Readiness, HRV, heart rate and sleep from your watch — so you know when to push and when to back off.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-10">
        {rows === null && (
          <p className="text-sm" style={{ color: 'var(--color-text-subtle)' }}>Loading recovery data…</p>
        )}

        {error && (
          <Card tint="#C8102E" hover={false}>
            <p className="text-sm" style={{ color: '#F5F5F5' }}>Couldn&apos;t load recovery data: {error}</p>
          </Card>
        )}

        {rows !== null && !error && rows.length === 0 && (
          <Card hover={false} padding="lg">
            <div className="flex items-start gap-4">
              <Watch size={28} color="#00BFA5" aria-hidden="true" />
              <div>
                <p className="text-lg font-bold" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>No watch data yet</p>
                <p className="text-sm mt-1" style={{ color: '#A0A0A0' }}>
                  Recovery insights come from a connected Amazfit / Zepp watch. Once your watch data syncs,
                  your readiness, HRV, resting heart rate and sleep will appear here.
                </p>
              </div>
            </div>
          </Card>
        )}

        {rows !== null && rows.length > 0 && (
          <>
            {(() => {
              // Early illness / strain warning from last night's (or the night before's) vitals
              const ill = currentIllnessSigns(rows, today)
              return ill ? (
                <Card tint="#F59E0B" hover={false}>
                  <p className="text-sm font-bold" style={{ color: '#F5F5F5' }}>Possible illness or heavy strain</p>
                  <p className="text-sm mt-1" style={{ color: '#A0A0A0' }}>
                    {ill.signs.join(' · ')}. These often appear a day or two before symptoms — keep training easy and prioritise sleep until they settle.
                  </p>
                </Card>
              ) : null
            })()}
            <ReadinessToday rows={rows} today={today} />
            <RecoveryTrends rows={rows} today={today} />
            <RecoveryExtras rows={rows} today={today} />
          </>
        )}
      </div>
    </div>
  )
}
