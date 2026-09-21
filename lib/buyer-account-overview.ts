import { buildBuyerOrdersPayloadForEmail } from "@/lib/account-orders-payload"
import { prisma } from "@/lib/prisma"

export type BuyerActiveOrder = {
  id: string
  title: string
  imageUrl: string | null
  status: string
  createdAt: string
  trackingCarrier: string | null
  trackingNumber: string | null
}

export type BuyerAccountOverview = {
  orderCount: number
  walletCents: number
  cartItemCount: number
  inProgressCount: number
  deliveredCount: number
  /** Latest orders still on their way (max 3), newest first. */
  activeOrders: BuyerActiveOrder[]
}

export const EMPTY_BUYER_OVERVIEW: BuyerAccountOverview = {
  orderCount: 0,
  walletCents: 0,
  cartItemCount: 0,
  inProgressCount: 0,
  deliveredCount: 0,
  activeOrders: [],
}

const CLOSED_STATUSES = new Set(["refunded", "cancelled", "CANCELLED", "failed", "pending_payment"])

function isInProgress(o: { status: string; deliveredAt: string | null }): boolean {
  return !CLOSED_STATUSES.has(o.status) && !o.deliveredAt
}

export async function loadBuyerAccountOverview(
  userId: string,
  email: string
): Promise<BuyerAccountOverview> {
  const normalizedEmail = email.trim().toLowerCase()

  const [orders, user, cart] = await Promise.all([
    buildBuyerOrdersPayloadForEmail(normalizedEmail, userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { buyerRewardBalanceCents: true },
    }),
    prisma.cart.findFirst({
      where: { userId },
      select: {
        items: { select: { quantity: true } },
      },
    }),
  ])

  const cartItemCount = (cart?.items ?? []).reduce(
    (sum, item) => sum + Math.max(0, item.quantity),
    0
  )

  const active = orders.filter(isInProgress)
  return {
    orderCount: orders.length,
    walletCents: user?.buyerRewardBalanceCents ?? 0,
    cartItemCount,
    inProgressCount: active.length,
    deliveredCount: orders.filter((o) => Boolean(o.deliveredAt) && !CLOSED_STATUSES.has(o.status)).length,
    activeOrders: active.slice(0, 3).map((o) => ({
      id: o.id,
      title: o.product.name,
      imageUrl: o.product.imageUrl,
      status: o.status,
      createdAt: o.createdAt,
      trackingCarrier: o.trackingCarrier,
      trackingNumber: o.trackingNumber,
    })),
  }
}
