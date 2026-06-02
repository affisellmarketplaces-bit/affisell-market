import { NextResponse } from "next/server"

import { mustEnforceProductionSecrets } from "@/lib/require-production-secret"
import { secureBearerMatch } from "@/lib/secure-bearer"

/**
 * Cron auth: `Authorization: Bearer ${CRON_SECRET}`.
 * In production (or on Vercel), CRON_SECRET must be set — open endpoints are rejected.
 */
export function authorizeCronRequest(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim()
  const authHeader = req.headers.get("authorization")

  if (!secret) {
    if (mustEnforceProductionSecrets()) {
      return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 })
    }
    return null
  }

  if (!secureBearerMatch(authHeader, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return null
}
