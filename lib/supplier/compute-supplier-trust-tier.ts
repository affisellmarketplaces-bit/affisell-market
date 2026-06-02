import { prisma } from "@/lib/prisma"
import {
  resolveSupplierTrustTier,
  type SupplierTrustMetrics,
  type SupplierTrustTier,
} from "@/lib/supplier/supplier-trust-tier-shared"

const SUCCESSFUL_ORDER_STATUSES = [
  "paid",
  "preparing",
  "shipped",
  "delivered",
  "completed",
] as const

export async function countSupplierSuccessfulOrders(supplierId: string): Promise<number> {
  return prisma.order.count({
    where: {
      supplierId,
      paidAt: { not: null },
      status: { in: [...SUCCESSFUL_ORDER_STATUSES] },
      autoCancelledAt: null,
      cancelledEmailSentAt: null,
    },
  })
}

export async function loadSupplierTrustSnapshot(supplierId: string): Promise<{
  metrics: SupplierTrustMetrics
  tier: SupplierTrustTier
}> {
  const [successfulOrders, user] = await Promise.all([
    countSupplierSuccessfulOrders(supplierId),
    prisma.user.findUnique({
      where: { id: supplierId },
      select: { supplierMetrics: true },
    }),
  ])

  const raw = user?.supplierMetrics
  const snapshot =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}

  const metrics: SupplierTrustMetrics = {
    successfulOrders,
    rating: typeof snapshot.rating === "number" ? snapshot.rating : 0,
    disputeRate: typeof snapshot.disputeRate === "number" ? snapshot.disputeRate : 0,
    shippingSla48h: typeof snapshot.shippingSLA48h === "number" ? snapshot.shippingSLA48h : 0,
  }

  return { metrics, tier: resolveSupplierTrustTier(metrics) }
}
