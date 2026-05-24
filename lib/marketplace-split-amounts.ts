import { calculateThreeWaySplit } from "@/lib/marketplace-order-settlement"

export type OrderSplitInput = {
  basePriceCents: number
  sellingPriceCents: number
  affiliatePayoutCents: number
  affiliateMarginRetainedCents: number
  affisellFeeCents: number
  supplierPriceCents: number
  affiliateMarginCents: number
  supplierCommissionRateBps: number
  affisellCommissionRateBps: number
}

export type MarketplaceTransferAmounts = {
  lineTotalCents: number
  supplierPayoutCents: number
  /** Total Connect transfer to affiliate (commission + markup). */
  affiliateTransferCents: number
  affisellFeeCents: number
  stripeFeeCents: number
}

function estimateStripeFeeCents(lineTotalCents: number): number {
  return Math.round(lineTotalCents * 0.029 + 25)
}

/**
 * Supplier: wholesale (base price).
 * Affiliate: supplier commission share + margin retained.
 * Affisell: platform fee (stays on platform balance; not a Connect transfer).
 */
export function computeTransferAmountsFromOrder(order: OrderSplitInput): MarketplaceTransferAmounts {
  const lineTotalCents = Math.max(0, Math.round(order.sellingPriceCents))
  const stripeFeeCents = estimateStripeFeeCents(lineTotalCents)

  if (order.basePriceCents > 0) {
    const supplierPayoutCents = Math.max(0, Math.round(order.basePriceCents))
    const affiliateTransferCents = Math.max(
      0,
      Math.round(order.affiliatePayoutCents + order.affiliateMarginRetainedCents)
    )
    const affisellFeeCents = Math.max(0, Math.round(order.affisellFeeCents))

    return {
      lineTotalCents,
      supplierPayoutCents,
      affiliateTransferCents,
      affisellFeeCents,
      stripeFeeCents,
    }
  }

  if (order.supplierPriceCents > 0) {
    const split = calculateThreeWaySplit({
      supplierPriceCents: order.supplierPriceCents,
      supplierCommissionRateBps: order.supplierCommissionRateBps,
      affiliateMarginCents: order.affiliateMarginCents,
      affisellCommissionRateBps: order.affisellCommissionRateBps,
      stripeFeeCents,
    })
    return {
      lineTotalCents: Math.max(lineTotalCents, split.priceClientCents),
      supplierPayoutCents: split.supplierPayoutCents,
      affiliateTransferCents: split.affiliatePayoutCents,
      affisellFeeCents: split.affisellFeeCents,
      stripeFeeCents,
    }
  }

  return {
    lineTotalCents,
    supplierPayoutCents: 0,
    affiliateTransferCents: 0,
    affisellFeeCents: 0,
    stripeFeeCents,
  }
}
