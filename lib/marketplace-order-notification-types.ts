/** Order money fields used to build affiliate NEW_SALE alert copy + UI breakdown. */
export type AffiliateSaleOrderAmounts = {
  subtotalCents?: number | null
  sellingPriceCents: number
  totalCents?: number | null
  taxCents?: number | null
  supplierPriceCents?: number | null
  basePriceCents: number
  marginCents: number
  affisellFeeCents: number
  commissionCents: number
  affiliatePayoutCents: number
  affiliateMarginRetainedCents?: number | null
  affiliateFeeCents: number
  supplierPayoutCents: number
  affiliateMarginCents?: number | null
  supplierCommissionRateBps?: number | null
}
