import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runStripeHealthCron } from "@/lib/cron/stripe-health"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Vercel Cron (hourly): alert when paid orders >1h lack ProcessedWebhook success.
 * `Authorization: Bearer ${CRON_SECRET}`
 */
export async function GET(req: NextRequest) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runStripeHealthCron({ olderThanHours: 1 })
  return NextResponse.json(result)
}
