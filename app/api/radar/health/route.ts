import { NextResponse } from "next/server"

import { getRedisUrl } from "@/lib/auto-order/redis"
import { getRadarDb } from "@/lib/prisma-radar"
import { LIVE_CONNECTOR_IDS } from "@/lib/radar/connectors/registry"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { gate, isRedisConfigured } from "@/lib/radar/gate"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Prod debug — no secrets in response.
 * GET /api/radar/health → { redis, db, cronSecret, serper, marketplaces }
 */
export async function GET() {
  const blocked = gate()
  if (blocked) return blocked

  let db = false
  if (resolveRadarDatabaseUrl()) {
    try {
      await getRadarDb().$queryRaw`SELECT 1`
      db = true
    } catch (err) {
      console.warn("[radar/health]", {
        result: "db_down",
        message: err instanceof Error ? err.message : "unknown",
      })
      db = false
    }
  }

  const redis = Boolean(getRedisUrl() || isRedisConfigured())
  const cronSecret = Boolean(process.env.CRON_SECRET?.trim())
  const serper = Boolean(
    process.env.SERPER_API_KEY?.trim() || process.env.SERPAPI_API_KEY?.trim()
  )

  const marketplaces = Array.from(LIVE_CONNECTOR_IDS)

  const payload = {
    redis,
    db,
    cronSecret,
    serper,
    marketplaces,
    radarEnabled: true,
  }

  console.log("[radar/health]", { result: "ok", ...payload })
  return NextResponse.json(payload)
}
