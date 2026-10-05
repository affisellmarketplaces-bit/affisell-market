import "server-only"

import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma } from "@/lib/prisma"

/** Lowest-id live listing price per product (the price a buyer sees) — baseline for wishlist price alerts. */
export async function currentPricesForProducts(productIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (productIds.length === 0) return map

  const listings = await prisma.affiliateProduct.findMany({
    where: {
      productId: { in: productIds },
      ...buyerListedAffiliateProductWhere,
    },
    select: { productId: true, sellingPriceCents: true },
    orderBy: { id: "asc" },
  })
  for (const row of listings) {
    if (!map.has(row.productId)) map.set(row.productId, row.sellingPriceCents)
  }
  return map
}

export async function currentPriceForProduct(productId: string): Promise<number | null> {
  const map = await currentPricesForProducts([productId])
  return map.get(productId) ?? null
}

/** Price alert target in cents from a client-supplied euro amount; null when absent / not a positive number. */
export function parseTargetPriceCents(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? Math.round(raw * 100) : null
}
