import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runReviewReminderCron } from "@/lib/cron/review-reminder"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Vercel Cron (daily): review reminder J+7 after delivery.
 * `Authorization: Bearer ${CRON_SECRET}`
 */
export async function GET(req: NextRequest) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runReviewReminderCron({ daysAfterDelivery: 7, limit: 50 })
  return NextResponse.json({ ok: true, daysAfterDelivery: 7, ...result })
}
