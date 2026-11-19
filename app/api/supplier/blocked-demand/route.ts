import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { loadSupplierBlockedDemand } from "@/lib/supplier-demand-alerts/blocked-demand.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * SUPPLIER, READ-ONLY: its OWN products whose real demand (observed orders, failed paid lines) is blocked by an
 * unavailability it can fix — cause, since when, what was observed, the fix. Counts only, never a reseller.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (session.user.role !== "SUPPLIER") return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, session.user.id), { prefix: "blocked-demand", limit: 20, windowMs: 60_000 })
  if (limited) return limited
  try {
    return NextResponse.json(await loadSupplierBlockedDemand(session.user.id))
  } catch (error) {
    console.error("[blocked-demand] load_failed", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ error: "blocked_demand_unavailable" }, { status: 503 })
  }
}
