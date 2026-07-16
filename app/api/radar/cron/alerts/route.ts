import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { evaluateGlobalScan } from "@/lib/radar/alerts/engine"
import { sendAlertsToSubscribers } from "@/lib/radar/alerts/notifier"
import { requireRedis } from "@/lib/radar/gate"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { getRadarDb } from "@/lib/prisma-radar"
import { isRadarEnabled } from "@/lib/radar/gate"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Alert engine cron — every 4h.
 * Authorization: Bearer ${CRON_SECRET}
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  if (!isRadarEnabled()) {
    return NextResponse.json({
      skipped: true,
      reason: "RADAR_ENABLED=false",
      scanned: 0,
      alerts: 0,
      sent: 0,
    })
  }

  try {
    requireRedis()
  } catch {
    console.warn("[radar/cron/alerts]", { result: "warn", reason: "redis_missing" })
    // Continue evaluation (DB-backed); Slack fan-out still works without Redis
  }

  if (!resolveRadarDatabaseUrl()) {
    return NextResponse.json({
      skipped: true,
      reason: "no_database_url",
      scanned: 0,
      alerts: 0,
      sent: 0,
    })
  }

  try {
    const { scanned, alerts, createdIds } = await evaluateGlobalScan()

    const db = getRadarDb()
    const fresh =
      createdIds.length > 0
        ? await db.radarAlert.findMany({
            where: { id: { in: createdIds } },
          })
        : []

    const subscriptions = await db.alertSubscription.findMany({
      where: { active: true },
    })

    const { sent } = await sendAlertsToSubscribers(fresh, subscriptions)

    console.log("[radar/cron/alerts]", { result: "ok", scanned, alerts, sent })
    return NextResponse.json({ scanned, alerts, sent })
  } catch (err) {
    console.error("[radar/cron/alerts]", {
      result: "error",
      message: err instanceof Error ? err.message : "unknown",
    })
    return NextResponse.json({ error: "Alerts cron failed" }, { status: 500 })
  }
}
