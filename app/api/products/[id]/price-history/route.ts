import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { loadProductPriceHistory } from "@/lib/price-history.server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteParams = { params: Promise<{ id: string }> }

/**
 * GET /api/products/:id/price-history?days=90 — the supplier price history of a product (F1).
 * Who: the product's supplier, any reseller (they decide their listing price from the supplier price), an admin.
 * Buyers and anonymous visitors: no (the wholesale price is not a buyer-facing figure).
 */
export async function GET(req: Request, { params }: RouteParams) {
  const session = await auth()
  const userId = session?.user?.id
  const role = session?.user?.role
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, userId), {
    prefix: "price-history",
    limit: 120,
    windowMs: 60_000,
  })
  if (limited) return limited

  const { id } = await params
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true, supplierId: true } })
  if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const allowed = role === "ADMIN" || role === "AFFILIATE" || (role === "SUPPLIER" && product.supplierId === userId)
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const daysRaw = Number(new URL(req.url).searchParams.get("days") ?? "90")
  const result = await loadProductPriceHistory(product.id, { days: Number.isFinite(daysRaw) ? daysRaw : 90 })
  if (!result.available) {
    return NextResponse.json({ available: false, reason: result.reason, points: [], summary: null })
  }
  return NextResponse.json(result)
}
