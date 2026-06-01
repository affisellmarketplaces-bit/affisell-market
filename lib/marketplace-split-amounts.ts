import { netAffiliateTransferCents } from "@/lib/marketplace-phase1-fees"
import {
  resolveSupplierPayoutCentsFromOrder,
  type MarketplaceOrderSettlement,
} from "@/lib/marketplace-order-settlement"
import type { ResolveOrderSupplierSettlementInput } from "@/lib/marketplace-supplier-fee"

export type OrderSplitInput = ResolveOrderSupplierSettlementInput & {
  sellingPriceCents: number
  affiliateMarginRetainedCents: number
  affisellFeeCents: number
  affiliateFeeCents?: number | null
  affiliateMarginCents: number
  affisellCommissionRateBps: number
}

export type MarketplaceTransferAmounts = {
  lineTotalCents: number
  supplierPayoutCents: number
  /** Connect transfer to affiliate (net of platform fee when listing margin fixed). */
  affiliateTransferCents: number
  affisellFeeCents: number
  supplierFeeCents: number
  affiliateFeeCents: number
  stripeFeeCents: number
}

function estimateStripeFeeCents(lineTotalCents: number): number {
  return Math.round(lineTotalCents * 0.029 + 25)
}

/** Map persisted Order row → split input (catalog vs auto-buy fees). */
export function orderSplitInputFromOrder(order: {
  basePriceCents: number
  sellingPriceCents: number
  subtotalCents?: number | null
  affiliatePayoutCents: number
  affiliateMarginRetainedCents: number
  affisellFeeCents: number
  affiliateFeeCents?: number | null
  supplierFeeCents?: number | null
  usesAffisellAutoBuy?: boolean | null
  aeWholesaleCents?: number | null
  supplierPriceCents: number
  affiliateMarginCents: number
  supplierCommissionRateBps: number
  affisellCommissionRateBps: number
  supplierPayoutCents?: number | null
}): OrderSplitInput {
  return {
    basePriceCents: order.basePriceCents,
    sellingPriceCents: order.sellingPriceCents,
    affiliatePayoutCents: order.affiliatePayoutCents,
    affiliateMarginRetainedCents: order.affiliateMarginRetainedCents,
    affisellFeeCents: order.affisellFeeCents,
    affiliateFeeCents: order.affiliateFeeCents,
    supplierFeeCents: order.supplierFeeCents,
    usesAffisellAutoBuy: order.usesAffisellAutoBuy,
    aeWholesaleCents: order.aeWholesaleCents,
    supplierPriceCents: order.supplierPriceCents,
    affiliateMarginCents: order.affiliateMarginCents,
    supplierCommissionRateBps: order.supplierCommissionRateBps,
    affisellCommissionRateBps: order.affisellCommissionRateBps,
    supplierPayoutCents: order.supplierPayoutCents,
  }
}

/**
 * Phase-1 coherence: HT line ≈ supplier net + affiliate net + platform fees (supplier + affiliate).
 * Logs when drift exceeds tolerance (rounding / legacy rows).
 */
export function phase1SplitDriftCents(args: {
  subtotalCents: number
  supplierPayoutCents: number
  affiliateTransferCents: number
  supplierFeeCents: number
  affiliateFeeCents: number
}): number {
  const allocated =
    args.supplierPayoutCents +
    args.affiliateTransferCents +
    args.supplierFeeCents +
    args.affiliateFeeCents
  return Math.abs(Math.round(args.subtotalCents) - allocated)
}

export function logPhase1SplitCheck(
  orderId: string,
  args: Parameters<typeof phase1SplitDriftCents>[0] & { usesAffisellAutoBuy?: boolean }
): void {
  const drift = phase1SplitDriftCents(args)
  if (drift > 2) {
    console.warn("[marketplace-split]", {
      orderId,
      driftCents: drift,
      usesAffisellAutoBuy: args.usesAffisellAutoBuy,
      subtotalCents: args.subtotalCents,
      supplierPayoutCents: args.supplierPayoutCents,
      affiliateTransferCents: args.affiliateTransferCents,
      supplierFeeCents: args.supplierFeeCents,
      affiliateFeeCents: args.affiliateFeeCents,
    })
  }
}

/**
 * Supplier + affiliate Connect amounts from order snapshot (Phase 1 fees applied).
 * Affisell platform share stays on the platform balance (not transferred).
 */
export function computeTransferAmountsFromOrder(order: OrderSplitInput): MarketplaceTransferAmounts {
  const lineTotalCents = Math.max(
    0,
    Math.round(order.sellingPriceCents)
  )
  const stripeFeeCents = estimateStripeFeeCents(lineTotalCents)

  const supplierPayoutCents = resolveSupplierPayoutCentsFromOrder(order)
  const affiliateTransferCents = netAffiliateTransferCents({
    affiliatePayoutCents: order.affiliatePayoutCents ?? 0,
    affiliateMarginRetainedCents: order.affiliateMarginRetainedCents,
    affiliateFeeCents: order.affiliateFeeCents,
    affiliateMarginCents: order.affiliateMarginCents,
  })
  const supplierFeeCents = Math.max(0, Math.round(order.supplierFeeCents ?? 0))
  const affiliateFeeCents = Math.max(0, Math.round(order.affiliateFeeCents ?? 0))
  const affisellFeeCents = Math.max(0, Math.round(order.affisellFeeCents))

  return {
    lineTotalCents,
    supplierPayoutCents,
    affiliateTransferCents,
    affisellFeeCents,
    supplierFeeCents,
    affiliateFeeCents,
    stripeFeeCents,
  }
}

/** @deprecated Prefer computeTransferAmountsFromOrder with full order row + Phase 1 fees. */
export function computeTransferAmountsFromSettlement(
  settlement: MarketplaceOrderSettlement,
  fees: {
    supplierFeeCents: number
    affiliateFeeCents: number
    affiliateMarginCents?: number
  },
  stripeLineTotalCents?: number
): MarketplaceTransferAmounts {
  const lineTotalCents = Math.max(
    0,
    Math.round(stripeLineTotalCents ?? settlement.sellingPriceCents)
  )
  const supplierFeeCents = Math.max(0, fees.supplierFeeCents)
  const affiliateFeeCents = Math.max(0, fees.affiliateFeeCents)
  const supplierPayoutCents = Math.max(
    0,
    settlement.supplierNetCents - supplierFeeCents
  )
  const affiliateGross =
    settlement.affiliateCommissionCents + settlement.affiliateMarginRetainedCents
  const affiliateTransferCents =
    (fees.affiliateMarginCents ?? 0) > 0
      ? Math.max(0, affiliateGross - affiliateFeeCents)
      : affiliateGross

  return {
    lineTotalCents,
    supplierPayoutCents,
    affiliateTransferCents,
    affisellFeeCents: supplierFeeCents + affiliateFeeCents,
    supplierFeeCents,
    affiliateFeeCents,
    stripeFeeCents: estimateStripeFeeCents(lineTotalCents),
  }
}
