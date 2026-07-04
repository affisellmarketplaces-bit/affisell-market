import { normalizeVariantPromotionKey } from "@/lib/affiliate-storefront-variants"
import { parseAffiliateVariantPricingJson } from "@/lib/affiliate-variant-pricing"
import { netAffiliateTransferCents } from "@/lib/marketplace-phase1-fees"

export const AFFILIATE_MARGIN_ANALYTICS_DAYS = 30

const COUNTABLE_STATUSES = ["paid", "preparing", "shipped"] as const

export type AffiliateMarginOrderRow = {
  affiliateProductId: string
  variantLabel: string | null
  quantity: number
  sellingPriceCents: number
  affiliatePayoutCents: number
  affiliateMarginRetainedCents: number
  affiliateFeeCents: number
  affiliateMarginCents: number
}

export type AffiliateMarginListingMeta = {
  id: string
  productId: string
  productName: string
  customTitle: string | null
  clicks: number
  conversions: number
  variantPricing: unknown
}

export type AffiliateVariantMarginAnalyticsRow = {
  listingId: string
  productId: string
  productTitle: string
  variantKey: string
  unitsSold: number
  revenueCents: number
  markupCents: number
  netEarningsCents: number
  avgMarkupPerUnitCents: number
  configuredMarginCents: number | null
  listingConversionPct: number | null
  shareOfListingSalesPct: number
}

export type AffiliateVariantMarginAnalyticsSnapshot = {
  days: number
  rows: AffiliateVariantMarginAnalyticsRow[]
  totals: {
    unitsSold: number
    netEarningsCents: number
    markupCents: number
  }
}

function variantKeyFromLabel(label: string | null): string {
  const trimmed = label?.trim()
  if (!trimmed) return "default"
  return normalizeVariantPromotionKey(trimmed) || trimmed
}

function listingTitle(meta: AffiliateMarginListingMeta): string {
  return meta.customTitle?.trim() || meta.productName.trim() || "Listing"
}

function listingConversionPct(meta: AffiliateMarginListingMeta): number | null {
  if (meta.clicks <= 0) return null
  return Math.round((meta.conversions / meta.clicks) * 1000) / 10
}

function configuredMarginCents(
  meta: AffiliateMarginListingMeta,
  variantKey: string
): number | null {
  const map = parseAffiliateVariantPricingJson(meta.variantPricing)
  if (variantKey === "default") {
    const first = Object.values(map)[0]
    return first?.marginCents ?? null
  }
  const direct = map[variantKey]?.marginCents
  if (direct != null) return direct
  for (const [k, v] of Object.entries(map)) {
    if (normalizeVariantPromotionKey(k) === variantKey) return v.marginCents
  }
  return null
}

export function buildAffiliateVariantMarginAnalytics(args: {
  orders: AffiliateMarginOrderRow[]
  listings: AffiliateMarginListingMeta[]
  days?: number
}): AffiliateVariantMarginAnalyticsSnapshot {
  const days = args.days ?? AFFILIATE_MARGIN_ANALYTICS_DAYS
  const listingById = new Map(args.listings.map((l) => [l.id, l]))

  type Acc = {
    listingId: string
    variantKey: string
    unitsSold: number
    revenueCents: number
    markupCents: number
    netEarningsCents: number
  }

  const acc = new Map<string, Acc>()
  const listingUnits = new Map<string, number>()

  for (const o of args.orders) {
    const listingId = o.affiliateProductId
    const variantKey = variantKeyFromLabel(o.variantLabel)
    const key = `${listingId}:${variantKey}`
    const qty = Math.max(1, o.quantity)
    const markup = Math.max(0, o.affiliateMarginRetainedCents)
    const net = netAffiliateTransferCents({
      affiliatePayoutCents: o.affiliatePayoutCents,
      affiliateMarginRetainedCents: o.affiliateMarginRetainedCents,
      affiliateFeeCents: o.affiliateFeeCents,
      affiliateMarginCents: o.affiliateMarginCents,
    })

    const cur = acc.get(key) ?? {
      listingId,
      variantKey,
      unitsSold: 0,
      revenueCents: 0,
      markupCents: 0,
      netEarningsCents: 0,
    }
    cur.unitsSold += qty
    cur.revenueCents += o.sellingPriceCents * qty
    cur.markupCents += markup
    cur.netEarningsCents += net
    acc.set(key, cur)

    listingUnits.set(listingId, (listingUnits.get(listingId) ?? 0) + qty)
  }

  const rows: AffiliateVariantMarginAnalyticsRow[] = [...acc.values()]
    .map((row) => {
      const meta = listingById.get(row.listingId)
      if (!meta) return null
      const totalListingUnits = listingUnits.get(row.listingId) ?? row.unitsSold
      const share =
        totalListingUnits > 0
          ? Math.round((row.unitsSold / totalListingUnits) * 1000) / 10
          : 100
      return {
        listingId: row.listingId,
        productId: meta.productId,
        productTitle: listingTitle(meta),
        variantKey: row.variantKey,
        unitsSold: row.unitsSold,
        revenueCents: row.revenueCents,
        markupCents: row.markupCents,
        netEarningsCents: row.netEarningsCents,
        avgMarkupPerUnitCents:
          row.unitsSold > 0 ? Math.round(row.markupCents / row.unitsSold) : 0,
        configuredMarginCents: configuredMarginCents(meta, row.variantKey),
        listingConversionPct: listingConversionPct(meta),
        shareOfListingSalesPct: share,
      }
    })
    .filter((r): r is AffiliateVariantMarginAnalyticsRow => r != null)
    .sort((a, b) => b.netEarningsCents - a.netEarningsCents || b.unitsSold - a.unitsSold)

  const totals = rows.reduce(
    (t, r) => ({
      unitsSold: t.unitsSold + r.unitsSold,
      netEarningsCents: t.netEarningsCents + r.netEarningsCents,
      markupCents: t.markupCents + r.markupCents,
    }),
    { unitsSold: 0, netEarningsCents: 0, markupCents: 0 }
  )

  return { days, rows, totals }
}

export { COUNTABLE_STATUSES as AFFILIATE_MARGIN_ANALYTICS_ORDER_STATUSES }
