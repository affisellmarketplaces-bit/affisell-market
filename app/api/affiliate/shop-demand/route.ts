import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { loadShopRecovery, loadShopRestockDemand } from "@/lib/restock-watch/shop-demand.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * RESELLER, read-only: its OWN shop's waited variants (distinct buyers of this shop, from 3) and what followed the
 * alternatives it chose (counts only; a sale after a choice is an association, not a proof).
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (session.user.role !== "AFFILIATE") return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, session.user.id), { prefix: "shop-demand", limit: 30, windowMs: 60_000 })
  if (limited) return limited
  try {
    const [items, recovery] = await Promise.all([
      loadShopRestockDemand(session.user.id),
      loadShopRecovery({ affiliateId: session.user.id, days: 90 }).catch(() => null),
    ])
    return NextResponse.json({ items, recovery })
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }
}
