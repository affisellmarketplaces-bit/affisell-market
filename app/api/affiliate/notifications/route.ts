import { z } from "zod"

import { auth } from "@/auth"
import { dedupeMerchantNotifications } from "@/lib/merchant-notifications-dedupe"
import {
  resolveAffiliateSaleNotificationBreakdown,
} from "@/lib/marketplace-order-notification-breakdown"
import type { AffiliateSaleOrderAmounts } from "@/lib/marketplace-order-notification-types"
import { parseAffiliateSaleNotification } from "@/lib/merchant-notification-display"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "AFFILIATE") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const forceSync = new URL(req.url).searchParams.get("sync") === "1"

  try {
    const { syncPartnerMarketplaceAlertsBeforeInboxIfDue } = await import(
      "@/lib/marketplace-order-notification-sync"
    )
    await syncPartnerMarketplaceAlertsBeforeInboxIfDue(
      { affiliateId: session.user.id },
      { force: forceSync }
    )
  } catch (error) {
    console.error("[affiliate-notifications]", {
      userId: session.user.id,
      stage: "sync",
      error: error instanceof Error ? error.message : String(error),
    })
  }

  const rows = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  const orderIds = rows.map((n) => n.orderId).filter((id): id is string => Boolean(id))
  const saleOrderIds = rows
    .filter((n) => n.type === "NEW_SALE" && n.orderId)
    .map((n) => n.orderId!)
  const ordersForBreakdown =
    saleOrderIds.length > 0
      ? await prisma.order.findMany({
          where: { id: { in: saleOrderIds }, affiliateId: session.user.id },
          select: {
            id: true,
            variantImageUrl: true,
            subtotalCents: true,
            sellingPriceCents: true,
            totalCents: true,
            taxCents: true,
            supplierPriceCents: true,
            basePriceCents: true,
            marginCents: true,
            affisellFeeCents: true,
            commissionCents: true,
            affiliatePayoutCents: true,
            affiliateMarginRetainedCents: true,
            affiliateFeeCents: true,
            affiliateMarginCents: true,
            supplierPayoutCents: true,
          },
        })
      : []
  const orderById = new Map(ordersForBreakdown.map((o) => [o.id, o]))
  const imageByOrderId = new Map(
    ordersForBreakdown.map((o) => [o.id, o.variantImageUrl])
  )

  const deduped = dedupeMerchantNotifications(rows)
  const unreadFromDeduped = deduped.filter((n) => !n.read).length

  return Response.json({
    unreadCount: unreadFromDeduped,
    notifications: deduped.map((n) => {
      const order =
        n.type === "NEW_SALE" && n.orderId ? orderById.get(n.orderId) : undefined
      const parsed =
        n.type === "NEW_SALE" ? parseAffiliateSaleNotification(n.message) : null
      const breakdown =
        order != null
          ? resolveAffiliateSaleNotificationBreakdown({
              parsed: parsed?.breakdown,
              order: order satisfies AffiliateSaleOrderAmounts,
            })
          : undefined

      return {
        id: n.id,
        type: n.type,
        message: n.message,
        imageUrl: n.imageUrl?.trim() || imageByOrderId.get(n.orderId ?? "")?.trim() || null,
        orderId: n.orderId,
        read: n.read,
        createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt,
        ...(breakdown && Object.values(breakdown).some(Boolean) ? { breakdown } : {}),
      }
    }),
  })
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
  if ((session.user as { role?: string }).role !== "AFFILIATE") {
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

  if (parsed.data.markAllRead) {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, read: false },
      data: { read: true },
    })
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
  return Response.json({ ok: true })
}
