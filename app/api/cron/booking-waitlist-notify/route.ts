import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { processBookingWaitlistNotifications } from "@/lib/booking/waitlist"

export const dynamic = "force-dynamic"

/** Notify waitlist when seats free up. `Authorization: Bearer ${CRON_SECRET}` */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await processBookingWaitlistNotifications(50)
  return NextResponse.json({ ok: true, ...result })
}
