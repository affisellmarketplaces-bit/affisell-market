import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runSupplierWeeklyReportCron } from "@/lib/emails/send-supplier-weekly-report"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Weekly supplier performance digest — Monday 09:00 UTC.
 * `Authorization: Bearer ${CRON_SECRET}`
 */
export async function GET(req: NextRequest) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runSupplierWeeklyReportCron()
  return NextResponse.json({ ok: true, ...result })
}
