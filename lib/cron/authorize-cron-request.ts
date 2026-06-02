import { NextResponse } from "next/server"

/**
 * Cron auth: `Authorization: Bearer ${CRON_SECRET}`.
 * In production (or on Vercel), CRON_SECRET must be set — open endpoints are rejected.
 */
export function authorizeCronRequest(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim()
  const authHeader = req.headers.get("authorization")?.trim() ?? ""

  if (!secret) {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
      return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 })
    }
    return null
  }

  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return null
}
