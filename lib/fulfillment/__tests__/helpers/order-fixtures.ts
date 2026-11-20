/**
 * Order rows for the purchase-gate tests. The MONEY fields are produced by the REAL settlement functions the checkout uses
 * (`lib/stripe-marketplace-fulfill.ts` → `computeMarketplaceOrderSettlement`, `buildPhase1FeesForOrderLine`,
 * `netSupplierPayoutCents`), never typed by hand — so a test cannot drift from the production money model.
 */

import { computeMarketplaceOrderSettlement } from "@/lib/marketplace-order-settlement"
import { buildPhase1FeesForOrderLine, netSupplierPayoutCents } from "@/lib/marketplace-supplier-fee"

import type { FakeOrder } from "./fake-purchase-db"

export type SaleInput = {
  /** Supplier catalogue wholesale for the whole line (HT). */
  wholesaleCents: number
  /** Reseller fixed markup for the whole line (HT). */
  markupCents: number
  quantity?: number
  /** Supplier → reseller commission, bps of the wholesale. */
  commissionBps?: number
  /** Affisell category commission, bps. */
  categoryBps?: number
  /** AE unit price the platform will pay (cents). */
  aeUnitPriceCents: number
  aeShippingCents?: number
  taxCents?: number
}

export function orderMoney(sale: SaleInput) {
  const quantity = sale.quantity ?? 1
  const commissionBps = sale.commissionBps ?? 1000
  const categoryBps = sale.categoryBps ?? 1000
  const lineHt = sale.wholesaleCents + sale.markupCents
  const tax = sale.taxCents ?? 0
  const aeWholesaleCents = sale.aeUnitPriceCents * quantity

  const settlement = computeMarketplaceOrderSettlement({
    sellingPriceCents: lineHt,
    supplierPriceCents: sale.wholesaleCents,
    supplierCommissionRateBps: commissionBps,
    affiliateMarginCents: sale.markupCents,
    affisellCommissionRateBps: categoryBps,
    affisellFeeBaseCents: lineHt,
  })
  const fees = buildPhase1FeesForOrderLine({
    usesAffisellAutoBuy: true,
    supplier: {},
    supplierPriceCents: sale.wholesaleCents,
    aeWholesaleCents,
    affiliateCommissionCents: settlement.affiliateCommissionCents,
    affiliateMarginRetainedCents: sale.markupCents,
    affiliatePlatformFeeBps: null,
    categoryFeeBps: categoryBps,
  })
  const supplierNet = netSupplierPayoutCents({
    supplierPriceCents: sale.wholesaleCents,
    affiliateCommissionCents: settlement.affiliateCommissionCents,
    supplierFeeCents: fees.supplierFeeCents,
  })

  return {
    quantity,
    basePriceCents: sale.wholesaleCents,
    sellingPriceCents: settlement.sellingPriceCents,
    subtotalCents: lineHt,
    taxCents: tax,
    totalCents: lineHt + tax,
    commissionCents: settlement.affiliateCommissionCents,
    affiliatePayoutCents: settlement.affiliateCommissionCents,
    affiliateMarginRetainedCents: sale.markupCents,
    affiliateMarginCents: sale.markupCents,
    affisellFeeCents: fees.affisellFeeTotalCents,
    supplierFeeCents: fees.supplierFeeCents,
    affiliateFeeCents: fees.affiliateFeeCents,
    usesAffisellAutoBuy: true,
    aeWholesaleCents,
    supplierPriceCents: sale.wholesaleCents,
    supplierCommissionRateBps: commissionBps,
    affisellCommissionRateBps: categoryBps,
    supplierPayoutCents: supplierNet,
    // handy for assertions
    _fees: fees,
    _supplierNet: supplierNet,
  }
}

/** Profitable under the default floor: platform fees (≈ 1 440 c) comfortably exceed Stripe (≈ 286 c) + AE cost (600 c). */
export const PROFITABLE_SALE: SaleInput = {
  wholesaleCents: 3000,
  markupCents: 6000,
  aeUnitPriceCents: 500,
  aeShippingCents: 100,
}

/** Loss-making: the AE cost exceeds what Affisell keeps of the sale. */
export const LOSS_MAKING_SALE: SaleInput = {
  wholesaleCents: 3000,
  markupCents: 500,
  aeUnitPriceCents: 2500,
  aeShippingCents: 300,
}

export function makeFakeOrder(
  id: string,
  sale: SaleInput = PROFITABLE_SALE,
  overrides: Record<string, unknown> = {}
): FakeOrder {
  const { _fees: _f, _supplierNet: _s, ...money } = orderMoney(sale)
  return {
    id,
    status: "paid",
    supplierOrderId: null,
    fulfillmentStatus: "PENDING",
    fulfillmentErrors: null,
    variantLabel: null,
    supplierPreparingAt: null,
    shippingAddress: {
      name: "Test Buyer",
      line1: "1 rue de la Paix",
      city: "Paris",
      postal_code: "75001",
      country: "FR",
      phone: "33612345678",
    },
    ...money,
    product: {
      id: `prod_${id}`,
      autoBuyEnabled: true,
      autoFulfill: true,
      sourceUrl: null,
      supplierSku: null,
      supplierWholesaleCents: null,
      variantMapping: null,
      productVariants: [],
      supplierLink: {
        isActive: true,
        autoBuyEnabled: true,
        aeProductId: "1005007291234567",
        aeSkuId: "12000012345678901",
        aeUrl: "https://www.aliexpress.com/item/1005007291234567.html",
        aePriceCents: sale.aeUnitPriceCents,
        aeShippingCents: sale.aeShippingCents ?? 0,
        variantMappings: [],
      },
    },
    ...overrides,
  }
}
