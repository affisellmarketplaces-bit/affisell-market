import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { loadResellerAlerts } from "@/lib/intelligence/profit-alerts.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/affiliate/profit-alerts — the signed-in reseller's OWN profitability alerts (no parameter selects another). */
export async function GET(req: Request) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (session?.user?.role !== "AFFILIATE") return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, userId), { prefix: "profit-alerts", limit: 60, windowMs: 60_000 })
  if (limited) return limited
  return NextResponse.json({ alerts: await loadResellerAlerts(userId) })
}
