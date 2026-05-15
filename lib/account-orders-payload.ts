import { prisma } from "@/lib/prisma"
import {
  getActiveReturn,
  hasBlockingReturnHistory,
  orderReturnWindowEndsAt,
} from "@/lib/order-return-policy"
import { isTerminalReturnStatus } from "@/lib/order-return-types"

export async function buildBuyerOrdersPayloadForEmail(customerEmail: string) {
  const orders = await prisma.order.findMany({
    where: {
      customerEmail: { equals: customerEmail, mode: "insensitive" },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      product: { select: { id: true, name: true, images: true } },
      returns: { orderBy: { createdAt: "desc" } },
    },
  })

  const now = new Date()
  return orders.map((o) => {
    const active = getActiveReturn(o.returns)
    const latest = o.returns[0] ?? null
    return {
      id: o.id,
      createdAt: o.createdAt.toISOString(),
      quantity: o.quantity,
      sellingPriceCents: o.sellingPriceCents,
      status: o.status,
      shippedAt: o.shippedAt?.toISOString() ?? null,
      trackingCarrier: o.trackingCarrier,
      trackingNumber: o.trackingNumber,
      product: {
        id: o.product.id,
        name: o.product.name,
        imageUrl: o.product.images[0] ?? null,
      },
      returnWindowEndsAt: orderReturnWindowEndsAt(o).toISOString(),
      returnEligible:
        o.status === "paid" && now <= orderReturnWindowEndsAt(o) && !hasBlockingReturnHistory(o.returns),
      activeReturn: active
        ? {
            id: active.id,
            status: active.status,
            reasonCode: active.reasonCode,
            createdAt: active.createdAt.toISOString(),
            sellerRespondByAt: active.sellerRespondByAt?.toISOString() ?? null,
            buyerTrackingCarrier: active.buyerTrackingCarrier,
            buyerTrackingNumber: active.buyerTrackingNumber,
          }
        : null,
      lastReturn: latest
        ? {
            id: latest.id,
            status: latest.status,
            createdAt: latest.createdAt.toISOString(),
            terminal: isTerminalReturnStatus(latest.status),
          }
        : null,
    }
  })
}
