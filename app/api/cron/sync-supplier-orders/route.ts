import { syncAllOpenSupplierOrders } from "@/lib/suppliers/sync-order-status"

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
