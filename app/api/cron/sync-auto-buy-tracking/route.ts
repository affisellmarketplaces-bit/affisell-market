import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { syncAutoBuyTracking } from "@/lib/fulfillment/auto-buy"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const results = await syncAutoBuyTracking(200)
  const updated = results.filter((r) => r.updated).length

  console.log("[cron/sync-auto-buy-tracking]", { polled: results.length, updated })

  return Response.json({
    ok: true,
    polled: results.length,
    updated,
    results,
  })
}
