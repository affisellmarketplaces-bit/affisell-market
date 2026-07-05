import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { reconcilePayouts } from "@/lib/cron/reconcile-payouts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Daily payout reconciliation: Order vs TransferAttempt vs MerchantPayoutLedger vs Stripe.
 * `Authorization: Bearer ${CRON_SECRET}`
 */
export async function GET(req: NextRequest) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await reconcilePayouts()
  return NextResponse.json(result)
}
