import type Stripe from "stripe"

import { affisellFeeCentsFromLine } from "@/lib/affisell-platform-commission"
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
    select: { id: true, sellingPriceCents: true },
  })
  return orders.map((o) => o.id)
}

/**
 * After checkout.session.completed + fulfill: persist HT/TVA/TTC from Stripe Tax on each order row.
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
    select: { id: true, sellingPriceCents: true, affisellCommissionRateBps: true },
  })
  const weightSum = orders.reduce((s, o) => s + Math.max(0, o.sellingPriceCents), 0)

  const updatedOrderIds: string[] = []

  for (const order of orders) {
    const weight =
      weightSum > 0 ? Math.max(0, order.sellingPriceCents) / weightSum : 1 / Math.max(1, orders.length)

    const subtotalCents = Math.round(sessionSubtotal * weight)
    const taxCents = Math.round(sessionTax * weight)
    const totalCents = Math.round(sessionTotal * weight)

    const affisellFeeCents = affisellFeeCentsFromLine(
      subtotalCents,
      order.affisellCommissionRateBps
    )

    await prisma.order.update({
      where: { id: order.id },
      data: {
        subtotalCents,
        taxCents,
        totalCents,
        affisellFeeCents,
        taxCountry,
        taxRate: sessionTaxRate,
        stripeCustomerId,
      },
    })
    updatedOrderIds.push(order.id)
  }

  return { updatedOrderIds }
}
