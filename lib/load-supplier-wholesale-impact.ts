import {
  buildSupplierWholesaleImpact,
  SUPPLIER_WHOLESALE_IMPACT_DAYS,
  type SupplierWholesaleImpactSnapshot,
} from "@/lib/supplier-wholesale-impact"
import { prisma } from "@/lib/prisma"

const COUNTABLE_STATUSES = ["paid", "preparing", "shipped"] as const

export function emptySupplierWholesaleImpact(): SupplierWholesaleImpactSnapshot {
  return {
    days: SUPPLIER_WHOLESALE_IMPACT_DAYS,
    rows: [],
    totals: {
      affiliateListingsLive: 0,
      marginReviewOpen: 0,
      productsWithOpenReviews: 0,
      unitsSold30d: 0,
      wholesaleGmvCents30d: 0,
    },
  }
}

export async function loadSupplierWholesaleImpact(
  supplierId: string,
  days = SUPPLIER_WHOLESALE_IMPACT_DAYS
): Promise<SupplierWholesaleImpactSnapshot> {
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - days)
  since.setUTCHours(0, 0, 0, 0)

  const [listings, orders] = await Promise.all([
    prisma.affiliateProduct.findMany({
      where: { product: { supplierId } },
      select: {
        productId: true,
        isListed: true,
        marginReviewNeeded: true,
      },
    }),
    prisma.order.findMany({
      where: {
        supplierId,
        status: { in: [...COUNTABLE_STATUSES] },
        createdAt: { gte: since },
      },
      select: {
        productId: true,
        quantity: true,
        basePriceCents: true,
      },
    }),
  ])

  return buildSupplierWholesaleImpact({
    days,
    listings,
    orders,
  })
}
