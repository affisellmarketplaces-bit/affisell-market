import { syncAutoBuyTracking } from "@/lib/fulfillment/auto-buy"

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
