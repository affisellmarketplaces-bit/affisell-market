import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runProfitAlertsForAllResellers } from "@/lib/intelligence/profit-alerts.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Daily proactive profitability alerts (lib/intelligence/profit-alerts*.ts): for each reseller with recent sales,
 * detects the products whose net earnings fell for an established cause, records each alert once (database unique
 * keys) and delivers it on the channels the reseller allows. Idempotent: running it twice the same day sends nothing
 * new. Writes only alert / delivery / notification rows — never a price, never money. Bearer ${CRON_SECRET}.
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied
  const result = await runProfitAlertsForAllResellers()
  return NextResponse.json({ ok: result.failed === 0, ...result }, { status: result.failed === 0 ? 200 : 500 })
}
