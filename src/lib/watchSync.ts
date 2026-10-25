// "Sync now" for the watch box in the navbar.
//
// The site can't reach the PC that holds the watch data, so the button
// writes a request to user_settings.zepp_sync_request; scripts/zepp-sync-poll.mjs
// (scheduled every minute on that PC) runs the sync when it sees a newer
// request, and zepp-sync.mjs writes user_settings.zepp_sync_status when done.

export const SYNC_REQUEST_KEY = 'zepp_sync_request'
export const SYNC_STATUS_KEY = 'zepp_sync_status'

/** A request older than this without a matching sync is reported as unanswered. */
export const REQUEST_TIMEOUT_MS = 3 * 60_000
/** Data older than this shows the box in its "stale" colour. */
export const STALE_AFTER_MS = 6 * 3600_000

export interface SyncStatus {
  at: string                 // when zepp-sync last finished
  ok: boolean
  latestDay?: string | null  // newest date in zepp_daily after the sync
  bridgeSyncAt?: string | null // when ZeppBridge last pulled from the Zepp cloud
  message?: string
}

export interface SyncRequest { at: string }

export type SyncState =
  | { kind: 'never' }                  // no watch connected
  | { kind: 'pending'; since: string } // request waiting for the PC
  | { kind: 'unanswered' }             // request timed out — PC off / ZeppBridge closed
  | { kind: 'synced'; at: string; stale: boolean; ok: boolean }

export function syncState(status: SyncStatus | null, request: SyncRequest | null, now: Date): SyncState {
  if (!status && !request) return { kind: 'never' }
  const requestPending = request && (!status || request.at > status.at)
  if (requestPending) {
    return now.getTime() - new Date(request!.at).getTime() > REQUEST_TIMEOUT_MS
      ? { kind: 'unanswered' }
      : { kind: 'pending', since: request!.at }
  }
  if (!status) return { kind: 'never' }
  return { kind: 'synced', at: status.at, ok: status.ok, stale: now.getTime() - new Date(status.at).getTime() > STALE_AFTER_MS }
}

/** "just now" / "12 min ago" / "3 h ago" / "2 d ago" */
export function fmtAgo(iso: string, now: Date): string {
  const min = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000))
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 48) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}

export function parseJson<T>(value: string | null): T | null {
  if (!value) return null
  try { return JSON.parse(value) as T } catch { return null }
}
