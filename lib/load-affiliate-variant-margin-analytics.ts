import {
  AFFILIATE_MARGIN_ANALYTICS_DAYS,
  AFFILIATE_MARGIN_ANALYTICS_ORDER_STATUSES,
  buildAffiliateVariantMarginAnalytics,
  type AffiliateVariantMarginAnalyticsSnapshot,
} from "@/lib/affiliate-variant-margin-analytics"
import { prisma } from "@/lib/prisma"

export function emptyAffiliateVariantMarginAnalytics(): AffiliateVariantMarginAnalyticsSnapshot {
  return {
    days: AFFILIATE_MARGIN_ANALYTICS_DAYS,
    rows: [],
    totals: { unitsSold: 0, netEarningsCents: 0, markupCents: 0 },
  }
}

export async function loadAffiliateVariantMarginAnalytics(
  affiliateId: string,
  days = AFFILIATE_MARGIN_ANALYTICS_DAYS
): Promise<AffiliateVariantMarginAnalyticsSnapshot> {
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - days)
  since.setUTCHours(0, 0, 0, 0)

  const orders = await prisma.order.findMany({
    where: {
      affiliateId,
      status: { in: [...AFFILIATE_MARGIN_ANALYTICS_ORDER_STATUSES] },
      createdAt: { gte: since },
    },
    select: {
      affiliateProductId: true,
      variantLabel: true,
      quantity: true,
      sellingPriceCents: true,
      affiliatePayoutCents: true,
      affiliateMarginRetainedCents: true,
      affiliateFeeCents: true,
      marginCents: true,
    },
  })

  const listingIds = [...new Set(orders.map((o) => o.affiliateProductId))]
  if (listingIds.length === 0) {
    return emptyAffiliateVariantMarginAnalytics()
  }

  const listings = await prisma.affiliateProduct.findMany({
    where: { id: { in: listingIds }, affiliateId },
    select: {
      id: true,
      productId: true,
      customTitle: true,
      clicks: true,
      conversions: true,
      variantPricing: true,
      product: { select: { name: true } },
    },
  })

  return buildAffiliateVariantMarginAnalytics({
    days,
    orders: orders.map((o) => ({
      affiliateProductId: o.affiliateProductId,
      variantLabel: o.variantLabel,
      quantity: o.quantity,
      sellingPriceCents: o.sellingPriceCents,
      affiliatePayoutCents: o.affiliatePayoutCents,
      affiliateMarginRetainedCents: o.affiliateMarginRetainedCents,
      affiliateFeeCents: o.affiliateFeeCents,
      affiliateMarginCents: o.marginCents,
    })),
    listings: listings.map((l) => ({
      id: l.id,
      productId: l.productId,
      productName: l.product.name,
      customTitle: l.customTitle,
      clicks: l.clicks,
      conversions: l.conversions,
      variantPricing: l.variantPricing,
    })),
  })
}
