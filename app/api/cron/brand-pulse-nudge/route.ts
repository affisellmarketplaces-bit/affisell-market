import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runBrandPulseNudgeCron } from "@/lib/cron/brand-pulse-nudge"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Daily cron: nudge merchants with Brand Pulse score ≤ 71 (once per store).
 * `Authorization: Bearer ${CRON_SECRET}`
 */
export async function GET(req: NextRequest) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runBrandPulseNudgeCron(40)
  return NextResponse.json({ ok: true, ...result })
}
