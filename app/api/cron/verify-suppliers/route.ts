import { runVerifySuppliersCron } from "@/lib/cron/verify-suppliers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Affisell+ supplier verification run (daily 03:00).
 * Protect endpoint with `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (secret) {
    const authHeader = req.headers.get("authorization") || ""
    if (authHeader !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const result = await runVerifySuppliersCron()
  return Response.json({ ok: true, schedule: "0 3 * * *", ...result })
}
