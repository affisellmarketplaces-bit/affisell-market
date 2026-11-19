import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { loadSupplierCatalogHealth } from "@/lib/supplier-catalog-health/diagnose.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * SUPPLIER, read-only: the health of the supplier's OWN catalogue — blocages, anomalies,
 * warnings and optional recommendations, ranked by observed commercial impact.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (session.user.role !== "SUPPLIER") return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, session.user.id), {
    prefix: "catalog-health",
    limit: 20,
    windowMs: 60_000,
  })
  if (limited) return limited
  try {
    return NextResponse.json(await loadSupplierCatalogHealth(session.user.id))
  } catch (error) {
    console.error("[catalog-health] load_failed", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ error: "catalog_health_unavailable" }, { status: 503 })
  }
}
