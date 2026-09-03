import "server-only"

import type { Prisma } from "@prisma/client"

import {
  deriveAffiliateListingMarginGrossCents,
  orderPartnerAmountsIncomplete,
} from "@/lib/marketplace-order-partner-amounts"
import {
  affisellFeeBaseCentsFromOrder,
  computeMarketplaceOrderSettlement,
} from "@/lib/marketplace-order-settlement"
import {
  buildPhase1FeesForOrderLine,
  netSupplierPayoutCents,
} from "@/lib/marketplace-supplier-fee"
import { phase1AffiliateMarginRetainedCents } from "@/lib/marketplace-phase1-fees"
import { prisma } from "@/lib/prisma"

const orderForReconcileSelect = {
  id: true,
  status: true,
  quantity: true,
  sellingPriceCents: true,
  subtotalCents: true,
  taxCents: true,
  totalCents: true,
  supplierPriceCents: true,
  basePriceCents: true,
  marginCents: true,
  commissionCents: true,
  affiliatePayoutCents: true,
  affiliateMarginRetainedCents: true,
  affiliateMarginCents: true,
  affiliateFeeCents: true,
  affisellFeeCents: true,
  supplierFeeCents: true,
  supplierPayoutCents: true,
  supplierCommissionRateBps: true,
  affisellCommissionRateBps: true,
  usesAffisellAutoBuy: true,
  aeWholesaleCents: true,
  product: {
    select: {
      autoBuyEnabled: true,
      supplier: {
        select: {
          supplierFeeBps: true,
          supplierFeeBpsCatalog: true,
          supplierFeeBpsAutoBuy: true,
        },
      },
      supplierLink: {
        select: { isActive: true, autoBuyEnabled: true },
      },
    },
  },
  affiliate: { select: { affiliatePlatformFeeBps: true } },
} satisfies Prisma.OrderSelect

type OrderForReconcile = Prisma.OrderGetPayload<{ select: typeof orderForReconcileSelect }>

export type ReconcileMarketplaceOrderPartnerAmountsResult = {
  reconciled: boolean
  orderId: string
}

function computeReconciledPartnerAmounts(order: OrderForReconcile) {
  const clientLineHtCents = affisellFeeBaseCentsFromOrder(order)
  const supplierPriceCents = Math.max(
    0,
    Math.round(order.supplierPriceCents ?? order.basePriceCents)
  )
  const listingMarginLine = deriveAffiliateListingMarginGrossCents(order)
  const fixedListingMargin =
    listingMarginLine > 0 ? Math.round(listingMarginLine) : undefined

  const settlement = computeMarketplaceOrderSettlement({
    sellingPriceCents: clientLineHtCents,
    supplierPriceCents,
    supplierCommissionRateBps: Math.max(0, order.supplierCommissionRateBps ?? 0),
    affiliateMarginCents: fixedListingMargin,
    affisellCommissionRateBps: order.affisellCommissionRateBps ?? undefined,
    affisellFeeBaseCents: clientLineHtCents,
  })

  const usesAffisellAutoBuy = order.usesAffisellAutoBuy ?? false
  const grossMarkup =
    fixedListingMargin ??
    Math.max(0, clientLineHtCents - supplierPriceCents - settlement.affiliateCommissionCents)

  const phase1Fees = buildPhase1FeesForOrderLine({
    usesAffisellAutoBuy,
    supplier: order.product.supplier,
    supplierPriceCents,
    aeWholesaleCents: order.aeWholesaleCents,
    affiliateCommissionCents: settlement.affiliateCommissionCents,
    affiliateMarginRetainedCents: grossMarkup,
    affiliatePlatformFeeBps: order.affiliate.affiliatePlatformFeeBps,
  })

  const affiliateMarginRetainedCents = phase1AffiliateMarginRetainedCents({
    clientLineHtCents,
    supplierPriceCents,
    affiliateCommissionCents: settlement.affiliateCommissionCents,
    affiliateFeeCents: phase1Fees.affiliateFeeCents,
    fixedListingMarginCents: fixedListingMargin,
  })

  const supplierPayoutCents = netSupplierPayoutCents({
    supplierPriceCents,
    affiliateCommissionCents: settlement.affiliateCommissionCents,
    supplierFeeCents: phase1Fees.supplierFeeCents,
  })

  return {
    subtotalCents: clientLineHtCents,
    sellingPriceCents: clientLineHtCents,
    marginCents: settlement.marginCents,
    commissionCents: settlement.affiliateCommissionCents,
    affiliatePayoutCents: settlement.affiliateCommissionCents,
    affiliateMarginRetainedCents,
    affiliateFeeCents: phase1Fees.affiliateFeeCents,
    affisellFeeCents: phase1Fees.affisellFeeTotalCents,
    supplierFeeCents: phase1Fees.supplierFeeCents,
    supplierPayoutCents,
    affiliateMarginCents:
      fixedListingMargin != null ? fixedListingMargin : order.affiliateMarginCents,
    usesAffisellAutoBuy,
  }
}

/** Idempotent heal: persist affiliate/supplier split when checkout left payout legs at zero. */
export async function reconcileMarketplaceOrderPartnerAmounts(
  orderId: string
): Promise<ReconcileMarketplaceOrderPartnerAmountsResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: orderForReconcileSelect,
  })

  if (!order) {
    return { reconciled: false, orderId }
  }

  if (
    !orderPartnerAmountsIncomplete({
      commissionCents: order.commissionCents,
      affiliatePayoutCents: order.affiliatePayoutCents,
      supplierPriceCents: order.supplierPriceCents,
      basePriceCents: order.basePriceCents,
      supplierCommissionRateBps: order.supplierCommissionRateBps,
      affiliateMarginRetainedCents: order.affiliateMarginRetainedCents,
      affiliateMarginCents: order.affiliateMarginCents,
      affiliateFeeCents: order.affiliateFeeCents,
      sellingPriceCents: order.sellingPriceCents,
      subtotalCents: order.subtotalCents,
    })
  ) {
    return { reconciled: false, orderId }
  }

  const next = computeReconciledPartnerAmounts(order)

  await prisma.order.update({
    where: { id: orderId },
    data: next,
  })

  console.log("[marketplace-order-settlement-reconcile]", {
    orderId,
    affiliatePayoutCents: next.affiliatePayoutCents,
    affiliateMarginRetainedCents: next.affiliateMarginRetainedCents,
    affiliateFeeCents: next.affiliateFeeCents,
    supplierPayoutCents: next.supplierPayoutCents,
    result: "reconciled",
  })

  return { reconciled: true, orderId }
}

/** @internal — exported for unit tests */
export function previewReconciledPartnerAmounts(order: OrderForReconcile) {
  return computeReconciledPartnerAmounts(order)
}
