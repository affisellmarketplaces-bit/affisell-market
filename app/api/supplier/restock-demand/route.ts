import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { loadSupplierRestockDemand } from "@/lib/restock-watch/restock-demand.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * SUPPLIER, READ-ONLY: distinct buyers waiting for the return of each sold-out variant of ITS OWN products (shown from
 * 3 buyers). Counts and the variant's label only — never a buyer, a date, a shop or an order.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (session.user.role !== "SUPPLIER") return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, session.user.id), { prefix: "restock-demand", limit: 20, windowMs: 60_000 })
  if (limited) return limited
  try {
    return NextResponse.json(await loadSupplierRestockDemand(session.user.id))
  } catch (error) {
    console.error("[restock-demand] load_failed", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ error: "restock_demand_unavailable" }, { status: 503 })
  }
}
