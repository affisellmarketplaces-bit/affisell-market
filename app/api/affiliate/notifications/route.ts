import { z } from "zod"

import { auth } from "@/auth"
import { syncPartnerMarketplaceAlertsBeforeInbox } from "@/lib/marketplace-order-notification-sync"
import { dedupeMerchantNotifications } from "@/lib/merchant-notifications-dedupe"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "AFFILIATE") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    await syncPartnerMarketplaceAlertsBeforeInbox({ affiliateId: session.user.id })
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
  const orderImages =
    orderIds.length > 0
      ? await prisma.order.findMany({
          where: { id: { in: orderIds }, affiliateId: session.user.id },
          select: { id: true, variantImageUrl: true },
        })
      : []
  const imageByOrderId = new Map(orderImages.map((o) => [o.id, o.variantImageUrl]))

  const deduped = dedupeMerchantNotifications(rows)
  const unreadFromDeduped = deduped.filter((n) => !n.read).length

  return Response.json({
    unreadCount: unreadFromDeduped,
    notifications: deduped.map((n) => ({
      id: n.id,
      type: n.type,
      message: n.message,
      imageUrl: n.imageUrl?.trim() || imageByOrderId.get(n.orderId ?? "")?.trim() || null,
      orderId: n.orderId,
      read: n.read,
      createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt,
    })),
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
