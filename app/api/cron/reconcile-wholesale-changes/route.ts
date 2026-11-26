import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { reconcileWholesaleIncreases } from "@/lib/wholesale-change-reconcile.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Supplier price increases recorded by the price-history trigger, whatever wrote them, run through the reseller margin
 * guard (lib/wholesale-change-reconcile.server.ts). Idempotent. Bearer ${CRON_SECRET}.
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await reconcileWholesaleIncreases()
  return NextResponse.json({ ok: result.failed === 0, ...result }, { status: result.failed === 0 ? 200 : 500 })
}
