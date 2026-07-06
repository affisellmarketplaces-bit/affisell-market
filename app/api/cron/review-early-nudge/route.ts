import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import {
  REVIEW_EARLY_NUDGE_DAYS_AFTER_DELIVERY,
  runReviewEarlyNudgeCron,
} from "@/lib/cron/review-early-nudge"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Daily cron: review push nudge J+3 after delivery.
 * `Authorization: Bearer ${CRON_SECRET}`
 */
export async function GET(req: NextRequest) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runReviewEarlyNudgeCron({
    daysAfterDelivery: REVIEW_EARLY_NUDGE_DAYS_AFTER_DELIVERY,
    limit: 50,
  })
  return NextResponse.json({
    ok: true,
    daysAfterDelivery: REVIEW_EARLY_NUDGE_DAYS_AFTER_DELIVERY,
    ...result,
  })
}
