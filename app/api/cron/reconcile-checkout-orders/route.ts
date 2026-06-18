import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { reconcilePendingCheckoutOrders } from "@/lib/cron/reconcile-pending-checkout-orders"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Heal marketplace orders stuck in PENDING after Stripe Checkout was paid.
 * `Authorization: Bearer ${CRON_SECRET}`
 */
export async function GET(req: NextRequest) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await reconcilePendingCheckoutOrders()
  return NextResponse.json(result)
}
