import { runEnforceSupplierShipSlaCron } from "@/lib/cron/enforce-supplier-ship-sla"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Ship Pulse — auto-cancel marketplace orders past the 48h ship window.
 * Schedule every 15–30 min (Vercel Cron / external). `Authorization: Bearer ${CRON_SECRET}`
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (secret) {
    const authHeader = req.headers.get("authorization") || ""
    if (authHeader !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const result = await runEnforceSupplierShipSlaCron(40)
  return Response.json({ ok: true, ...result })
}
