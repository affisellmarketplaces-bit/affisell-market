import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runRefreshSupplierTrustScoresCron } from "@/lib/cron/refresh-supplier-trust-scores"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Lightning trust score refresh (daily).
 * Protect endpoint with `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runRefreshSupplierTrustScoresCron()
  return Response.json({ ok: true, schedule: "0 9 * * *", ...result })
}
