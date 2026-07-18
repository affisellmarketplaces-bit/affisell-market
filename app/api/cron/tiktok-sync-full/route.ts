import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { syncAllShops } from "@/lib/tiktok/sync"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Full TikTok order sync (last 30d) — daily 02:00 UTC.
 * Authorization: Bearer ${CRON_SECRET}
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  if (!resolveRadarDatabaseUrl()) {
    return NextResponse.json({ skipped: true, reason: "no_database_url", shops: 0 })
  }

  const result = await syncAllShops({ mode: "full" })
  console.log("[cron/tiktok-sync-full]", {
    shops: result.shops,
    upserted: result.results.reduce((a, r) => a + r.upserted, 0),
  })
  return NextResponse.json(result)
}
