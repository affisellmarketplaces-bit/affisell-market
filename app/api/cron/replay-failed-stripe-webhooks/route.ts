import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { replayFailedStripeWebhooks } from "@/lib/cron/replay-failed-stripe-webhooks"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
/** Up to 20 events are re-read at Stripe and reprocessed per run (time-boxed to 40 s inside the job). */
export const maxDuration = 60

/**
 * Replays `failed` Stripe webhook events that Stripe no longer retries (finalisation master doc, D2).
 * `Authorization: Bearer ${CRON_SECRET}`. Scheduled every 6 hours (GitHub Actions, `scheduled-crons.yml`).
 *
 * Answers 500 — a red cron run — when an event is STILL failing after its replay: an unresolved money event must not look
 * like a healthy run. The JSON body always carries the full result.
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await replayFailedStripeWebhooks()
  return NextResponse.json({ ok: result.stillFailing === 0, ...result }, { status: result.stillFailing > 0 ? 500 : 200 })
}
