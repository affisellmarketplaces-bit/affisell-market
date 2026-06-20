import { prisma } from "@/lib/prisma"

const TO_SHIP_STATUSES = ["paid", "preparing"] as const

/** Paid/preparing marketplace orders for one supplier (action queue). */
export async function loadSupplierToShipOrderIds(supplierId: string): Promise<Set<string>> {
  const rows = await prisma.order.findMany({
    where: { supplierId, status: { in: [...TO_SHIP_STATUSES] } },
    select: { id: true },
    take: 200,
  })
  return new Set(rows.map((row) => row.id))
}

/**
 * One-time reopen for legacy rows: inbox alert exists but the order flag was never set.
 * After this runs, mark-as-read persists until the order ships.
 */
export async function reopenLegacySupplierToShipAlerts(
  supplierId: string
): Promise<number> {
  const legacyOrders = await prisma.order.findMany({
    where: {
      supplierId,
      status: { in: [...TO_SHIP_STATUSES] },
      merchantSupplierInboxNotifiedAt: null,
    },
    select: { id: true },
    take: 200,
  })

  if (legacyOrders.length === 0) return 0

  const orderIds = legacyOrders.map((row) => row.id)
  const now = new Date()

  const reopened = await prisma.$transaction(async (tx) => {
    const updated = await tx.notification.updateMany({
      where: {
        userId: supplierId,
        type: "NEW_ORDER",
        orderId: { in: orderIds },
        read: true,
      },
      data: { read: false },
    })

    await tx.order.updateMany({
      where: { id: { in: orderIds }, merchantSupplierInboxNotifiedAt: null },
      data: { merchantSupplierInboxNotifiedAt: now },
    })

    return updated.count
  })

  if (reopened > 0) {
    console.log("[supplier-order-alert-inbox]", {
      supplierId,
      reopened,
      result: "legacy_to_ship_reopened",
    })
  }

  return reopened
}

export type SupplierNotificationRow = {
  id: string
  type: string
  message: string
  imageUrl: string | null
  orderId: string | null
  read: boolean
  createdAt: Date
  actionRequired: boolean
}

export function enrichSupplierNotificationRows(
  rows: Array<{
    id: string
    type: string
    message: string
    imageUrl: string | null
    orderId: string | null
    read: boolean
    createdAt: Date
  }>,
  toShipOrderIds: Set<string>
): SupplierNotificationRow[] {
  return rows.map((row) => ({
    ...row,
    actionRequired:
      row.type === "NEW_ORDER" &&
      Boolean(row.orderId?.trim()) &&
      toShipOrderIds.has(row.orderId!.trim()),
  }))
}
