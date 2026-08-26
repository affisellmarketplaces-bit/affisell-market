import {
  FulfillmentGroupStatus,
  IntegrationProvider,
  IntegrationStatus,
  type PrismaClient,
} from "@prisma/client"

import { MANUAL_REQUIRED_GROUP_WHERE } from "@/lib/ing/manual-supplier-nudge"

const ESCALATION_MIN_NUDGES = 3
const ESCALATION_FULFILLMENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export type IngEscalationCandidate = {
  supplierId: string
  email: string
  name: string
  nudges: number
  lastNudgeAt: string
  manualGroups: number
  daysSinceLastOrder: number | null
}

/**
 * Suppliers with ≥3 nudges and no auto-fulfillment progress in 30d (still manual_required).
 */
export async function checkEscalation(prisma: PrismaClient): Promise<IngEscalationCandidate[]> {
  const fulfillmentSince = new Date(Date.now() - ESCALATION_FULFILLMENT_WINDOW_MS)

  const nudgeLogs = await prisma.ingNudgeLog.findMany({
    orderBy: { createdAt: "desc" },
    select: { supplierId: true, createdAt: true },
  })

  const nudgeBySupplier = new Map<string, { count: number; lastNudgeAt: Date }>()
  for (const row of nudgeLogs) {
    const prev = nudgeBySupplier.get(row.supplierId)
    if (!prev) {
      nudgeBySupplier.set(row.supplierId, { count: 1, lastNudgeAt: row.createdAt })
      continue
    }
    prev.count += 1
    if (row.createdAt > prev.lastNudgeAt) prev.lastNudgeAt = row.createdAt
  }

  const escalatedIds = [...nudgeBySupplier.entries()]
    .filter(([, agg]) => agg.count >= ESCALATION_MIN_NUDGES)
    .map(([supplierId]) => supplierId)

  if (escalatedIds.length === 0) return []

  const [users, connected, manualGroupCounts, fulfilledRecently, lastOrders] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: escalatedIds } },
      select: { id: true, email: true, name: true },
    }),
    prisma.supplierIntegration.findMany({
      where: {
        userId: { in: escalatedIds },
        status: IntegrationStatus.CONNECTED,
        enabled: true,
        provider: { in: [IntegrationProvider.SHOPIFY, IntegrationProvider.WOOCOMMERCE] },
      },
      select: { userId: true },
    }),
    prisma.fulfillmentGroup.groupBy({
      by: ["supplierId"],
      where: MANUAL_REQUIRED_GROUP_WHERE,
      _count: { _all: true },
    }),
    prisma.fulfillmentGroup.findMany({
      where: {
        supplierId: { in: escalatedIds },
        updatedAt: { gte: fulfillmentSince },
        OR: [
          { supplierIntegrationId: { not: null } },
          { status: { in: [FulfillmentGroupStatus.SHIPPED, FulfillmentGroupStatus.DELIVERED] } },
        ],
      },
      select: { supplierId: true },
      distinct: ["supplierId"],
    }),
    prisma.order.groupBy({
      by: ["supplierId"],
      where: { supplierId: { in: escalatedIds } },
      _max: { createdAt: true },
    }),
  ])

  const userById = new Map(users.map((u) => [u.id, u]))
  const connectedIds = new Set(connected.map((c) => c.userId))
  const manualBySupplier = new Map(manualGroupCounts.map((g) => [g.supplierId, g._count._all]))
  const fulfilledIds = new Set(fulfilledRecently.map((g) => g.supplierId))
  const lastOrderBySupplier = new Map(
    lastOrders.map((o) => [o.supplierId, o._max.createdAt ?? null])
  )

  const candidates: IngEscalationCandidate[] = []

  for (const supplierId of escalatedIds) {
    if (connectedIds.has(supplierId)) continue
    if (fulfilledIds.has(supplierId)) continue

    const manualGroups = manualBySupplier.get(supplierId) ?? 0
    if (manualGroups === 0) continue

    const user = userById.get(supplierId)
    if (!user?.email?.trim()) continue

    const agg = nudgeBySupplier.get(supplierId)!
    const lastOrderAt = lastOrderBySupplier.get(supplierId) ?? null
    const daysSinceLastOrder =
      lastOrderAt === null
        ? null
        : Math.floor((Date.now() - lastOrderAt.getTime()) / (24 * 60 * 60 * 1000))

    candidates.push({
      supplierId,
      email: user.email.trim(),
      name: user.name?.trim() || "Supplier",
      nudges: agg.count,
      lastNudgeAt: agg.lastNudgeAt.toISOString(),
      manualGroups,
      daysSinceLastOrder,
    })
  }

  return candidates.sort((a, b) => b.nudges - a.nudges)
}
