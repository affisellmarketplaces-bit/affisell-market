import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runVerifySuppliersCron } from "@/lib/cron/verify-suppliers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Affisell+ supplier verification run (daily 03:00).
 * Protect endpoint with `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runVerifySuppliersCron()
  return Response.json({ ok: true, schedule: "0 3 * * *", ...result })
}
