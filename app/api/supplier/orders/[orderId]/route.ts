import { z } from "zod"

import { auth } from "@/auth"
import { mapSupplierOrderRow, supplierOrderInclude } from "@/lib/supplier-orders-payload"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const patchSchema = z
  .object({
    action: z.literal("mark_shipped"),
    trackingCarrier: z.string().max(80).optional(),
    trackingNumber: z.string().min(1).max(120),
  })
  .strict()

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ orderId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { orderId } = await ctx.params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 })
  }

  const existing = await prisma.order.findFirst({
    where: { id: orderId, supplierId: session.user.id },
    include: { product: { select: { name: true } } },
  })
  if (!existing) {
    return Response.json({ error: "Order not found" }, { status: 404 })
  }
  if (existing.status !== "paid") {
    return Response.json({ error: "Order is not awaiting shipment" }, { status: 409 })
  }

  const carrier = parsed.data.trackingCarrier?.trim() || "Carrier"
  const tracking = parsed.data.trackingNumber.trim()

  const updated = await prisma.$transaction(async (tx) => {
    const order = await tx.order.update({
      where: { id: orderId },
      data: {
        status: "shipped",
        trackingCarrier: carrier,
        trackingNumber: tracking,
        shippedAt: new Date(),
      },
      include: supplierOrderInclude,
    })

    await tx.notification.updateMany({
      where: { userId: session.user.id, orderId, type: "NEW_ORDER", read: false },
      data: { read: true },
    })

    if (order.buyerUserId) {
      await tx.notification.create({
        data: {
          userId: order.buyerUserId,
          type: "ORDER_SHIPPED",
          message: `Your order has shipped · ${order.product.name} · ${carrier} ${tracking}`,
          orderId: order.id,
        },
      })
    }

    return order
  })

  return Response.json({ order: mapSupplierOrderRow(updated) })
}
