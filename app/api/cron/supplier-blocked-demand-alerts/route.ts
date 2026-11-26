import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runSupplierBlockedDemandAlerts } from "@/lib/supplier-demand-alerts/blocked-demand.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Daily: tracks when listed products become unavailable and, when real demand is blocked, tells their SUPPLIER.
 * `SUPPLIER_BLOCKED_DEMAND_ALERTS_MODE` = off | observe (default: measures only) | enforce (one bell per supplier and
 * per day). Writes AuditLog bookkeeping + bell notifications only — never a product, a stock, a listing or money.
 * Bearer ${CRON_SECRET}.
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied
  return NextResponse.json({ ok: true, ...(await runSupplierBlockedDemandAlerts()) })
}
