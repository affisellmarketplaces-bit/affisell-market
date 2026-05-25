import { buyerExtensionResponseExpiresAt } from "@/lib/orders/ship-pulse-policy"
import { prisma } from "@/lib/prisma"
import {
  resolveShipDeadlineAt,
  SHIP_EXTENSION_DEFAULT_EXTRA_DAYS,
  SHIP_EXTENSION_MAX_EXTRA_DAYS,
  SHIP_EXTENSION_MIN_EXTRA_DAYS,
} from "@/lib/supplier-ship-sla-shared"

export async function loadOrderForShipPulse(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      supplierId: true,
      affiliateId: true,
      buyerUserId: true,
      customerEmail: true,
      trackingNumber: true,
      shipDeadlineAt: true,
      paidAt: true,
      createdAt: true,
      product: { select: { name: true } },
    },
  })
}

export async function postFulfillmentMessage(args: {
  orderId: string
  authorRole: "BUYER" | "SUPPLIER"
  authorUserId: string
  body: string
}): Promise<{ ok: boolean; error?: string }> {
  const body = args.body.trim()
  if (body.length < 8) return { ok: false, error: "message_too_short" }
  if (body.length > 4000) return { ok: false, error: "message_too_long" }

  const order = await loadOrderForShipPulse(args.orderId)
  if (!order) return { ok: false, error: "order_not_found" }
  if (!["paid", "preparing"].includes(order.status)) {
    return { ok: false, error: "order_not_open" }
  }

  if (args.authorRole === "SUPPLIER") {
    if (order.supplierId !== args.authorUserId) return { ok: false, error: "forbidden" }
  } else {
    const user = await prisma.user.findUnique({
      where: { id: args.authorUserId },
      select: { email: true },
    })
    const buyerOk =
      order.buyerUserId === args.authorUserId ||
      Boolean(
        user?.email &&
          order.customerEmail.trim().toLowerCase() === user.email.trim().toLowerCase()
      )
    if (!buyerOk) return { ok: false, error: "forbidden" }
  }

  await prisma.orderFulfillmentMessage.create({
    data: {
      orderId: args.orderId,
      authorRole: args.authorRole,
      authorUserId: args.authorUserId,
      body,
    },
  })

  const notifyUserId = args.authorRole === "SUPPLIER" ? order.buyerUserId : order.supplierId
  if (notifyUserId) {
    await prisma.notification.create({
      data: {
        userId: notifyUserId,
        type: "ORDER_FULFILLMENT_MESSAGE",
        message:
          args.authorRole === "SUPPLIER"
            ? `Ship Pulse · ${order.product.name} — seller update on your order. Open My orders to read and respond.`
            : `Ship Pulse · ${order.product.name} — buyer message on order ${args.orderId.slice(-6)}.`,
        orderId: args.orderId,
      },
    })
  }

  return { ok: true }
}

export async function requestShipExtension(args: {
  orderId: string
  supplierUserId: string
  reason: string
  extraDays?: number
}): Promise<{ ok: boolean; error?: string; extensionId?: string }> {
  const reason = args.reason.trim()
  if (reason.length < 20) return { ok: false, error: "reason_too_short" }
  if (reason.length > 3000) return { ok: false, error: "reason_too_long" }

  const extraDays = Math.min(
    SHIP_EXTENSION_MAX_EXTRA_DAYS,
    Math.max(SHIP_EXTENSION_MIN_EXTRA_DAYS, args.extraDays ?? SHIP_EXTENSION_DEFAULT_EXTRA_DAYS)
  )

  const order = await loadOrderForShipPulse(args.orderId)
  if (!order) return { ok: false, error: "order_not_found" }
  if (order.supplierId !== args.supplierUserId) return { ok: false, error: "forbidden" }
  if (!["paid", "preparing"].includes(order.status)) return { ok: false, error: "order_not_open" }
  if (order.trackingNumber?.trim()) return { ok: false, error: "already_shipped" }

  const pending = await prisma.orderShipExtension.findFirst({
    where: { orderId: args.orderId, status: "PENDING" },
  })
  if (pending) return { ok: false, error: "extension_already_pending" }

  const now = new Date()
  const ext = await prisma.orderShipExtension.create({
    data: {
      orderId: args.orderId,
      reason,
      extraDays,
      status: "PENDING",
      buyerExpiresAt: buyerExtensionResponseExpiresAt(now),
    },
  })

  if (order.buyerUserId) {
    await prisma.notification.create({
      data: {
        userId: order.buyerUserId,
        type: "SHIP_EXTENSION_REQUEST",
        message: `Ship Pulse · ${order.product.name} — seller requests ${extraDays} extra days to ship. Explain why in My orders — you can accept or refuse.`,
        orderId: args.orderId,
      },
    })
  }

  return { ok: true, extensionId: ext.id }
}

export async function respondShipExtension(args: {
  orderId: string
  buyerUserId: string
  accept: boolean
  buyerNote?: string
}): Promise<{ ok: boolean; error?: string }> {
  const order = await loadOrderForShipPulse(args.orderId)
  if (!order) return { ok: false, error: "order_not_found" }
  if (!order.buyerUserId || order.buyerUserId !== args.buyerUserId) {
    return { ok: false, error: "forbidden" }
  }

  const pending = await prisma.orderShipExtension.findFirst({
    where: { orderId: args.orderId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  })
  if (!pending) return { ok: false, error: "no_pending_extension" }
  if (pending.buyerExpiresAt < new Date()) {
    await prisma.orderShipExtension.update({
      where: { id: pending.id },
      data: { status: "EXPIRED", buyerRespondedAt: new Date() },
    })
    return { ok: false, error: "extension_expired" }
  }

  const note = args.buyerNote?.trim().slice(0, 500) || null
  const now = new Date()

  if (args.accept) {
    const baseDeadline = resolveShipDeadlineAt(order)
    const newDeadline = new Date(
      Math.max(baseDeadline.getTime(), now.getTime()) + pending.extraDays * 24 * 60 * 60 * 1000
    )

    await prisma.$transaction([
      prisma.orderShipExtension.update({
        where: { id: pending.id },
        data: {
          status: "ACCEPTED",
          buyerRespondedAt: now,
          buyerNote: note,
          newDeadlineAt: newDeadline,
        },
      }),
      prisma.order.update({
        where: { id: args.orderId },
        data: { shipDeadlineAt: newDeadline },
      }),
    ])

    await prisma.notification.create({
      data: {
        userId: order.supplierId,
        type: "SHIP_EXTENSION_ACCEPTED",
        message: `Ship Pulse · ${order.product.name} — buyer accepted +${pending.extraDays} days (new ship-by ${newDeadline.toISOString().slice(0, 10)}).`,
        orderId: args.orderId,
      },
    })
  } else {
    await prisma.orderShipExtension.update({
      where: { id: pending.id },
      data: {
        status: "REJECTED",
        buyerRespondedAt: now,
        buyerNote: note,
      },
    })

    await prisma.notification.create({
      data: {
        userId: order.supplierId,
        type: "SHIP_EXTENSION_REJECTED",
        message: `Ship Pulse · ${order.product.name} — buyer refused the extra delay. Ship immediately or the order may be cancelled.`,
        orderId: args.orderId,
      },
    })
  }

  return { ok: true }
}

export async function expireStaleShipExtensions(limit = 50): Promise<number> {
  const now = new Date()
  const stale = await prisma.orderShipExtension.findMany({
    where: { status: "PENDING", buyerExpiresAt: { lte: now } },
    take: limit,
    select: { id: true },
  })
  if (stale.length === 0) return 0

  await prisma.orderShipExtension.updateMany({
    where: { id: { in: stale.map((s) => s.id) } },
    data: { status: "EXPIRED", buyerRespondedAt: now },
  })
  return stale.length
}
