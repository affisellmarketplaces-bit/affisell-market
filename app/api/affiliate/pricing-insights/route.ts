import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { computeMarketPricingInsight } from "@/lib/affiliate-market-pricing-insights.server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Real market pricing signal (comparable listing prices + actual 30-day sales) for one product's category. */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    productId?: unknown
    currentPriceCents?: unknown
    affiliateProductId?: unknown
  }
  const productId = typeof body.productId === "string" ? body.productId.trim() : ""
  if (!productId) {
    return NextResponse.json({ error: "productId required" }, { status: 400 })
  }
  const currentPriceCents =
    typeof body.currentPriceCents === "number" && Number.isFinite(body.currentPriceCents)
      ? Math.round(body.currentPriceCents)
      : null
  const excludeAffiliateProductId =
    typeof body.affiliateProductId === "string" ? body.affiliateProductId.trim() : undefined

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { categoryId: true, basePriceCents: true },
  })
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  const insight = await computeMarketPricingInsight({
    categoryId: product.categoryId,
    supplierPriceCents: product.basePriceCents,
    currentPriceCents: currentPriceCents ?? product.basePriceCents,
    excludeAffiliateProductId,
  })

  return NextResponse.json(insight)
}
