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
