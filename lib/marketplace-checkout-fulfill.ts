import type Stripe from "stripe"

import { extractMarketplaceCheckoutCustomer } from "@/lib/marketplace-checkout-session"
import { fulfillMarketplaceStripeSession } from "@/lib/stripe-marketplace-fulfill"
import { syncOrderVatFromCheckoutSession } from "@/lib/stripe-sync-order-vat-from-session"
import { logStripeWebhookInfo } from "@/lib/stripe-webhook-observability"

/** Idempotent: create/update paid orders from session metadata, then sync VAT rows. */
export async function ensureMarketplaceCheckoutFulfilled(
  session: Stripe.Checkout.Session
): Promise<void> {
  if (session.mode !== "payment" || session.payment_status !== "paid") return
  if (session.metadata?.flow === "blind_dropship") return

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
