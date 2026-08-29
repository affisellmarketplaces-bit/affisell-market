import {
  DEFAULT_AFFILIATE_PLATFORM_FEE_BPS,
  netAffiliateTransferCents,
  phase1AffiliateMarginRetainedCents,
  resolveOrderAffiliateCommissionCents,
} from "@/lib/marketplace-phase1-fees"

/** Order snapshot fields for affiliate/supplier redistribution display + heal. */
export type OrderPartnerAmountsInput = {
  commissionCents: number
  affiliatePayoutCents: number
  supplierPriceCents?: number | null
  basePriceCents: number
  supplierCommissionRateBps?: number | null
  affiliateMarginRetainedCents?: number | null
  affiliateMarginCents?: number | null
  affiliateFeeCents?: number | null
  sellingPriceCents: number
  subtotalCents?: number | null
}

/** Commission leg — falls back to supplier wholesale × bps when payout row was never persisted. */
export function deriveAffiliateCommissionCentsFromOrder(
  order: OrderPartnerAmountsInput
): number {
  const fromRow = resolveOrderAffiliateCommissionCents({
    commissionCents: order.commissionCents,
    affiliatePayoutCents: order.affiliatePayoutCents,
  })
  if (fromRow > 0) return fromRow

  const bps = Math.max(0, Math.round(order.supplierCommissionRateBps ?? 0))
  const supplierPrice = Math.max(
    0,
    Math.round(order.supplierPriceCents ?? order.basePriceCents)
  )
  if (bps > 0 && supplierPrice > 0) {
    return Math.round((supplierPrice * bps) / 10_000)
  }
  return 0
}

export function deriveAffiliateListingMarginGrossCents(
  order: Pick<OrderPartnerAmountsInput, "affiliateMarginCents">
): number {
  return Math.max(0, Math.round(order.affiliateMarginCents ?? 0))
}

/** Markup leg — listing gross margin or residual HT − wholesale − commission. */
export function deriveAffiliateMarginRetainedCentsFromOrder(
  order: OrderPartnerAmountsInput,
  commissionCents: number
): number {
  const retained = Math.max(0, Math.round(order.affiliateMarginRetainedCents ?? 0))
  if (retained > 0) return retained

  const listingGross = deriveAffiliateListingMarginGrossCents(order)
  if (listingGross > 0) return listingGross

  const ht = Math.max(0, Math.round(order.subtotalCents ?? order.sellingPriceCents))
  const supplier = Math.max(
    0,
    Math.round(order.supplierPriceCents ?? order.basePriceCents)
  )
  return Math.max(0, ht - supplier - commissionCents)
}

/** Net Connect transfer — same formula as analytics + payout scheduler. */
export function deriveAffiliateNetTransferCentsFromOrder(
  order: OrderPartnerAmountsInput
): number {
  const commissionCents = deriveAffiliateCommissionCentsFromOrder(order)
  const listingGross = deriveAffiliateListingMarginGrossCents(order)
  const marginRetained = Math.max(0, Math.round(order.affiliateMarginRetainedCents ?? 0))

  return netAffiliateTransferCents({
    affiliatePayoutCents: commissionCents,
    affiliateMarginRetainedCents: marginRetained,
    affiliateFeeCents: order.affiliateFeeCents,
    affiliateMarginCents: listingGross,
  })
}

/** True when checkout left listing margin / bps on the row but forgot affiliate payout legs. */
export function orderPartnerAmountsIncomplete(order: OrderPartnerAmountsInput): boolean {
  const listingGross = deriveAffiliateListingMarginGrossCents(order)
  const derivedCommission = deriveAffiliateCommissionCentsFromOrder(order)
  if (listingGross === 0 && derivedCommission === 0) return false

  const storedCommission = resolveOrderAffiliateCommissionCents({
    commissionCents: order.commissionCents,
    affiliatePayoutCents: order.affiliatePayoutCents,
  })
  const storedRetained = Math.max(0, Math.round(order.affiliateMarginRetainedCents ?? 0))
  const storedFee = Math.max(0, Math.round(order.affiliateFeeCents ?? 0))

  if (storedCommission > 0 && storedRetained > 0) return false
  if (listingGross > 0 && storedRetained === 0) return true
  if (derivedCommission > 0 && storedCommission === 0) return true
  if ((storedCommission > 0 || listingGross > 0) && storedFee === 0 && derivedCommission + listingGross > 500) {
    return true
  }
  return false
}

/** Estimate affiliate platform fee when missing (display-only fallback). */
export function estimateAffiliatePlatformFeeCents(args: {
  commissionCents: number
  markupGrossCents: number
  affiliatePlatformFeeBps?: number | null
}): number {
  const gross = Math.max(0, args.commissionCents + args.markupGrossCents)
  if (gross <= 0) return 0
  const bps = args.affiliatePlatformFeeBps ?? DEFAULT_AFFILIATE_PLATFORM_FEE_BPS
  return Math.round((gross * Math.max(0, bps)) / 10_000)
}

/** Residual markup after Phase 1 fee when recomputing from HT line. */
export function derivePhase1MarginRetainedCents(args: {
  clientLineHtCents: number
  supplierPriceCents: number
  affiliateCommissionCents: number
  affiliateFeeCents: number
  fixedListingMarginCents?: number
}): number {
  return phase1AffiliateMarginRetainedCents({
    clientLineHtCents: args.clientLineHtCents,
    supplierPriceCents: args.supplierPriceCents,
    affiliateCommissionCents: args.affiliateCommissionCents,
    affiliateFeeCents: args.affiliateFeeCents,
    fixedListingMarginCents: args.fixedListingMarginCents,
  })
}
