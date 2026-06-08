import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runBookingRemindersCron } from "@/lib/cron/booking-reminders"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** J-1 + H-2 booking reminders. `Authorization: Bearer ${CRON_SECRET}` */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runBookingRemindersCron(40)
  return NextResponse.json({ ok: true, ...result })
}
