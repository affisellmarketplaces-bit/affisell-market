import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runReleaseBookingHoldsCron } from "@/lib/cron/release-booking-holds"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Release expired booking checkout holds every 5–15 min. `Authorization: Bearer ${CRON_SECRET}` */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runReleaseBookingHoldsCron(80)
  return Response.json({ ok: true, ...result })
}
