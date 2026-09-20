import "server-only"

import type Stripe from "stripe"

import { prisma } from "@/lib/prisma"
import { findOrderIdsForCheckoutSession } from "@/lib/stripe-marketplace-commission-split"

/**
 * A paid checkout empties what it bought from the buyer's server cart — otherwise the cart keeps showing
 * already-purchased items "as if nothing happened". Idempotent (a second run deletes nothing), scoped to the
 * buyer of the session and to the purchased listings only; other cart lines are never touched.
 */
export async function clearPurchasedCartItems(session: Stripe.Checkout.Session): Promise<number> {
  const buyerUserId = session.metadata?.buyerUserId?.trim()
  if (!buyerUserId) return 0

  const orderIds = await findOrderIdsForCheckoutSession(session.id)
  if (orderIds.length === 0) return 0
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: { affiliateProductId: true },
  })
  const listingIds = [...new Set(orders.map((o) => o.affiliateProductId).filter(Boolean))]
  if (listingIds.length === 0) return 0

  const { count } = await prisma.cartItem.deleteMany({
    where: { affiliateProductId: { in: listingIds }, cart: { userId: buyerUserId } },
  })
  return count
}
