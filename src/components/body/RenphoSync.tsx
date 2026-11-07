'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import Card from '@/components/ui/Card'
import { getSetting, upsertSetting } from '@/lib/db'
import { RENPHO_REQUEST_KEY, RENPHO_STATUS_KEY, syncState, fmtAgo, parseJson, type SyncRequest, type SyncStatus } from '@/lib/watchSync'

const POLL_MS = 5000

const fetchSync = () => Promise.all([getSetting(RENPHO_STATUS_KEY), getSetting(RENPHO_REQUEST_KEY)])

/**
 * "Sync Renpho": writes a request that the PC's every-minute task picks up
 * (scripts/zepp-sync-poll.mjs), so the Renpho password never leaves the PC.
 * Accounts with no Renpho sync yet see a short note instead of the button.
 */
export default function RenphoSync({ onSynced }: { onSynced: () => void }) {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [request, setRequest] = useState<SyncRequest | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [now, setNow] = useState(() => new Date())

  const apply = useCallback(([s, r]: [string | null, string | null]) => {
    setStatus(parseJson<SyncStatus>(s))
    setRequest(parseJson<SyncRequest>(r))
    setNow(new Date())
    setLoaded(true)
  }, [])

  useEffect(() => {
    let live = true
    fetchSync().then(d => { if (live) apply(d) }).catch(() => { if (live) setLoaded(true) })
    return () => { live = false }
  }, [apply])

  const state = syncState(status, request, now)

  useEffect(() => {
    if (state.kind !== 'pending') return
    const t = setInterval(() => { fetchSync().then(apply).catch(() => {}) }, POLL_MS)
    return () => clearInterval(t)
  }, [state.kind, apply])

  // A request just finished: reload the charts.
  const wasPending = useRef(false)
  useEffect(() => {
    if (wasPending.current && state.kind === 'synced') onSynced()
    wasPending.current = state.kind === 'pending'
  }, [state.kind, onSynced])

  async function syncNow() {
    const req = { at: new Date().toISOString() }
    setRequest(req)
    setNow(new Date())
    await upsertSetting(RENPHO_REQUEST_KEY, JSON.stringify(req)).catch(() => {})
  }

  if (!loaded) return null

  if (state.kind === 'never') {
    return (
      <Card hover={false}>
        <p className="text-sm font-semibold" style={{ color: '#F5F5F5' }}>Renpho scale not connected</p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>Weight and body composition appear here once your scale is syncing.</p>
      </Card>
    )
  }

  const pending = state.kind === 'pending'
  const problem = state.kind === 'synced' && !state.ok

  return (
    <Card hover={false}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: '#F5F5F5' }}>Renpho scale</p>
          <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
            {status ? `Last synced ${fmtAgo(status.at, now)}${status.latestDay ? ` · latest reading ${status.latestDay}` : ''}` : 'Not synced yet'}
          </p>
          {state.kind === 'unanswered' && (
            <p className="text-xs mt-1" style={{ color: '#F59E0B' }}>Your PC didn&apos;t pick up the request. Check it&apos;s on, then try again.</p>
          )}
          {problem && (
            <p className="text-xs mt-1" style={{ color: '#F59E0B' }}>The last sync had a problem: {status?.message ?? 'see logs/zepp-sync.log on your PC'}</p>
          )}
        </div>
        <button onClick={syncNow} disabled={pending}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold shrink-0"
          style={{ background: pending ? '#242424' : '#00BFA5', color: pending ? '#A0A0A0' : '#0D0D0D', cursor: pending ? 'default' : 'pointer' }}>
          <RefreshCw size={14} className={pending ? 'animate-spin' : ''} aria-hidden="true" />
          {pending ? 'Waiting for your PC…' : 'Sync Renpho'}
        </button>
      </div>
    </Card>
  )
}
