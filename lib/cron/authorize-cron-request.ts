import { timingSafeEqual } from "node:crypto"

import { NextResponse } from "next/server"

import { mustEnforceProductionSecrets } from "@/lib/require-production-secret"
import { secureBearerMatch } from "@/lib/secure-bearer"

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/**
 * Cron auth: `Authorization: Bearer ${CRON_SECRET}` or `x-cron-secret: ${CRON_SECRET}`.
 * In production (or on Vercel), CRON_SECRET must be set — open endpoints are rejected.
 */
export function authorizeCronRequest(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim()
  const authHeader = req.headers.get("authorization")
  const cronHeader = req.headers.get("x-cron-secret")?.trim() || ""

  if (!secret) {
    if (mustEnforceProductionSecrets()) {
      return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 })
    }
    return null
  }

  if (secureBearerMatch(authHeader, secret)) {
    return null
  }

  if (cronHeader && safeEqual(cronHeader, secret)) {
    return null
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
