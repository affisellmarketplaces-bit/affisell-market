import type Stripe from "stripe"

import { SPONSOR_FLOW_METADATA } from "@/lib/sponsor/sponsor-constants"
import { extractMarketplaceCheckoutCustomer } from "@/lib/marketplace-checkout-session"
import { prisma } from "@/lib/prisma"
import { fulfillMarketplaceStripeSession } from "@/lib/stripe-marketplace-fulfill"
import { findOrderIdsForCheckoutSession } from "@/lib/stripe-marketplace-commission-split"
import { syncOrderVatFromCheckoutSession } from "@/lib/stripe-sync-order-vat-from-session"
import { logStripeWebhookInfo } from "@/lib/stripe-webhook-observability"

/** True when checkout has no rows yet, or pre-created rows are still unpaid (PENDING). */
export async function marketplaceCheckoutNeedsFulfillment(sessionId: string): Promise<boolean> {
  const orderIds = await findOrderIdsForCheckoutSession(sessionId)
  if (orderIds.length === 0) return true
  const unpaid = await prisma.order.count({
    where: { id: { in: orderIds }, status: { not: "paid" } },
  })
  return unpaid > 0
}

/** True when every marketplace row for this Stripe session is paid. */
export async function isMarketplaceCheckoutFulfilled(sessionId: string): Promise<boolean> {
  const orderIds = await findOrderIdsForCheckoutSession(sessionId)
  if (orderIds.length === 0) return false
  const unpaid = await prisma.order.count({
    where: { id: { in: orderIds }, status: { not: "paid" } },
  })
  return unpaid === 0
}

/** Idempotent: create/update paid orders from session metadata, then sync VAT rows. */
export async function ensureMarketplaceCheckoutFulfilled(
  session: Stripe.Checkout.Session
): Promise<void> {
  if (session.mode !== "payment" || session.payment_status !== "paid") return
  if (session.metadata?.flow === "blind_dropship") return
  if (session.metadata?.flow === SPONSOR_FLOW_METADATA) return

  const { customerEmail, shippingAddress } = extractMarketplaceCheckoutCustomer(session)

  await fulfillMarketplaceStripeSession(session, shippingAddress, customerEmail)

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
}
