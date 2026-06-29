import { z } from "zod"

import { auth } from "@/auth"
import {
  isSupplierBlindDropshipOrder,
  mapMarketplaceOrder,
  supplierOrderInclude,
} from "@/lib/supplier-orders-payload"
import { toSupplierFulfillmentOrderPublic } from "@/lib/supplier-orders-public-api"
import { notifyMarketplaceOrderShipped } from "@/lib/emails/notify-order-shipped"
import { triggerOrderTransferRelease } from "@/lib/trigger-order-transfer-release"
import { triggerLightningPayout } from "@/lib/stripe-lightning"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const markPreparingSchema = z.object({ action: z.literal("mark_preparing") }).strict()

const markShippedSchema = z
  .object({
    action: z.literal("mark_shipped"),
    trackingCarrier: z.string().max(80).optional(),
    trackingNumber: z.string().min(1).max(120),
  })
  .strict()

const patchSchema = z.discriminatedUnion("action", [markPreparingSchema, markShippedSchema])

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

  if (await isSupplierBlindDropshipOrder(orderId, session.user.id)) {
    return Response.json(
      {
        error:
          "Blind dropship orders are sent to your partner API automatically. Use your partner webhook for tracking updates.",
      },
      { status: 400 }
    )
  }

  const existing = await prisma.order.findFirst({
    where: { id: orderId, supplierId: session.user.id },
    include: { product: { select: { name: true } } },
  })
  if (!existing) {
    return Response.json({ error: "Order not found" }, { status: 404 })
  }
  if (parsed.data.action === "mark_preparing") {
    if (existing.status !== "paid") {
      return Response.json(
        {
          error:
            existing.status === "preparing"
              ? "Order is already marked as preparing."
              : "Only paid orders can move to preparing.",
        },
        { status: 409 }
      )
    }

    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id: orderId },
        data: {
          status: "preparing",
          supplierPreparingAt: new Date(),
        },
        include: supplierOrderInclude,
      })

      const productName = existing.product?.name ?? "Your order"

      if (order.buyerUserId) {
        await tx.notification.create({
          data: {
            userId: order.buyerUserId,
            type: "ORDER_PREPARING",
            message: `Good news · ${productName} — your seller confirmed the order is being packed. Tracking will drop as soon as the parcel ships. Bonne nouvelle · ${productName} — votre vendeur prépare votre commande.`,
            orderId: order.id,
          },
        })
      }

      await tx.notification.create({
        data: {
          userId: order.affiliateId,
          type: "ORDER_PREP_UPDATE",
          message: `Fulfillment · ${productName} — supplier started preparing the package; your buyer gets the same heads-up in “My orders”.`,
          orderId: order.id,
        },
      })

      return order
    })

    return Response.json({ order: toSupplierFulfillmentOrderPublic(mapMarketplaceOrder(updated)) })
  }

  if (!["paid", "preparing"].includes(existing.status)) {
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
          message: `Your order has shipped · ${order.product.name} · ${carrier} ${tracking}. Confirm receipt in My orders when satisfied (payouts release 7 days later). Your right of withdrawal remains available during the return window.`,
          orderId: order.id,
        },
      })
    }

    return order
  })

  void notifyMarketplaceOrderShipped(updated.id, {
    trackingNumber: tracking,
    carrier,
  })

  const supplierProfile = await prisma.supplierProfile.findUnique({
    where: { userId: session.user.id },
    select: { lightningEnabled: true },
  })

  let payoutTriggered = false
  if (supplierProfile?.lightningEnabled === true) {
    const payout = await triggerLightningPayout(updated.id)
    payoutTriggered = payout.success
  }

  if (!payoutTriggered) {
    triggerOrderTransferRelease(updated.id)
  }

  console.log("[mark-shipped]", {
    orderId: updated.id,
    supplierId: session.user.id,
    payoutTriggered,
  })

  return Response.json({
    order: toSupplierFulfillmentOrderPublic(mapMarketplaceOrder(updated)),
    payoutTriggered,
  })
}
