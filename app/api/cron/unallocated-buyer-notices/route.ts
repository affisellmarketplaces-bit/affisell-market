import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { retryUnallocatedBuyerNotices } from "@/lib/unallocated-buyer-notice.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Sends the buyer notices that are due for paid lines without an order (initial notice, then « refund confirmed »),
 * including after a failed send. Each notice is claimed by a deterministic row before sending: a run never sends one
 * twice, and a claim with no recorded outcome is left to a human (never re-sent). Does nothing unless
 * UNALLOCATED_LINE_BUYER_EMAIL=true. Bearer ${CRON_SECRET}.
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied
  const result = await retryUnallocatedBuyerNotices({ limit: 50 })
  console.log("[cron/unallocated-buyer-notices]", result)
  return NextResponse.json({ ok: true, ...result })
}
