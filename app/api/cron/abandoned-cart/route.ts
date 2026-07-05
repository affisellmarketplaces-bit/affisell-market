import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runAbandonedCartReminderCron } from "@/lib/cron/abandoned-cart-reminder"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Proactive cart abandonment recovery (1h idle). Bearer ${CRON_SECRET}
 */
export async function GET(req: NextRequest) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runAbandonedCartReminderCron({ hoursAfterInactivity: 1, limit: 50 })
  return NextResponse.json({ ok: true, hoursAfterInactivity: 1, ...result })
}
