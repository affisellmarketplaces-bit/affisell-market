import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { processDueOrderPayouts } from "@/lib/order-payout"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const summary = await processDueOrderPayouts(200)
  return Response.json({ ok: true, ...summary })
}
