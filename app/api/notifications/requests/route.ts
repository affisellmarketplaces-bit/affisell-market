import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { PRODUCT_REQUEST_NOTIF_TYPES } from "@/lib/product-request-notif-constants"
import { formatRequestRelativeFr } from "@/lib/product-request-types"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET — last 20 ProductRequest-related notifications for the connected user (badge).
 * orderId is reused to store requestId for deep-links.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 })
  }

  const role = session.user.role
  if (role !== "AFFILIATE" && role !== "SUPPLIER") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  try {
    const rows = await prisma.notification.findMany({
      where: {
        userId: session.user.id,
        type: { in: [...PRODUCT_REQUEST_NOTIF_TYPES] },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    })

    const unreadCount = rows.filter((n) => !n.read).length

    const notifications = rows.map((n) => {
      const requestId = n.orderId
      const href =
        role === "SUPPLIER" && requestId
          ? `/dashboard/supplier/requests/${requestId}`
          : role === "AFFILIATE" && requestId
            ? `/dashboard/reseller/requests/${requestId}`
            : role === "SUPPLIER"
              ? "/dashboard/supplier/requests"
              : "/dashboard/reseller/requests"

      return {
        id: n.id,
        type: n.type,
        message: n.message,
        requestId,
        imageUrl: n.imageUrl,
        read: n.read,
        createdAt:
          n.createdAt instanceof Date ? n.createdAt.toISOString() : String(n.createdAt),
        relative: formatRequestRelativeFr(n.createdAt),
        href,
      }
    })

    console.log("[api/notifications/requests]", {
      userId: session.user.id,
      count: notifications.length,
      unreadCount,
    })

    return NextResponse.json({
      notifications,
      unreadCount,
      count: notifications.length,
    })
  } catch (err) {
    console.error("[api/notifications/requests]", {
      error: err instanceof Error ? err.message : "unknown",
    })
    return NextResponse.json({
      notifications: [],
      unreadCount: 0,
      count: 0,
    })
  }
}
