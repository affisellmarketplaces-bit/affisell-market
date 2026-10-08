import { z } from "zod"

import { auth } from "@/auth"
import { dedupeMerchantNotifications } from "@/lib/merchant-notifications-dedupe"
import { loadNotificationOrderSummaries } from "@/lib/merchant-notification-order-summary"
import { prisma } from "@/lib/prisma"
import { assertNoSupplierRetailLeak } from "@/lib/supplier-retail-veil"
import {
  enrichSupplierNotificationRows,
  loadSupplierToShipSnapshot,
} from "@/lib/supplier-order-alert-inbox"
import {
  invalidateSupplierNotificationsDevCache,
  readSupplierNotificationsDevCache,
  writeSupplierNotificationsDevCache,
} from "@/lib/supplier-notifications-dev-cache"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * READ-ONLY. This handler only reads the inbox and the data needed to display it.
 *
 * It must never wait for — or trigger — any business catch-up: no Stripe, no fulfilment, no amount reconciliation,
 * no notification heal/refresh, no legacy "reopen". Those used to run here on every poll, took far longer than the
 * 10 s API budget on a cold instance, and made ~96 % of cold supplier polls fail (HTTP 504, 2026-10).
 * The guard test `lib/__tests__/notifications-get-read-only.test.ts` fails if that dependency comes back.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  // `?sync=1` is still sent by the bell when it is opened. It now only means "fresh read": it bypasses the
  // development-only cache. It does NOT trigger any catch-up (that is a separate, explicit mechanism).
  const freshRead = new URL(req.url).searchParams.get("sync") === "1"

  if (!freshRead) {
    const cached = readSupplierNotificationsDevCache(session.user.id)
    if (cached) {
      return Response.json(cached)
    }
  }

  try {
    const rows = await prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    const orderIds = rows.map((n) => n.orderId).filter((id): id is string => Boolean(id))

    const [toShipSnapshot, orderImages, summaries] = await Promise.all([
      loadSupplierToShipSnapshot(session.user.id, { notificationOrderIds: orderIds }),
      orderIds.length > 0
        ? prisma.order.findMany({
            where: { id: { in: orderIds }, supplierId: session.user.id },
            select: { id: true, variantImageUrl: true },
          })
        : Promise.resolve([]),
      loadNotificationOrderSummaries(session.user.id, orderIds, "SUPPLIER"),
    ])

    const imageByOrderId = new Map(orderImages.map((o) => [o.id, o.variantImageUrl]))

    const deduped = dedupeMerchantNotifications(rows)
    const enriched = enrichSupplierNotificationRows(deduped, toShipSnapshot.orderIds)
    const unreadFromDeduped = enriched.filter((n) => !n.read).length
    const actionRequiredCount = enriched.filter((n) => n.actionRequired && !n.read).length
    const ordersToShipCount = toShipSnapshot.ordersToShipCount
    const badgeCount = Math.max(unreadFromDeduped, ordersToShipCount)

    console.log("[supplier-notifications]", {
      userId: session.user.id,
      unreadCount: unreadFromDeduped,
      actionRequiredCount,
      ordersToShipCount,
      badgeCount,
      notificationRows: enriched.length,
    })

    const payload = {
      unreadCount: unreadFromDeduped,
      actionRequiredCount,
      ordersToShipCount,
      badgeCount,
      notifications: enriched.map((n) => ({
        id: n.id,
        type: n.type,
        message: n.message,
        imageUrl:
          n.imageUrl?.trim() ||
          imageByOrderId.get(n.orderId ?? "")?.trim() ||
          summaries.get(n.orderId ?? "")?.imageUrl ||
          null,
        ...(n.orderId && summaries.has(n.orderId) ? { order: summaries.get(n.orderId) } : {}),
        orderId: n.orderId,
        read: n.read,
        actionRequired: n.actionRequired,
        createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt,
      })),
    }

    // Fail closed: reseller / buyer retail never crosses to a supplier client.
    assertNoSupplierRetailLeak(payload)
    writeSupplierNotificationsDevCache(session.user.id, payload)
    return Response.json(payload)
  } catch (error) {
    console.error("[supplier-notifications]", {
      userId: session.user.id,
      stage: "get",
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ unreadCount: 0, ordersToShipCount: 0, badgeCount: 0, notifications: [] }, { status: 200 })
  }
}

const patchSchema = z
  .object({
    markAllRead: z.literal(true).optional(),
    ids: z.array(z.string().min(1)).optional(),
  })
  .strict()

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 })
  }

  try {
    if (parsed.data.markAllRead) {
      await prisma.notification.updateMany({
        where: { userId: session.user.id, read: false },
        data: { read: true },
      })
      invalidateSupplierNotificationsDevCache(session.user.id)
      return Response.json({ ok: true })
    }

    const ids = parsed.data.ids
    if (!ids?.length) {
      return Response.json({ error: "Provide markAllRead or ids" }, { status: 400 })
    }

    await prisma.notification.updateMany({
      where: { userId: session.user.id, id: { in: ids } },
      data: { read: true },
    })
    invalidateSupplierNotificationsDevCache(session.user.id)
    return Response.json({ ok: true })
  } catch (error) {
    console.error("[supplier-notifications]", {
      userId: session.user.id,
      stage: "patch",
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ ok: false, error: "Temporary notification outage" }, { status: 503 })
  }
}
