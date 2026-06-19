import { after } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { reconcilePartnerPendingCheckoutOrders } from "@/lib/cron/reconcile-partner-pending-checkouts"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    after(() => reconcilePartnerPendingCheckoutOrders({ supplierId: session.user.id }))

    const [rows, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.notification.count({
        where: { userId: session.user.id, read: false },
      }),
    ])

    const orderIds = rows.map((n) => n.orderId).filter((id): id is string => Boolean(id))
    const orderImages =
      orderIds.length > 0
        ? await prisma.order.findMany({
            where: { id: { in: orderIds }, supplierId: session.user.id },
            select: { id: true, variantImageUrl: true },
          })
        : []
    const imageByOrderId = new Map(orderImages.map((o) => [o.id, o.variantImageUrl]))

    return Response.json({
      unreadCount,
      notifications: rows.map((n) => ({
        id: n.id,
        type: n.type,
        message: n.message,
        imageUrl: n.imageUrl?.trim() || imageByOrderId.get(n.orderId ?? "")?.trim() || null,
        orderId: n.orderId,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error("[supplier-notifications]", {
      userId: session.user.id,
      stage: "get",
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ unreadCount: 0, notifications: [] }, { status: 200 })
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
  } catch (error) {
    console.error("[supplier-notifications]", {
      userId: session.user.id,
      stage: "patch",
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ ok: false, error: "Temporary notification outage" }, { status: 503 })
  }
}
