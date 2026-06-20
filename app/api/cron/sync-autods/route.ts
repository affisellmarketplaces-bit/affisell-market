import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { syncOpenAutoDsOrders } from "@/lib/autods/sync-open-orders"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const results = await syncOpenAutoDsOrders(100)
  const updated = results.filter((r) => r.updated).length

  console.log("[cron/sync-autods]", {
    polled: results.length,
    updated,
    errors: results.filter((r) => r.error).length,
  })

  return Response.json({
    ok: true,
    polled: results.length,
    updated,
    results,
  })
}
