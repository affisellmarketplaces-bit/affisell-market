import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { checkMarginLocks } from "@/lib/margin/margin-lock-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Daily Margin Lock maintenance.
 * GET /api/cron/margin-locks
 * Auth: Bearer CRON_SECRET
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  try {
    const result = await checkMarginLocks(500)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error("[cron/margin-locks]", {
      error: err instanceof Error ? err.message : "unknown",
    })
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 })
  }
}
