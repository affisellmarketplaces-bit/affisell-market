import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { restoreStockForClosedOrders } from "@/lib/stock-restitution.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Gives back the stock of paid orders that were closed (refunded / cancelled) before anything shipped — only units that
 * `CHECKOUT_STOCK_MODE=enforce` really took (lib/stock-restitution.ts). Idempotent: an order is restored once, whatever
 * the number of runs. With the default `warn` mode nothing is reserved, so this finds nothing. Bearer ${CRON_SECRET}.
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const results = await restoreStockForClosedOrders(100)
  const byOutcome: Record<string, number> = {}
  for (const r of results) byOutcome[r.outcome] = (byOutcome[r.outcome] ?? 0) + 1
  const failed = results.filter((r) => r.outcome === "error").length

  console.log("[cron/restore-closed-order-stock]", { examined: results.length, byOutcome })
  // A failed restitution is retried at the next run (nothing was written for it): a warning, not a red run.
  return NextResponse.json({ ok: true, examined: results.length, failed, byOutcome })
}
