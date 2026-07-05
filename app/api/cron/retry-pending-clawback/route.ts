import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { retryPendingClawbacks } from "@/lib/cron/retry-pending-clawback"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Retry ledger clawback for orders stuck in REFUND_PENDING_CLAWBACK.
 * `Authorization: Bearer ${CRON_SECRET}`
 */
export async function GET(req: NextRequest) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await retryPendingClawbacks()
  return NextResponse.json(result)
}
