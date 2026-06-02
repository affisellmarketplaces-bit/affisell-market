import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runReviewReminderCron } from "@/lib/cron/review-reminder"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** @deprecated Use `/api/cron/review-reminder` (J+7). Kept for backward-compatible cron URLs. */
export async function GET(req: NextRequest) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runReviewReminderCron({ daysAfterDelivery: 7, limit: 50 })
  return NextResponse.json({ ok: true, legacy: true, ...result })
}
