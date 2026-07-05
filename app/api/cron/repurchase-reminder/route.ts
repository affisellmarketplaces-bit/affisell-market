import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runRepurchaseReminderCron } from "@/lib/cron/repurchase-reminder"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Daily cron: repurchase win-back J+30 after delivery.
 * `Authorization: Bearer ${CRON_SECRET}`
 */
export async function GET(req: NextRequest) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runRepurchaseReminderCron({ daysAfterDelivery: 30, limit: 50 })
  return NextResponse.json({ ok: true, daysAfterDelivery: 30, ...result })
}
