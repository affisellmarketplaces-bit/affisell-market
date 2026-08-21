import { prisma } from "@/lib/prisma"

const TO_SHIP_STATUSES = ["paid", "preparing"] as const
const LEGACY_REOPEN_MIN_INTERVAL_MS = 60_000

const lastLegacyReopenAtBySupplier = new Map<string, number>()

export type SupplierToShipSnapshot = {
  orderIds: Set<string>
  ordersToShipCount: number
}

/** Single round-trip for badge count + action-required order ids (notifications poll). */
export async function loadSupplierToShipSnapshot(
  supplierId: string,
  options?: { notificationOrderIds?: string[] }
): Promise<SupplierToShipSnapshot> {
  const blindProfile = await prisma.blindDropshipSupplier.findUnique({
    where: { linkedUserId: supplierId },
    select: { id: true },
  })

  const marketplaceWhere = { supplierId, status: { in: [...TO_SHIP_STATUSES] } }
  const notifOrderIds = (options?.notificationOrderIds ?? []).filter(Boolean)

  const [marketplaceRows, marketplaceCount, blindCount] = await Promise.all([
    notifOrderIds.length > 0
      ? prisma.order.findMany({
          where: { ...marketplaceWhere, id: { in: notifOrderIds } },
          select: { id: true },
        })
      : Promise.resolve([]),
    prisma.order.count({ where: marketplaceWhere }),
    blindProfile
      ? prisma.blindDropshipOrder.count({
          where: {
            status: { in: ["paid", "fulfilling", "awaiting_manual_payment"] },
            items: { some: { blindDropshipSupplierId: blindProfile.id } },
          },
        })
      : Promise.resolve(0),
  ])

  return {
    orderIds: new Set(marketplaceRows.map((row) => row.id)),
    ordersToShipCount: marketplaceCount + blindCount,
  }
}

/** Paid/preparing marketplace orders for one supplier (action queue). */
export async function loadSupplierToShipOrderIds(supplierId: string): Promise<Set<string>> {
  const snapshot = await loadSupplierToShipSnapshot(supplierId)
  return snapshot.orderIds
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

/** Throttled legacy reopen — avoids transaction on every 3s notification poll. */
export async function reopenLegacySupplierToShipAlertsIfDue(
  supplierId: string,
  options?: { force?: boolean }
): Promise<number> {
  const now = Date.now()
  const last = lastLegacyReopenAtBySupplier.get(supplierId) ?? 0
  if (!options?.force && now - last < LEGACY_REOPEN_MIN_INTERVAL_MS) {
    return 0
  }
  const reopened = await reopenLegacySupplierToShipAlerts(supplierId)
  lastLegacyReopenAtBySupplier.set(supplierId, now)
  return reopened
}

/** @internal test helper */
export function resetLegacySupplierToShipReopenThrottleForTests(): void {
  lastLegacyReopenAtBySupplier.clear()
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
