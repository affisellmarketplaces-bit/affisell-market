import type Stripe from "stripe"

import { prisma } from "@/lib/prisma"

/**
 * Stripe sends `payment_intent.succeeded` and `checkout.session.completed` at about the same time, in any order.
 * Settling (split scheduling) marks the pre-created order PAID; if that happens before the checkout fulfilment,
 * the fulfilment sees "already paid" and skips everything: no buyer e-mail / address / account on the order, no
 * confirmation e-mail, partner alerts computed on incomplete amounts.
 *
 * So the settle path always makes sure the checkout is fulfilled FIRST. Idempotent and safe under concurrency
 * (the fulfilment holds a per-session lock; the loser finds the order already complete).
 */
export async function ensureCheckoutFulfilledBeforeSettle(session: Stripe.Checkout.Session): Promise<boolean> {
  if (session.mode !== "payment" || session.payment_status !== "paid") return false
  // Dynamic import: marketplace-checkout-fulfill imports the split module (this caller) — avoid an import cycle.
  const { marketplaceCheckoutNeedsFulfillment, ensureMarketplaceCheckoutFulfilled } = await import(
    "@/lib/marketplace-checkout-fulfill"
  )
  if (!(await marketplaceCheckoutNeedsFulfillment(session.id))) return false
  await ensureMarketplaceCheckoutFulfilled(session)
  return true
}

/** True when the order is paid but was never completed with the buyer's details (the race above already happened). */
export async function orderPaidWithoutBuyerDetails(orderId: string): Promise<boolean> {
  const o = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true, customerEmail: true } })
  return Boolean(o && o.status === "paid" && !o.customerEmail.trim())
}

/**
 * `payment_intent.succeeded` → make sure the matching checkout is fulfilled, BEFORE the webhook opens its database
 * transaction. The fulfilment is long (stock re-check, order rows, notifications): inside the 25s interactive
 * transaction it made the final `processedWebhook.create()` fail with "Transaction already closed" (Sentry
 * JAVASCRIPT-NEXTJS-4W). Never throws — settling still applies its own guard afterwards.
 */
export async function ensureCheckoutFulfilledForPaymentIntent(pi: Stripe.PaymentIntent): Promise<void> {
  if (pi.metadata?.flow === "blind_dropship") return
  try {
    const { checkoutSessionIdForPaymentIntent } = await import("@/lib/stripe-marketplace-commission-split")
    const sessionId = await checkoutSessionIdForPaymentIntent(pi.id)
    if (!sessionId) return
    const { getStripeClient } = await import("@/lib/stripe")
    const session = await getStripeClient().checkout.sessions.retrieve(sessionId)
    await ensureCheckoutFulfilledBeforeSettle(session)
  } catch (error) {
    console.error("[fulfil-before-webhook-tx]", {
      paymentIntentId: pi.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
