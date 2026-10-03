import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { refreshSupplierDeliveryStatsBatch } from "@/lib/supplier-delivery-stats.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Measured supplier delivery stats (daily): median / p90 days from carrier-attested deliveries.
 * Time-boxed — each run refreshes the never-measured and stalest suppliers first.
 * Protect endpoint with `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await refreshSupplierDeliveryStatsBatch()
  console.log("[cron/refresh-supplier-delivery-stats]", result)
  return Response.json({ ok: true, schedule: "0 9 * * *", ...result })
}
