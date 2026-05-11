import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import {
  getActiveReturn,
  hasBlockingReturnHistory,
  orderReturnWindowEndsAt,
} from "@/lib/order-return-policy"
import { isTerminalReturnStatus } from "@/lib/order-return-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  const orders = await prisma.order.findMany({
    where: {
      customerEmail: { equals: session.user.email, mode: "insensitive" },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      product: { select: { id: true, name: true, images: true } },
      returns: { orderBy: { createdAt: "desc" } },
    },
  })

  const now = new Date()
  return Response.json(
    orders.map((o) => {
      const active = getActiveReturn(o.returns)
      const latest = o.returns[0] ?? null
      return {
        id: o.id,
        createdAt: o.createdAt.toISOString(),
        quantity: o.quantity,
        sellingPriceCents: o.sellingPriceCents,
        status: o.status,
        product: {
          id: o.product.id,
          name: o.product.name,
          imageUrl: o.product.images[0] ?? null,
        },
        returnWindowEndsAt: orderReturnWindowEndsAt(o).toISOString(),
        returnEligible:
          o.status === "paid" &&
          now <= orderReturnWindowEndsAt(o) &&
          !hasBlockingReturnHistory(o.returns),
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
  )
}
