import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runRestockWatchNotify } from "@/lib/restock-watch/restock-watch.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Periodic: « Prévenez-moi au retour de cette taille ». `RESTOCK_WATCH_MODE` = off (default: does nothing) | observe
 * (measures what it would send, closes useless requests, sends nothing) | enforce (ONE Web Push per request when the
 * exact variant is really back). Writes AuditLog bookkeeping only — never a product, a stock, a listing or money.
 * Bearer ${CRON_SECRET}.
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied
  return NextResponse.json({ ok: true, ...(await runRestockWatchNotify()) })
}
