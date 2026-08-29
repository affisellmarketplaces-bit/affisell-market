import type Stripe from "stripe"

import { phase1AffiliateMarginRetainedCents } from "@/lib/marketplace-phase1-fees"
import {
  deriveAffiliateCommissionCentsFromOrder,
  deriveAffiliateListingMarginGrossCents,
} from "@/lib/marketplace-order-partner-amounts"
import {
  buildPhase1FeesForOrderLine,
  netSupplierPayoutCents,
  resolveOrderUsesAffisellAutoBuy,
} from "@/lib/marketplace-supplier-fee"
import { getStripeClient } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

function sessionCustomerId(session: Stripe.Checkout.Session): string | null {
  const c = session.customer
  if (typeof c === "string" && c.trim()) return c.trim()
  if (c && typeof c === "object" && "id" in c && typeof c.id === "string") return c.id
  return null
}

function inferTaxRate(subtotalCents: number, taxCents: number): number | null {
  if (subtotalCents <= 0 || taxCents <= 0) return null
  return Math.round((taxCents / subtotalCents) * 10_000) / 10_000
}

async function orderIdsForStripeSession(sessionId: string): Promise<string[]> {
  const orders = await prisma.order.findMany({
    where: {
      OR: [{ stripeSessionId: sessionId }, { stripeSessionId: { startsWith: `${sessionId}:line:` } }],
    },
    select: { id: true, subtotalCents: true, sellingPriceCents: true },
  })
  return orders.map((o) => o.id)
}

/**
 * After checkout.session.completed + fulfill: persist HT/TVA/TTC from Stripe Tax on each order row.
 * Affisell fee = % of line HT (supplier + affiliate uplift), never on VAT.
 */
export async function syncOrderVatFromCheckoutSession(
  sessionId: string
): Promise<{ updatedOrderIds: string[] }> {
  const stripe = getStripeClient()
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["total_details.breakdown", "line_items"],
  })

  const metaOrderId = session.metadata?.orderId?.trim()
  const orderIds = metaOrderId ? [metaOrderId] : await orderIdsForStripeSession(sessionId)

  if (orderIds.length === 0) return { updatedOrderIds: [] }

  const sessionSubtotal = session.amount_subtotal ?? 0
  const sessionTax = session.total_details?.amount_tax ?? 0
  const sessionTotal = session.amount_total ?? 0
  const ship = session as Stripe.Checkout.Session & {
    shipping_details?: { address?: { country?: string | null } | null } | null
  }
  const taxCountry =
    session.customer_details?.address?.country?.trim() ||
    ship.shipping_details?.address?.country?.trim() ||
    null
  const stripeCustomerId = sessionCustomerId(session)
  const sessionTaxRate = inferTaxRate(sessionSubtotal, sessionTax)

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: {
      id: true,
      sellingPriceCents: true,
      subtotalCents: true,
      affisellCommissionRateBps: true,
      supplierPriceCents: true,
      basePriceCents: true,
      commissionCents: true,
      affiliatePayoutCents: true,
      affiliateMarginCents: true,
      affiliateMarginRetainedCents: true,
      supplierCommissionRateBps: true,
      aeWholesaleCents: true,
      usesAffisellAutoBuy: true,
      supplierFeeCents: true,
      affiliateFeeCents: true,
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
    },
  })
  const weightSum = orders.reduce(
    (s, o) => s + Math.max(0, o.subtotalCents ?? o.sellingPriceCents),
    0
  )

  const updatedOrderIds: string[] = []

  for (const order of orders) {
    const weight =
      weightSum > 0
        ? Math.max(0, order.subtotalCents ?? order.sellingPriceCents) / weightSum
        : 1 / Math.max(1, orders.length)

    const subtotalCents = Math.round(sessionSubtotal * weight)
    const taxCents = Math.round(sessionTax * weight)
    const totalCents = Math.round(sessionTotal * weight)

    const supplierPriceCents = Math.max(
      0,
      Math.round(order.supplierPriceCents ?? order.basePriceCents)
    )
    const affiliateCommissionCents = deriveAffiliateCommissionCentsFromOrder({
      commissionCents: order.commissionCents ?? 0,
      affiliatePayoutCents: order.affiliatePayoutCents ?? 0,
      supplierPriceCents: order.supplierPriceCents,
      basePriceCents: order.basePriceCents,
      supplierCommissionRateBps: order.supplierCommissionRateBps,
      affiliateMarginRetainedCents: order.affiliateMarginRetainedCents,
      affiliateMarginCents: order.affiliateMarginCents,
      affiliateFeeCents: order.affiliateFeeCents,
      sellingPriceCents: order.sellingPriceCents,
      subtotalCents: order.subtotalCents,
    })
    const unitListingMargin = deriveAffiliateListingMarginGrossCents(order)

    const usesAffisellAutoBuy = resolveOrderUsesAffisellAutoBuy({
      usesAffisellAutoBuy: order.usesAffisellAutoBuy,
      supplierLink: order.product.supplierLink,
      productAutoBuyEnabled: order.product.autoBuyEnabled,
    })

    const grossAffiliateMarkupCents =
      unitListingMargin > 0
        ? unitListingMargin
        : Math.max(0, subtotalCents - supplierPriceCents - affiliateCommissionCents)

    const phase1Fees = buildPhase1FeesForOrderLine({
      usesAffisellAutoBuy,
      supplier: order.product.supplier,
      supplierPriceCents,
      aeWholesaleCents: order.aeWholesaleCents,
      affiliateCommissionCents,
      affiliateMarginRetainedCents: grossAffiliateMarkupCents,
      affiliatePlatformFeeBps: order.affiliate.affiliatePlatformFeeBps,
    })

    const affiliateMarginRetainedCents = phase1AffiliateMarginRetainedCents({
      clientLineHtCents: subtotalCents,
      supplierPriceCents,
      affiliateCommissionCents,
      affiliateFeeCents: phase1Fees.affiliateFeeCents,
      fixedListingMarginCents: unitListingMargin > 0 ? unitListingMargin : undefined,
    })

    const supplierPayoutCents = netSupplierPayoutCents({
      supplierPriceCents,
      affiliateCommissionCents,
      supplierFeeCents: phase1Fees.supplierFeeCents,
    })

    await prisma.order.update({
      where: { id: order.id },
      data: {
        subtotalCents,
        taxCents,
        totalCents,
        sellingPriceCents: subtotalCents,
        commissionCents: affiliateCommissionCents,
        affiliatePayoutCents: affiliateCommissionCents,
        affisellFeeCents: phase1Fees.affisellFeeTotalCents,
        supplierFeeCents: phase1Fees.supplierFeeCents,
        affiliateFeeCents: phase1Fees.affiliateFeeCents,
        supplierPayoutCents,
        usesAffisellAutoBuy,
        affiliateMarginRetainedCents,
        taxCountry,
        taxRate: sessionTaxRate,
        stripeCustomerId,
      },
    })
    updatedOrderIds.push(order.id)
  }

  if (updatedOrderIds.length > 0) {
    const { healMarketplaceOrderNotifications } = await import(
      "@/lib/marketplace-order-notification-heal"
    )
    for (const orderId of updatedOrderIds) {
      void healMarketplaceOrderNotifications(orderId)
    }
  }

  return { updatedOrderIds }
}
