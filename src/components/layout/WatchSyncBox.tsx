'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Watch, RefreshCw } from 'lucide-react'
import { getSetting, upsertSetting } from '@/lib/db'
import {
  SYNC_REQUEST_KEY, SYNC_STATUS_KEY, syncState, fmtAgo, parseJson,
  type SyncStatus, type SyncRequest,
} from '@/lib/watchSync'

const POLL_MS = 5000

const fetchSync = () => Promise.all([getSetting(SYNC_STATUS_KEY), getSetting(SYNC_REQUEST_KEY)])

const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

/**
 * Navbar watch box: last sync time and a "Sync now" button. Users without a
 * connected watch see "Connect your watch — coming soon" (official Zepp
 * sign-in pending developer access). `variant="inline"` renders the panel
 * directly (mobile menu).
 */
export default function WatchSyncBox({ variant = 'popover' }: { variant?: 'popover' | 'inline' }) {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [request, setRequest] = useState<SyncRequest | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => new Date())

  const apply = useCallback(([s, r]: [string | null, string | null]) => {
    setStatus(parseJson<SyncStatus>(s))
    setRequest(parseJson<SyncRequest>(r))
    setNow(new Date())
    setLoaded(true)
  }, [])
  const load = useCallback(() => fetchSync().then(apply), [apply])

  useEffect(() => {
    let live = true
    fetchSync().then(d => { if (live) apply(d) }).catch(() => { if (live) setLoaded(true) })
    return () => { live = false }
  }, [apply])

  const state = syncState(status, request, now)

  // While a request is waiting for the PC, check every few seconds.
  useEffect(() => {
    if (state.kind !== 'pending') return
    const t = setInterval(() => { load().catch(() => {}) }, POLL_MS)
    return () => clearInterval(t)
  }, [state.kind, load])

  async function syncNow() {
    const req = { at: new Date().toISOString() }
    setRequest(req)
    setNow(new Date())
    await upsertSetting(SYNC_REQUEST_KEY, JSON.stringify(req)).catch(() => {})
  }

  if (!loaded) return null

  const dot = state.kind === 'never' ? '#606060'
    : state.kind === 'pending' ? '#A78BFA'
    : state.kind === 'unanswered' || (state.kind === 'synced' && (state.stale || !state.ok)) ? '#F59E0B'
    : '#00BFA5'
  const chip = state.kind === 'never' ? 'Connect watch'
    : state.kind === 'pending' ? 'Syncing…'
    : state.kind === 'unanswered' ? 'No response'
    : fmtAgo(state.at, now)

  const panel = (
    <div className="space-y-3" style={{ fontFamily: 'var(--font-sans)' }}>
      {state.kind === 'never' ? (
        <>
          <p className="text-sm font-semibold" style={{ color: '#F5F5F5' }}>Connect your watch</p>
          <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
            Sign in with your Amazfit / Zepp account to sync workouts, heart rate, sleep and recovery automatically. Coming soon.
          </p>
        </>
      ) : (
        <>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#F5F5F5' }}>Amazfit / Zepp</p>
            {status && (
              <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                Last synced {fmtAgo(status.at, now)}{status.latestDay ? ` · data through ${fmtDay(status.latestDay)}` : ''}
              </p>
            )}
            {status?.bridgeSyncAt && (
              <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Watch data pulled from Zepp {fmtAgo(status.bridgeSyncAt, now)}</p>
            )}
          </div>
          {state.kind === 'unanswered' && (
            <p className="text-xs" style={{ color: '#F59E0B' }}>
              Your PC didn&apos;t pick up the request — check it&apos;s on and ZeppBridge is running.
            </p>
          )}
          {state.kind === 'synced' && !state.ok && (
            <p className="text-xs" style={{ color: '#F59E0B' }}>The last sync reported a problem — see logs/zepp-sync.log on your PC.</p>
          )}
          <button onClick={syncNow} disabled={state.kind === 'pending'}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold"
            style={{ background: state.kind === 'pending' ? '#242424' : '#00BFA5', color: state.kind === 'pending' ? '#A0A0A0' : '#0D0D0D', cursor: state.kind === 'pending' ? 'default' : 'pointer' }}>
            <RefreshCw size={14} className={state.kind === 'pending' ? 'animate-spin' : ''} aria-hidden="true" />
            {state.kind === 'pending' ? 'Waiting for your PC…' : 'Sync now'}
          </button>
          <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
            Pulls the latest from ZeppBridge on your PC (usually within a minute). <Link href="/recovery" style={{ color: '#00BFA5' }} onClick={() => setOpen(false)}>Recovery →</Link>
          </p>
        </>
      )}
    </div>
  )

  if (variant === 'inline') {
    return <div className="rounded-xl p-4" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>{panel}</div>
  }

  return (
    <div className="relative">
      <button onClick={() => { setOpen(o => !o); if (!open) load().catch(() => {}) }} aria-expanded={open} aria-haspopup="dialog"
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
        style={{ background: '#1A1A1A', border: '1px solid #2E2E2E', color: '#A0A0A0', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
        title="Watch sync">
        <Watch size={14} aria-hidden="true" />
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} aria-hidden="true" />
        <span>{chip}</span>
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div role="dialog" aria-label="Watch sync" className="menu-pop card-depth"
            style={{ position: 'absolute', left: 0, top: '42px', zIndex: 50, width: '280px', padding: '14px', borderRadius: '12px', background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
            {panel}
          </div>
        </>
      )}
    </div>
  )
}
