import { NextResponse } from "next/server"

import { getRedisUrl } from "@/lib/auto-order/redis"
import { getRadarDb } from "@/lib/prisma-radar"
import { LIVE_CONNECTOR_IDS } from "@/lib/radar/connectors/registry"
import { RADAR_ENABLED, resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { gate, isRedisConfigured } from "@/lib/radar/gate"
import { RADAR_PLANS } from "@/lib/radar/plans"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Prod debug — no secrets in response.
 * Keeps existing keys; adds plans, mapReady, subscriptions.
 */
export async function GET() {
  const blocked = gate()
  if (blocked) return blocked

  let db = false
  let alertsTable = false
  let subscriptions = 0
  if (resolveRadarDatabaseUrl()) {
    try {
      const client = getRadarDb()
      await client.$queryRaw`SELECT 1`
      db = true
      try {
        await client.radarAlert.findFirst({ select: { id: true } })
        alertsTable = true
      } catch {
        alertsTable = false
      }
      try {
        subscriptions = await client.alertSubscription.count({ where: { active: true } })
      } catch {
        subscriptions = 0
      }
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
  const tiktokCrawler = Boolean(process.env.TIKTOK_CRAWLER_ACCESS_TOKEN?.trim())

  const marketplaces = Array.from(LIVE_CONNECTOR_IDS)
  const mapReady = true
  const plansEnabled = process.env.RADAR_PLANS_ENABLED?.trim() !== "false"
  const degradedCrawler = !serper || !tiktokCrawler

  const payload = {
    redis,
    db,
    cronSecret,
    serper,
    tiktokCrawler,
    degradedCrawler,
    marketplaces,
    alertsTable,
    radarEnabled: RADAR_ENABLED === "true",
    mapReady,
    subscriptions,
    plans: {
      enabled: plansEnabled,
      free: RADAR_PLANS.free,
      starter: RADAR_PLANS.starter,
      pro: RADAR_PLANS.pro,
      global: RADAR_PLANS.global,
    },
  }

  console.log("[radar/health]", {
    result: "ok",
    redis,
    db,
    alertsTable,
    mapReady,
    subscriptions,
    serper,
    tiktokCrawler,
    degradedCrawler,
  })
  return NextResponse.json(payload)
}
