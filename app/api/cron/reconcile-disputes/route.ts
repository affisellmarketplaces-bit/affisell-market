import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { reconcileStripeDisputes } from "@/lib/finance/dispute-reconcile.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Daily safety net for lost dispute webhooks (see lib/finance/dispute-reconcile.ts). `DISPUTE_RECONCILE_MODE` =
 * off | report (default: lists what would be replayed, writes nothing) | apply. Never returns personal data.
 */
export async function GET(req: NextRequest) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied
  const result = await reconcileStripeDisputes()
  return NextResponse.json({ ok: true, ...result })
}
