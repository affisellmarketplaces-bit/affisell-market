/** Default markup when affiliate has not set a selling price yet (swipe feed + quick list). */
export const DEFAULT_AFFILIATE_CATALOG_MARKUP_RATE = 0.3

export type AffiliateCatalogEconomicsOptions = {
  markupRate?: number
  /** When the affiliate already has a listing, use their configured selling price. */
  listedSellingPriceCents?: number | null
}

export function listedSellingPriceFromAffiliateProducts(
  affiliateProducts?: Array<{ sellingPriceCents?: number | null }>
): number | null {
  const cents = affiliateProducts?.[0]?.sellingPriceCents
  if (typeof cents !== "number" || !Number.isFinite(cents) || cents <= 0) return null
  return Math.round(cents)
}

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

/** Retail markup margin at client selling price. */
export function estimateMarkupMarginCents(
  basePriceCents: number,
  clientPriceCents: number
): number {
  return Math.max(0, Math.round(clientPriceCents) - Math.round(basePriceCents))
}

/** Commission + markup — headline reseller earnings for catalog cards and high-margin sort. */
export function estimateTotalPartnerGainCents(
  basePriceCents: number,
  commissionRate: number,
  options?: AffiliateCatalogEconomicsOptions
): number {
  const economics = buildAffiliateCatalogCardEconomics(basePriceCents, commissionRate, options)
  return economics.totalPartnerGainCents
}

export type AffiliateCatalogCardEconomics = {
  supplierPriceCents: number
  clientPriceCents: number
  usesListedPrice: boolean
  markupMarginCents: number
  commissionRatePct: number
  commissionCents: number
  totalPartnerGainCents: number
  suggestedMarkupRate: number
  /** @deprecated use clientPriceCents */
  suggestedSellingPriceCents: number
}

export function buildAffiliateCatalogCardEconomics(
  basePriceCents: number,
  commissionRate: number,
  options?: AffiliateCatalogEconomicsOptions
): AffiliateCatalogCardEconomics {
  const markupRate = options?.markupRate ?? DEFAULT_AFFILIATE_CATALOG_MARKUP_RATE
  const listedRaw = options?.listedSellingPriceCents
  const listed =
    typeof listedRaw === "number" && Number.isFinite(listedRaw) && listedRaw > 0
      ? Math.round(listedRaw)
      : null
  const usesListedPrice = listed != null
  const clientPrice = listed ?? suggestedSellingPriceCents(basePriceCents, markupRate)
  const commissionCents = estimateSupplierCommissionCents(basePriceCents, commissionRate)
  const markupMarginCents = estimateMarkupMarginCents(basePriceCents, clientPrice)
  const effectiveMarkupRate = usesListedPrice
    ? basePriceCents > 0
      ? (clientPrice - basePriceCents) / basePriceCents
      : 0
    : markupRate

  return {
    supplierPriceCents: basePriceCents,
    clientPriceCents: clientPrice,
    usesListedPrice,
    markupMarginCents,
    commissionRatePct: Math.round(Number(commissionRate) || 0),
    commissionCents,
    totalPartnerGainCents: commissionCents + markupMarginCents,
    suggestedMarkupRate: effectiveMarkupRate,
    suggestedSellingPriceCents: clientPrice,
  }
}

/** Build economics from a discover catalog row. */
export function buildAffiliateCatalogCardEconomicsFromProduct(product: {
  basePriceCents: number
  commissionRate: number
  affiliateProducts?: Array<{ sellingPriceCents?: number | null }>
}): AffiliateCatalogCardEconomics {
  return buildAffiliateCatalogCardEconomics(product.basePriceCents, product.commissionRate, {
    listedSellingPriceCents: listedSellingPriceFromAffiliateProducts(product.affiliateProducts),
  })
}
