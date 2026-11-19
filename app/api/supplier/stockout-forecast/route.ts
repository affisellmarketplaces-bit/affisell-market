import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { loadStockoutForecasts } from "@/lib/supplier-catalog-health/stockout-forecast.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * SUPPLIER, READ-ONLY: stock-out forecast of its OWN products shown in resellers' shops — facts, calculation,
 * hypotheses and limits kept apart, cover compared with its declared lead time. Nothing is ordered or changed.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (session.user.role !== "SUPPLIER") return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, session.user.id), { prefix: "stockout-forecast", limit: 20, windowMs: 60_000 })
  if (limited) return limited
  try {
    return NextResponse.json(await loadStockoutForecasts({ supplierId: session.user.id }))
  } catch (error) {
    console.error("[stockout-forecast] load_failed", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ error: "stockout_forecast_unavailable" }, { status: 503 })
  }
}
