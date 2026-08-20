import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || (session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const groups = await prisma.fulfillmentGroup.findMany({
    where: { supplierId: session.user.id },
    include: {
      items: {
        include: {
          order: {
            select: {
              id: true,
              status: true,
              quantity: true,
              variantLabel: true,
              customerEmail: true,
              createdAt: true,
              product: { select: { name: true, images: true } },
            },
          },
        },
      },
      supplierIntegration: { select: { provider: true, shopDomain: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return Response.json({
    groups: groups.map((g) => ({
      id: g.id,
      stripeSessionId: g.stripeSessionId,
      status: g.status,
      externalOrderId: g.externalOrderId,
      trackingNumber: g.trackingNumber,
      trackingCarrier: g.trackingCarrier,
      trackingUrl: g.trackingUrl,
      error: g.error,
      manualNote: g.manualNote,
      provider: g.supplierIntegration?.provider ?? null,
      createdAt: g.createdAt.toISOString(),
      items: g.items.map((item) => ({
        orderId: item.orderId,
        quantity: item.quantity,
        order: {
          id: item.order.id,
          status: item.order.status,
          quantity: item.order.quantity,
          variantLabel: item.order.variantLabel,
          customerEmail: item.order.customerEmail,
          createdAt: item.order.createdAt.toISOString(),
          productName: item.order.product.name,
          productImage: item.order.product.images[0] ?? null,
        },
      })),
    })),
  })
}
