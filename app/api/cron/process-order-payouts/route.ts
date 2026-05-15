import { processDueOrderPayouts } from "@/lib/order-payout"

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

  const summary = await processDueOrderPayouts(200)
  return Response.json({ ok: true, ...summary })
}
