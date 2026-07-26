import { NextResponse } from "next/server"

import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { checkStock } from "@/lib/ghost/check-stock"
import { ensureGhostStockSchema } from "@/lib/ghost/ensure-stock-schema"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/ghost/check — live supplier stock probe (Ghost Checkout).
 * Body: { productId }
 */
export async function POST(req: Request) {
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req), {
    limit: 30,
    windowMs: 60_000,
    prefix: "ghost-stock-check",
  })
  if (limited) return limited

  await ensureGhostStockSchema()

  const body = (await req.json().catch(() => ({}))) as { productId?: string }
  const productId = typeof body.productId === "string" ? body.productId.trim() : ""
  if (!productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 })
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      supplierUrl: true,
      supplierSource: true,
      supplierProductId: true,
      sourceUrl: true,
      importSource: true,
      aliexpressProductId: true,
      lastPriceSupplier: true,
      basePriceCents: true,
      stock: true,
      lastStockCheck: true,
      lastStockStatus: true,
    },
  })
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  const stock = await checkStock(product)
  return NextResponse.json({
    ok: true,
    productId: product.id,
    ...stock,
    checkedAt: stock.checkedAt.toISOString(),
  })
}
