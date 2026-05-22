import type Stripe from "stripe"

import { notifyOrderCancelled } from "@/lib/emails/notify-order-cancelled"
import { getStripeClient } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

async function orderIdsForStripeCharge(charge: Stripe.Charge): Promise<string[]> {
  const pi = charge.payment_intent
  const piId = typeof pi === "string" ? pi : pi?.id
  if (!piId) return []

  const stripe = getStripeClient()
  const sessions = await stripe.checkout.sessions.list({ payment_intent: piId, limit: 20 })
  const sessionIds = sessions.data.map((s) => s.id).filter(Boolean)
  if (sessionIds.length === 0) return []

  const orders = await prisma.order.findMany({
    where: {
      OR: sessionIds.flatMap((sid) => [
        { stripeSessionId: sid },
        { stripeSessionId: { startsWith: `${sid}:line:` } },
      ]),
    },
    select: { id: true },
  })
  return orders.map((o) => o.id)
}

export async function handleStripeChargeRefunded(charge: Stripe.Charge): Promise<{
  processedOrderIds: string[]
}> {
  const orderIds = await orderIdsForStripeCharge(charge)
  const refundAmountCents = charge.amount_refunded ?? charge.amount ?? undefined
  const processedOrderIds: string[] = []

  for (const orderId of orderIds) {
    const result = await notifyOrderCancelled(orderId, {
      cancelReason: "Remboursement Stripe",
      refundAmountCents: refundAmountCents,
      markRefunded: true,
    })
    if (result.sent) processedOrderIds.push(orderId)
  }

  return { processedOrderIds }
}
