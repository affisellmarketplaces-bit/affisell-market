import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runMerchantKycReminderCron } from "@/lib/cron/merchant-kyc-reminder"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Vercel Cron: remind suppliers with drafts blocked by pending KYC.
 * `Authorization: Bearer ${CRON_SECRET}`
 */
export async function GET(req: NextRequest) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runMerchantKycReminderCron(40)
  return NextResponse.json({ ok: true, ...result })
}
