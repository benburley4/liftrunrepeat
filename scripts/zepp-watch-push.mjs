// Answers the site's "Send to watch" (run builder / programme) requests.
// Called every minute from zepp-sync-poll.mjs. Reads
// user_settings.zepp_watch_push_request, merges it with runs already sent
// (zepp_watch_sent — each push replaces ZeppBridge's 7-day windows, so earlier
// runs must be re-included), drafts and publishes the plan through
// ZeppBridge's MCP server, and writes zepp_watch_push_status for the site.

import { withZeppBridge } from './zepp-mcp.mjs'
import { mergeWithSent } from '../src/lib/watchPlan.ts'

const MAX_REQUEST_AGE_MS = 15 * 60_000
const TIME_ZONE = 'Asia/Hong_Kong'

const todayLocal = () => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

/** Turns ZeppBridge error codes into something the athlete can act on. */
function friendly(text) {
  if (/ai_publish_disabled/.test(text)) return 'ZeppBridge blocked the send: open ZeppBridge → AI page and switch on "Allow AI to publish directly", then send again.'
  if (/needs_clear_confirmation/.test(text)) return 'ZeppBridge wants confirmation to clear existing plans — open ZeppBridge and confirm, or send again with at least one run.'
  if (/scope_denied|scope_no_grants/.test(text)) return 'ZeppBridge refused access — check its MCP/AI permissions.'
  if (/ENOENT|exited/.test(text)) return 'ZeppBridge is not installed or could not start on this PC.'
  return text.slice(0, 300)
}

export async function handleWatchPush(supabase, userId) {
  const { data, error } = await supabase.from('user_settings').select('key, value').eq('user_id', userId)
    .in('key', ['zepp_watch_push_request', 'zepp_watch_push_status', 'zepp_watch_sent'])
  if (error) throw new Error(`push poll failed: ${error.message}`)
  const get = key => { try { return JSON.parse(data.find(r => r.key === key)?.value ?? 'null') } catch { return null } }
  const request = get('zepp_watch_push_request')
  const status = get('zepp_watch_push_status')
  if (!request?.at || !Array.isArray(request.workouts)) return false
  if (status?.requestAt === request.at) return false                       // already handled
  if (Date.now() - new Date(request.at).getTime() > MAX_REQUEST_AGE_MS) return false

  const save = (key, value) => supabase.from('user_settings')
    .upsert({ user_id: userId, key, value: JSON.stringify(value) }, { onConflict: 'key,user_id' })
  const finish = async (ok, message, extra = {}) => {
    await save('zepp_watch_push_status', { at: new Date().toISOString(), requestAt: request.at, ok, message, ...extra })
    console.log(`[${new Date().toISOString()}] Send to watch (${request.label ?? 'plan'}): ${ok ? 'sent' : 'failed'} — ${message}`)
  }

  const sent = get('zepp_watch_sent') ?? []
  const plan = mergeWithSent(sent, request.workouts, todayLocal(), request.label ?? 'TheHybridLife plan')
  if (!plan) { await finish(false, 'Nothing to send — the runs are in the past.'); return true }

  try {
    await withZeppBridge(async call => {
      const draft = await call('draft_training_plan', { plan })
      const issues = draft.data?.check?.issues ?? []
      if (draft.isError || !draft.data?.draftId || issues.length) {
        const why = issues.length ? issues.map(i => (typeof i === 'string' ? i : i.message ?? JSON.stringify(i))).join('; ') : draft.text
        return finish(false, `ZeppBridge rejected the plan: ${friendly(why)}`)
      }
      const pub = await call('publish_training_plan', { draftId: draft.data.draftId })
      const failed = pub.isError || /err\.|error/i.test(pub.data?.code ?? '') || pub.data?.ok === false
      if (failed) return finish(false, friendly(pub.text || JSON.stringify(pub.data)), { draftId: draft.data.draftId })
      await save('zepp_watch_sent', plan.workouts)
      await finish(true, `Sent ${request.workouts.length} run${request.workouts.length === 1 ? '' : 's'} to your watch`, {
        dates: request.workouts.map(w => w.date),
        onWatch: plan.workouts.map(w => ({ date: w.date, name: w.name })),
      })
    })
  } catch (e) {
    await finish(false, friendly(String(e?.message ?? e)))
  }
  return true
}
