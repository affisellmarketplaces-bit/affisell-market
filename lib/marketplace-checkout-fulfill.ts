import type Stripe from "stripe"

import { SPONSOR_FLOW_METADATA } from "@/lib/sponsor/sponsor-constants"
import { extractMarketplaceCheckoutCustomer } from "@/lib/marketplace-checkout-session"
import { ghostReverifyBeforeFulfill } from "@/lib/ghost/post-pay-reverify"
import { clearPurchasedCartItems } from "@/lib/marketplace-checkout-cart-clear.server"
import { runAfterResponse } from "@/lib/after-response"
import { orderAwaitsCheckoutFulfilment, orderIsFulfilledForCheckout } from "@/lib/orders/payment-state"
import { prisma } from "@/lib/prisma"
import { fulfillMarketplaceStripeSession } from "@/lib/stripe-marketplace-fulfill"
import { findOrderIdsForCheckoutSession } from "@/lib/stripe-marketplace-commission-split"
import { syncOrderVatFromCheckoutSession } from "@/lib/stripe-sync-order-vat-from-session"
import { reportPaidSessionOnClosedOrders } from "@/lib/unallocated-line.server"
import { logStripeWebhookInfo } from "@/lib/stripe-webhook-observability"

const FULFILMENT_STATE_SELECT = {
  id: true,
  stripeSessionId: true,
  status: true,
  paymentSettlementStatus: true,
  paidAt: true,
  bookingSlotId: true,
  bookingConfirmedAt: true,
  sellingPriceCents: true,
  quantity: true,
  currency: true,
  affiliateProductId: true,
  productId: true,
} as const

/**
 * True when checkout has no rows yet, or at least one row still awaits the checkout fulfilment: pre-created and unpaid
 * ("PENDING"), see `orderAwaitsCheckoutFulfilment`. A row that is paid, PAST paid (preparing, fulfilling, shipped, …) or
 * closed (refunded, cancelled) never does: this gate used to say "any status other than paid", so a replayed or duplicated
 * `checkout.session.completed` re-entered the fulfilment of a SHIPPED order, where the Ghost stock re-check could refund it
 * (finalisation review #9).
 */
export async function marketplaceCheckoutNeedsFulfillment(sessionId: string): Promise<boolean> {
  const orderIds = await findOrderIdsForCheckoutSession(sessionId)
  if (orderIds.length === 0) return true
  const rows = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: FULFILMENT_STATE_SELECT,
  })
  if (rows.length === 0) return true
  const awaits = rows.some((row) => orderAwaitsCheckoutFulfilment(row))
  if (!awaits) {
    // Every caller (webhook, success page, settle path, crons) asks this about a PAID session and stops here when nothing
    // awaits — so this is the one place that sees a paid session whose orders are all closed. If nothing accounts for the
    // closure (an admin-cancelled, never-paid order whose Stripe session stayed payable) the buyer paid for nothing and
    // nobody was told: trace + ONE alert, quiet when accounted for or already reported. Never throws, after the response.
    void runAfterResponse("closed_orders_paid_session", () => reportPaidSessionOnClosedOrders({ sessionId, orders: rows }))
  }
  return awaits
}

/** True when every marketplace row for this Stripe session is paid or past paid (and none is closed). */
export async function isMarketplaceCheckoutFulfilled(sessionId: string): Promise<boolean> {
  const orderIds = await findOrderIdsForCheckoutSession(sessionId)
  if (orderIds.length === 0) return false
  const rows = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: FULFILMENT_STATE_SELECT,
  })
  return rows.length > 0 && rows.every((row) => orderIsFulfilledForCheckout(row))
}

/** Idempotent: create/update paid orders from session metadata, then sync VAT rows. */
export async function ensureMarketplaceCheckoutFulfilled(
  session: Stripe.Checkout.Session
): Promise<void> {
  if (session.mode !== "payment" || session.payment_status !== "paid") return
  if (session.metadata?.flow === "blind_dropship") return
  if (session.metadata?.flow === SPONSOR_FLOW_METADATA) return

  // Last line against every caller (webhook, replay, success page, settle path): once the orders of the session are paid
  // or past paid, or closed, nothing is fulfilled again — and above all the Ghost check below, which probes TODAY's
  // supplier stock and refunds the whole session when it is out, never runs for a shipped order (finalisation review #9).
  if (!(await marketplaceCheckoutNeedsFulfillment(session.id))) {
    logStripeWebhookInfo({ metric: "checkout_fulfill_skipped_nothing_awaits", sessionId: session.id })
    return
  }

  const ghost = await ghostReverifyBeforeFulfill(session)
  if (ghost.refunded) {
    logStripeWebhookInfo({
      metric: "ghost_oos_refunded",
      sessionId: session.id,
    })
    return
  }
  if (ghost.refundFailed) {
    // Out-of-stock product, refund NOT done (alert raised by the refund): never fulfil it. The orders stay unpaid
    // (PENDING) so `reconcile-checkout-orders` comes back here and replays the refund.
    logStripeWebhookInfo({
      metric: "ghost_oos_refund_failed",
      sessionId: session.id,
    })
    return
  }

  const { customerEmail, shippingAddress } = extractMarketplaceCheckoutCustomer(session)

  await fulfillMarketplaceStripeSession(session, shippingAddress, customerEmail)

  try {
    const cleared = await clearPurchasedCartItems(session)
    if (cleared > 0) {
      logStripeWebhookInfo({ metric: "checkout_cart_cleared", sessionId: session.id, items: cleared })
    }
  } catch (error) {
    logStripeWebhookInfo({
      metric: "checkout_cart_clear_skipped",
      sessionId: session.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // VAT rows come from a Stripe API round-trip: not needed for the buyer's confirmation, so after the response.
  await runAfterResponse("checkout_vat_sync", async () => {
    try {
      const { updatedOrderIds } = await syncOrderVatFromCheckoutSession(session.id)
      if (updatedOrderIds.length > 0) {
        logStripeWebhookInfo({
          metric: "checkout_vat_synced",
          sessionId: session.id,
          orderCount: updatedOrderIds.length,
        })
      }
    } catch (error) {
      logStripeWebhookInfo({
        metric: "checkout_vat_sync_skipped",
        sessionId: session.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })
}
