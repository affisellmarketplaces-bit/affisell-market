import {
  ensureMarketplaceCheckoutFulfilled,
  isMarketplaceCheckoutFulfilled,
  marketplaceCheckoutNeedsFulfillment,
} from "@/lib/marketplace-checkout-fulfill"
import { findOrderIdsForCheckoutSession } from "@/lib/stripe-marketplace-commission-split"
import { getStripeClient } from "@/lib/stripe"
import { logStripeWebhookInfo } from "@/lib/stripe-webhook-observability"
import { scheduleMarketplaceTransferAttempts } from "@/lib/transfers/schedule-from-checkout"

export type PaidCheckoutSessionResult = {
  paid: boolean
  fulfilled: boolean
  orderId: string | null
  orderIds: string[]
  amountTotal: number | null
  currency: string
}

/** Idempotent: mark orders paid + partner notifications after Stripe Checkout. */
export async function fulfillPaidCheckoutSession(
  sessionId: string
): Promise<PaidCheckoutSessionResult> {
  const stripe = getStripeClient()
  const session = await stripe.checkout.sessions.retrieve(sessionId)

  let orderIds = await findOrderIdsForCheckoutSession(sessionId)
  const paid = session.payment_status === "paid"

  if (session.mode === "payment" && paid && (await marketplaceCheckoutNeedsFulfillment(sessionId))) {
    await ensureMarketplaceCheckoutFulfilled(session)
    orderIds = await findOrderIdsForCheckoutSession(sessionId)

    for (const orderId of orderIds) {
      try {
        await scheduleMarketplaceTransferAttempts(session, orderId)
      } catch (error) {
        logStripeWebhookInfo({
          metric: "checkout_transfer_schedule_skipped",
          sessionId,
          orderId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    console.log("[checkout-success]", {
      sessionId,
      orderIds,
      result: "fulfilled",
    })
  }

  const fulfilled = paid && (await isMarketplaceCheckoutFulfilled(sessionId))

  return {
    paid,
    fulfilled,
    orderId: orderIds[0] ?? session.metadata?.orderId ?? null,
    orderIds,
    amountTotal: session.amount_total ?? null,
    currency: session.currency ?? "eur",
  }
}
