import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runEnforceSupplierShipSlaCron } from "@/lib/cron/enforce-supplier-ship-sla"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Ship Pulse — auto-cancel marketplace orders past the 48h ship window.
 * Schedule every 15–30 min (GitHub Actions / Vercel Cron). `Authorization: Bearer ${CRON_SECRET}`
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runEnforceSupplierShipSlaCron(40)
  return Response.json({ ok: true, ...result })
}
