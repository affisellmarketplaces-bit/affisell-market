import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { syncAutoBuyTracking } from "@/lib/fulfillment/auto-buy"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  // 45 s of AliExpress lookups at most (each one is bounded by the client timeout), within the 60 s function budget.
  const results = await syncAutoBuyTracking(200, { budgetMs: 45_000 })
  const updated = results.filter((r) => r.updated).length
  const byOutcome: Record<string, number> = {}
  for (const r of results) byOutcome[r.outcome] = (byOutcome[r.outcome] ?? 0) + 1

  console.log("[cron/sync-auto-buy-tracking]", { polled: results.length, updated, byOutcome })

  // Counts only: the per-order details (AliExpress ids, errors) stay in the logs, not in a cron response.
  return Response.json({ ok: true, polled: results.length, updated, byOutcome })
}
