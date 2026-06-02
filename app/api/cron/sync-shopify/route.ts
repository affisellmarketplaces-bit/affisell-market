import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runShopifyAutoSyncCron } from "@/lib/shopify-catalog-sync"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const payload = await runShopifyAutoSyncCron()
  return Response.json({ ok: true, ...payload })
}
