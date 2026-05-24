import { type NextRequest, NextResponse } from "next/server"

import { runStripeHealthCron } from "@/lib/cron/stripe-health"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Vercel Cron (hourly): alert when paid orders >1h lack ProcessedWebhook success.
 * `Authorization: Bearer ${CRON_SECRET}`
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const authHeader = req.headers.get("authorization")
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await runStripeHealthCron({ olderThanHours: 1 })
  return NextResponse.json(result)
}
