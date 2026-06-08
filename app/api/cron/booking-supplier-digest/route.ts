import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runBookingSupplierDigestCron } from "@/lib/cron/booking-supplier-digest"

export const dynamic = "force-dynamic"

/** J-0 supplier booking digest. `Authorization: Bearer ${CRON_SECRET}` */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runBookingSupplierDigestCron()
  return NextResponse.json({ ok: true, ...result })
}
