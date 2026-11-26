import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runUnsellableListingAlerts } from "@/lib/reseller-replacement/unsellable-alerts.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Daily: tells each reseller, once per listing / problem / 14 days, that a product of its shop can no longer be bought,
 * with the « withdraw or replace » page in its bell. `RESELLER_UNSELLABLE_ALERTS_MODE` = off | observe (default: logs
 * only, writes nothing) | enforce. Writes only an AuditLog claim + a bell notification — never a listing, never money.
 * Bearer ${CRON_SECRET}.
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied
  const result = await runUnsellableListingAlerts()
  return NextResponse.json({ ok: true, ...result })
}
