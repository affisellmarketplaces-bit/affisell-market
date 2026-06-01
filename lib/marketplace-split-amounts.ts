import { netAffiliateTransferCents } from "@/lib/marketplace-phase1-fees"
import {
  resolveSupplierPayoutCentsFromOrder,
  type MarketplaceOrderSettlement,
} from "@/lib/marketplace-order-settlement"

export type OrderSplitInput = {
  basePriceCents: number
  sellingPriceCents: number
  affiliatePayoutCents: number
  affiliateMarginRetainedCents: number
  affisellFeeCents: number
  affiliateFeeCents?: number | null
  supplierPriceCents: number
  affiliateMarginCents: number
  supplierCommissionRateBps: number
  affisellCommissionRateBps: number
  supplierPayoutCents?: number
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
 * Supplier: net wholesale (catalog − commission offered to affiliate).
 * Affiliate: commission + markup minus affiliate-side platform fee when applicable.
 * Affisell: supplier + affiliate platform fees (stored on order; not a Connect transfer).
 */
export function computeTransferAmountsFromOrder(order: OrderSplitInput): MarketplaceTransferAmounts {
  const lineTotalCents = Math.max(0, Math.round(order.sellingPriceCents))
  const stripeFeeCents = estimateStripeFeeCents(lineTotalCents)

  const supplierPayoutCents = resolveSupplierPayoutCentsFromOrder(order)
  const affiliateTransferCents = netAffiliateTransferCents({
    affiliatePayoutCents: order.affiliatePayoutCents,
    affiliateMarginRetainedCents: order.affiliateMarginRetainedCents,
    affiliateFeeCents: order.affiliateFeeCents,
    affiliateMarginCents: order.affiliateMarginCents,
  })
  const affisellFeeCents = Math.max(0, Math.round(order.affisellFeeCents))

  return {
    lineTotalCents,
    supplierPayoutCents,
    affiliateTransferCents,
    affisellFeeCents,
    stripeFeeCents,
  }
}

/** Build transfer amounts from a fresh settlement snapshot. */
export function computeTransferAmountsFromSettlement(
  settlement: MarketplaceOrderSettlement,
  stripeLineTotalCents?: number
): MarketplaceTransferAmounts {
  const lineTotalCents = Math.max(
    0,
    Math.round(stripeLineTotalCents ?? settlement.sellingPriceCents)
  )
  return {
    lineTotalCents,
    supplierPayoutCents: settlement.supplierNetCents,
    affiliateTransferCents:
      settlement.affiliateCommissionCents + settlement.affiliateMarginRetainedCents,
    affisellFeeCents: settlement.affisellFeeCents,
    stripeFeeCents: estimateStripeFeeCents(lineTotalCents),
  }
}
