import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runOnboardingCron } from "@/lib/emails/schedule-onboarding"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Daily merchant onboarding emails (J+1 / J+3 / J+7) for AFFILIATE + SUPPLIER.
 * `Authorization: Bearer ${CRON_SECRET}` — schedule 09:00 UTC.
 */
export async function GET(req: NextRequest) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runOnboardingCron()
  return NextResponse.json({ ok: true, ...result })
}
