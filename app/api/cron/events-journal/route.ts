import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runEventsJournalCron } from "@/lib/cron/events-journal"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Business journal projection (event spine S2), hourly. Does nothing unless EVENTS_JOURNAL=on.
 * Protect endpoint with `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied
  const result = await runEventsJournalCron()
  return Response.json({ ok: true, schedule: "0 * * * *", ...result })
}
