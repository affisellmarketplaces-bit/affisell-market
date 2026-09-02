import "server-only"

import { unstable_cache } from "next/cache"

import { anonymizeDisplayName } from "@/lib/anonymize-display-name"
import {
  emptyProductSocialProof,
  type ProductSocialProofData,
} from "@/lib/product-social-proof-shared"
import { prisma } from "@/lib/prisma"

const REVALIDATE_SEC = 120
const COUNTABLE_ORDER_STATUSES = ["paid", "preparing", "shipped"] as const

function thirtyDaysAgo(): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 30)
  return d
}

function paidOrderWhere(productId: string, since: Date) {
  return {
    productId,
    paidAt: { gte: since, not: null },
    status: { in: [...COUNTABLE_ORDER_STATUSES] },
    affiliateId: { not: "" },
  } as const
}

async function loadProductCrossSocialProof(productId: string): Promise<ProductSocialProofData> {
  const id = productId.trim()
  if (!id) return emptyProductSocialProof()

  const since = thirtyDaysAgo()
  const where = paidOrderWhere(id, since)

  const [resellerGroups, marginFromSales, marginFromOrders, lastOrder] = await Promise.all([
    prisma.order.groupBy({
      by: ["affiliateId"],
      where,
    }),
    prisma.affiliateSale.aggregate({
      where: {
        order: where,
      },
      _avg: { marginAmountCents: true },
      _max: { marginAmountCents: true },
    }),
    prisma.order.aggregate({
      where,
      _avg: { marginCents: true },
      _max: { marginCents: true },
    }),
    prisma.order.findFirst({
      where,
      orderBy: { paidAt: "desc" },
      select: {
        paidAt: true,
        affiliate: { select: { name: true } },
      },
    }),
  ])

  const avgMarginCents = Math.round(
    marginFromSales._avg.marginAmountCents ??
      marginFromOrders._avg.marginCents ??
      0
  )
  const topMarginCents = Math.max(
    marginFromSales._max.marginAmountCents ?? 0,
    marginFromOrders._max.marginCents ?? 0
  )

  const lastSaleAt = lastOrder?.paidAt?.toISOString() ?? null
  const lastSaleResellerLabel = anonymizeDisplayName(lastOrder?.affiliate?.name)

  const payload: ProductSocialProofData = {
    activeResellersCount: resellerGroups.length,
    avgMarginCents: Math.max(0, avgMarginCents),
    topMarginCents: Math.max(0, topMarginCents),
    lastSaleAt,
    lastSaleResellerLabel,
  }

  console.log("[product-social-proof]", {
    productId: id,
    activeResellersCount: payload.activeResellersCount,
    avgMarginCents: payload.avgMarginCents,
    topMarginCents: payload.topMarginCents,
    hasLastSale: Boolean(lastSaleAt),
  })

  return payload
}

/** Cross-request cache — product-level reseller FOMO for PDP + supplier catalog. */
export function loadProductCrossSocialProofCached(
  productId: string
): Promise<ProductSocialProofData> {
  const id = productId.trim()
  if (!id) return Promise.resolve(emptyProductSocialProof())

  return unstable_cache(
    () => loadProductCrossSocialProof(id),
    ["product-cross-social-proof", id],
    { revalidate: REVALIDATE_SEC, tags: [`product-social-${id}`] }
  )()
}
