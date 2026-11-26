import type Stripe from "stripe"

import { resolveLineMarkupCents } from "@/lib/money/sale-split"
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
import { isOrderClosedForPayout } from "@/lib/orders/payment-state"
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

/** Number of lines of a cart checkout (`cartLines` metadata), `null` for a session that is not a cart. */
function cartLineCount(session: Stripe.Checkout.Session): number | null {
  const raw = session.metadata?.cartLines?.trim()
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.length : null
  } catch {
    return null
  }
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

  const foundOrders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: {
      id: true,
      status: true,
      paymentSettlementStatus: true,
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
  // A closed order (cancelled / refunded — e.g. the skeleton of a line that could not be served) is not a sale: it takes no share.
  const orders = foundOrders.filter((o) => !isOrderClosedForPayout(o))
  const weightSum = orders.reduce(
    (s, o) => s + Math.max(0, o.subtotalCents ?? o.sellingPriceCents),
    0
  )
  // Normally the orders of a cart add up to the whole session, so each takes `its subtotal / their sum` of the session
  // amounts. When a paid line produced NO order (D6 / G1: unallocated) they add up to LESS: dividing by their own sum
  // would hand the missing line's HT, VAT and total to the survivors (the order would then show 50 HT for a 30 HT line
  // and every refund figure derived from it would be wrong). Each order keeps ITS share of the whole session instead.
  const expectedLines = cartLineCount(session)
  const linesMissing = expectedLines != null && orders.length < expectedLines
  const weightBase = linesMissing ? Math.max(sessionSubtotal, weightSum) : weightSum

  const updatedOrderIds: string[] = []

  for (const order of orders) {
    const weight =
      weightBase > 0
        ? Math.max(0, order.subtotalCents ?? order.sellingPriceCents) / weightBase
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

    const grossAffiliateMarkupCents = resolveLineMarkupCents({
      collectedHtCents: subtotalCents,
      wholesaleCents: supplierPriceCents,
      fixedListingMarginCents: unitListingMargin,
    })

    const phase1Fees = buildPhase1FeesForOrderLine({
      usesAffisellAutoBuy,
      supplier: order.product.supplier,
      supplierPriceCents,
      aeWholesaleCents: order.aeWholesaleCents,
      affiliateCommissionCents,
      affiliateMarginRetainedCents: grossAffiliateMarkupCents,
      affiliatePlatformFeeBps: order.affiliate.affiliatePlatformFeeBps,
      categoryFeeBps: order.affisellCommissionRateBps,
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
