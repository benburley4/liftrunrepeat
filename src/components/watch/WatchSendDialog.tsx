'use client'

import { useEffect, useMemo, useState } from 'react'
import { Watch, CheckCircle2, AlertTriangle } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { getSetting, upsertSetting } from '@/lib/db'
import { buildPlan, type PlanTemplate, type ZeppStep, type ZeppRepeat } from '@/lib/watchPlan'
import { localToday } from '@/lib/recovery'
import { parseJson, SYNC_STATUS_KEY } from '@/lib/watchSync'

const REQUEST_KEY = 'zepp_watch_push_request'
const STATUS_KEY = 'zepp_watch_push_status'
const POLL_MS = 4000
const GIVE_UP_MS = 3 * 60_000

interface PushStatus { at: string; requestAt: string; ok: boolean; message: string; onWatch?: { date: string; name: string }[] }

const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

function StepLine({ s }: { s: ZeppStep }) {
  return <span>{s.duration} {s.kind}{s.target ? <span style={{ color: '#8A8A8A' }}> · {s.target}</span> : null}</span>
}

/**
 * Preview and send runs to the Amazfit watch. The PC poller (zepp-watch-push)
 * merges them with runs sent earlier and publishes through ZeppBridge.
 */
export default function WatchSendDialog({ items, title, onClose }: {
  items: { date: string; template: PlanTemplate }[]
  title: string
  onClose: () => void
}) {
  const today = localToday()
  const dates = items.map(i => i.date).sort()
  const { plan, issues } = useMemo(
    () => buildPlan(items, dates[0] ?? today, dates[dates.length - 1] ?? today, title, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, title, today],
  )
  const [hasWatch, setHasWatch] = useState<boolean | null>(null)
  const [phase, setPhase] = useState<'preview' | 'sending' | 'done'>('preview')
  const [requestAt, setRequestAt] = useState<string | null>(null)
  const [result, setResult] = useState<PushStatus | null>(null)

  useEffect(() => {
    getSetting(SYNC_STATUS_KEY).then(v => setHasWatch(!!v)).catch(() => setHasWatch(false))
  }, [])

  // Wait for the PC to answer this request.
  useEffect(() => {
    if (phase !== 'sending' || !requestAt) return
    const started = Date.now()
    const t = setInterval(async () => {
      const s = parseJson<PushStatus>(await getSetting(STATUS_KEY).catch(() => null))
      if (s?.requestAt === requestAt) { setResult(s); setPhase('done'); clearInterval(t) }
      else if (Date.now() - started > GIVE_UP_MS) {
        setResult({ at: new Date().toISOString(), requestAt, ok: false, message: "Your PC didn't pick up the request — check it's on and ZeppBridge is running. The request stays queued for 15 minutes." })
        setPhase('done'); clearInterval(t)
      }
    }, POLL_MS)
    return () => clearInterval(t)
  }, [phase, requestAt])

  async function send() {
    if (!plan) return
    const at = new Date().toISOString()
    setRequestAt(at)
    setPhase('sending')
    await upsertSetting(REQUEST_KEY, JSON.stringify({ at, label: title, workouts: plan.workouts })).catch(e => {
      setResult({ at, requestAt: at, ok: false, message: e instanceof Error ? e.message : 'Could not queue the request' })
      setPhase('done')
    })
  }

  return (
    <Modal onClose={onClose} eyebrow="Amazfit watch" eyebrowColor="#00BFA5" title={title} maxWidth={560}
      footer={phase === 'done' ? (
        <Button onClick={onClose} className="flex-1">Close</Button>
      ) : (
        <>
          <Button onClick={onClose} variant="subtle" className="flex-1">Cancel</Button>
          <Button onClick={send} disabled={!plan || !hasWatch || phase === 'sending'} accent="#00BFA5" className="flex-1">
            {phase === 'sending' ? 'Sending…' : `Send ${plan?.workouts.length ?? 0} run${plan?.workouts.length === 1 ? '' : 's'} to watch`}
          </Button>
        </>
      )}
    >
      {phase === 'done' && result ? (
        <div className="flex items-start gap-3">
          {result.ok ? <CheckCircle2 size={22} color="#00BFA5" aria-hidden="true" /> : <AlertTriangle size={22} color="#F59E0B" aria-hidden="true" />}
          <div className="space-y-2">
            <p className="text-sm font-semibold" style={{ color: '#F5F5F5' }}>{result.message}</p>
            {result.ok && result.onWatch && (
              <ul className="text-xs space-y-0.5" style={{ color: 'var(--color-text-subtle)' }}>
                {result.onWatch.map(w => <li key={w.date + w.name}>{fmtDate(w.date)} · {w.name}</li>)}
              </ul>
            )}
            {result.ok && (
              <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                It appears in the Zepp app, then on your watch. When you start it, pick outdoor or treadmill run.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {hasWatch === false && (
            <p className="text-sm" style={{ color: '#F59E0B' }}>Connect your watch first — sending needs the watch sync set up.</p>
          )}
          {plan ? (
            <ul className="space-y-3">
              {plan.workouts.map(w => (
                <li key={w.date + w.name} className="rounded-xl p-3" style={{ background: '#1E1E1E', border: '1px solid #2E2E2E' }}>
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#F5F5F5' }}>
                      <Watch size={14} color="#00BFA5" aria-hidden="true" /> {w.name}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{fmtDate(w.date)} · {w.variant} · {w.focus}</span>
                  </div>
                  <ol className="text-xs space-y-0.5 pl-1" style={{ color: '#A0A0A0', fontFamily: 'var(--font-mono)' }}>
                    {w.steps.map((s, i) => 'repeat' in s ? (
                      <li key={i}>{(s as ZeppRepeat).repeat}× {(s as ZeppRepeat).steps.map((x, j) => <span key={j}>{j ? ' → ' : ''}<StepLine s={x} /></span>)}</li>
                    ) : <li key={i}><StepLine s={s as ZeppStep} /></li>)}
                  </ol>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm" style={{ color: '#A0A0A0' }}>Nothing can be sent.</p>
          )}
          {issues.length > 0 && (
            <ul className="text-xs space-y-0.5" style={{ color: '#F59E0B' }}>
              {issues.map(i => <li key={i}>• {i}</li>)}
            </ul>
          )}
          <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
            Runs you sent earlier stay on the watch. Only runs can be sent — Zepp doesn&apos;t accept hikes, walks or strength workouts. Names are cut to 14 characters.
          </p>
          {phase === 'sending' && (
            <p className="text-xs" style={{ color: '#A78BFA' }}>Waiting for your PC to send it through ZeppBridge (usually within a minute)…</p>
          )}
        </div>
      )}
    </Modal>
  )
}
