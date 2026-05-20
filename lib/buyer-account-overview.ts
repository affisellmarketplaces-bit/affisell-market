import { buildBuyerOrdersPayloadForEmail } from "@/lib/account-orders-payload"
import { prisma } from "@/lib/prisma"

export type BuyerAccountOverview = {
  orderCount: number
  walletCents: number
  cartItemCount: number
}

export async function loadBuyerAccountOverview(
  userId: string,
  email: string
): Promise<BuyerAccountOverview> {
  const normalizedEmail = email.trim().toLowerCase()

  const [orders, user, cart] = await Promise.all([
    buildBuyerOrdersPayloadForEmail(normalizedEmail),
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

  return {
    orderCount: orders.length,
    walletCents: user?.buyerRewardBalanceCents ?? 0,
    cartItemCount,
  }
}
