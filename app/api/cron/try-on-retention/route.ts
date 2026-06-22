import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runTryOnRetentionCleanup } from "@/lib/try-on/try-on-service.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GDPR retention: delete shopper inputs after 24h, outputs after 30 days. */
export async function GET(req: NextRequest) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runTryOnRetentionCleanup()
  return NextResponse.json({ ok: true, ...result })
}
