import { NextResponse } from "next/server"

import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { loadShopVariantAlternatives } from "@/lib/restock-watch/shop-alternatives.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const clip = (v: string | null) => (v ? v.slice(0, 120) : null)

/**
 * PUBLIC, read-only: products already live in the SAME shop that offer the buyer's sold-out variant. Only what the shop
 * already shows (name, photo, listing). `SHOP_VARIANT_ALTERNATIVES_MODE` off by default → `{ mode: "off" }`.
 */
export async function GET(req: Request) {
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req), { prefix: "shop-variant-alts", limit: 30, windowMs: 60_000 })
  if (limited) return limited
  const sp = new URL(req.url).searchParams
  const listingId = clip(sp.get("listingId"))
  if (!listingId) return NextResponse.json({ error: "invalid_query" }, { status: 400 })
  try {
    const r = await loadShopVariantAlternatives(listingId, { color: clip(sp.get("color")), size: clip(sp.get("size")), storage: clip(sp.get("storage")) })
    return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ mode: "off" })
  }
}
