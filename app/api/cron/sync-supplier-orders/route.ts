import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { syncAllOpenSupplierOrders } from "@/lib/suppliers/sync-order-status"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const results = await syncAllOpenSupplierOrders(200)
  const updated = results.filter((r) => r.updated).length
  const errors = results.filter((r) => r.error).length

  return Response.json({
    ok: true,
    polled: results.length,
    updated,
    errors,
    results,
  })
}
