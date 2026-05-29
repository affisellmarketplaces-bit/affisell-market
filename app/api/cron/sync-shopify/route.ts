import { runShopifyAutoSyncCron } from "@/lib/shopify-catalog-sync"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (secret) {
    const authHeader = req.headers.get("authorization") || ""
    if (authHeader !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const payload = await runShopifyAutoSyncCron()
  return Response.json({ ok: true, ...payload })
}
