import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { loadSupplierVariantStock } from "@/lib/supplier-catalog-health/variant-stockout.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** SUPPLIER, READ-ONLY: per-variant stock of its own products in resellers' shops — partial stock-outs, variants at risk. */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (session.user.role !== "SUPPLIER") return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, session.user.id), { prefix: "variant-stock", limit: 20, windowMs: 60_000 })
  if (limited) return limited
  try {
    return NextResponse.json(await loadSupplierVariantStock(session.user.id))
  } catch (error) {
    console.error("[variant-stock] load_failed", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ error: "variant_stock_unavailable" }, { status: 503 })
  }
}
