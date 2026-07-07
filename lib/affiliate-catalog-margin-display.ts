/** Default markup when affiliate has not set a selling price yet (swipe feed + quick list). */
export const DEFAULT_AFFILIATE_CATALOG_MARKUP_RATE = 0.3

export function suggestedSellingPriceCents(
  basePriceCents: number,
  markupRate: number = DEFAULT_AFFILIATE_CATALOG_MARKUP_RATE
): number {
  const rate =
    Number.isFinite(markupRate) && markupRate >= 0
      ? markupRate
      : DEFAULT_AFFILIATE_CATALOG_MARKUP_RATE
  return Math.max(basePriceCents, Math.round(basePriceCents * (1 + rate)))
}

/** Supplier commission on wholesale (HT), frozen at fulfillment. */
export function estimateSupplierCommissionCents(
  basePriceCents: number,
  commissionRate: number
): number {
  const pct = Number(commissionRate) || 0
  return Math.max(0, Math.round((basePriceCents * pct) / 100))
}

/** Retail markup margin at suggested selling price. */
export function estimateMarkupMarginCents(
  basePriceCents: number,
  markupRate: number = DEFAULT_AFFILIATE_CATALOG_MARKUP_RATE
): number {
  return Math.max(0, suggestedSellingPriceCents(basePriceCents, markupRate) - basePriceCents)
}

/** Commission + markup — headline "partner gain" for catalog cards and high-margin sort. */
export function estimateTotalPartnerGainCents(
  basePriceCents: number,
  commissionRate: number,
  markupRate: number = DEFAULT_AFFILIATE_CATALOG_MARKUP_RATE
): number {
  return (
    estimateSupplierCommissionCents(basePriceCents, commissionRate) +
    estimateMarkupMarginCents(basePriceCents, markupRate)
  )
}

export type AffiliateCatalogCardEconomics = {
  supplierPriceCents: number
  suggestedSellingPriceCents: number
  markupMarginCents: number
  commissionRatePct: number
  commissionCents: number
  totalPartnerGainCents: number
  suggestedMarkupRate: number
}

export function buildAffiliateCatalogCardEconomics(
  basePriceCents: number,
  commissionRate: number,
  markupRate: number = DEFAULT_AFFILIATE_CATALOG_MARKUP_RATE
): AffiliateCatalogCardEconomics {
  const suggestedSellingPrice = suggestedSellingPriceCents(basePriceCents, markupRate)
  const commissionCents = estimateSupplierCommissionCents(basePriceCents, commissionRate)
  const markupMarginCents = Math.max(0, suggestedSellingPrice - basePriceCents)
  return {
    supplierPriceCents: basePriceCents,
    suggestedSellingPriceCents: suggestedSellingPrice,
    markupMarginCents,
    commissionRatePct: Math.round(Number(commissionRate) || 0),
    commissionCents,
    totalPartnerGainCents: commissionCents + markupMarginCents,
    suggestedMarkupRate: markupRate,
  }
}
