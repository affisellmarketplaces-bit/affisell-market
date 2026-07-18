import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { decryptString, encryptString } from "@/lib/crypto"
import { getRadarDb } from "@/lib/prisma-radar"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { refreshAccessToken } from "@/lib/tiktok/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Daily TikTok token refresh — Authorization: Bearer ${CRON_SECRET}
 * Refreshes ShopConnection where expiresAt < now+24h.
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  if (!resolveRadarDatabaseUrl()) {
    return NextResponse.json({ skipped: true, reason: "no_database_url", refreshed: 0, failed: 0 })
  }

  const db = getRadarDb()
  const horizon = new Date(Date.now() + 24 * 60 * 60 * 1000)

  const connections = await db.shopConnection.findMany({
    where: {
      connectorId: "tiktok_shop",
      status: "active",
      OR: [{ expiresAt: { lte: horizon } }, { expiresAt: null }],
    },
    take: 200,
  })

  let refreshed = 0
  let failed = 0
  let disconnected = 0

  for (const conn of connections) {
    if (!conn.refreshToken) {
      failed += 1
      continue
    }
    try {
      const refreshToken = decryptString(conn.refreshToken)
      const token = await refreshAccessToken(refreshToken)
      const expiresAt = new Date(Date.now() + token.expires_in * 1000)
      await db.shopConnection.update({
        where: { id: conn.id },
        data: {
          accessToken: encryptString(token.access_token),
          refreshToken: encryptString(token.refresh_token),
          expiresAt,
          status: "active",
        },
      })
      refreshed += 1
      console.log("[cron/tiktok-refresh]", {
        shopId: conn.shopId,
        userId: conn.userId,
        result: "refreshed",
      })
    } catch (err) {
      failed += 1
      const message = err instanceof Error ? err.message : String(err)
      const revoked = /revok|unauthorized|invalid.?token|401|403/i.test(message)
      if (revoked) {
        await db.shopConnection.update({
          where: { id: conn.id },
          data: { status: "disconnected" },
        })
        disconnected += 1
        console.warn("[cron/tiktok-refresh]", {
          shopId: conn.shopId,
          userId: conn.userId,
          result: "disconnected",
        })
      } else {
        console.error("[cron/tiktok-refresh]", {
          shopId: conn.shopId,
          result: "error",
          message,
        })
      }
    }
  }

  return NextResponse.json({
    scanned: connections.length,
    refreshed,
    failed,
    disconnected,
  })
}
