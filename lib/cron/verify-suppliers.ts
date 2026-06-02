import { prisma } from "@/lib/prisma"
import { countSupplierSuccessfulOrders } from "@/lib/supplier/compute-supplier-trust-tier"
import {
  resolveSupplierTrustTier,
  type SupplierTrustTier,
} from "@/lib/supplier/supplier-trust-tier-shared"

const LOOKBACK_DAYS = 90
const SHIPPING_SLA_HOURS = 48
const MIN_RATING = 4.6
const MAX_DISPUTE_RATE = 0.015
const MIN_SHIPPING_SLA = 0.95

type SupplierMetrics = {
  rating: number
  disputeRate: number
  shippingSLA48h: number
}

function roundMetric(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 10_000) / 10_000
}

function buildCutoffs(now: Date): { since90d: Date; since48h: Date } {
  return {
    since90d: new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000),
    since48h: new Date(now.getTime() - SHIPPING_SLA_HOURS * 60 * 60 * 1000),
  }
}

async function computeSupplierMetrics(
  supplierId: string,
  since90d: Date,
  since48h: Date
): Promise<SupplierMetrics> {
  const [reviewsAgg, disputedOrders, eligibleOrders] = await Promise.all([
    prisma.review.aggregate({
      where: {
        status: "PUBLISHED",
        createdAt: { gte: since90d },
        order: { supplierId },
      },
      _avg: { rating: true },
    }),
    prisma.orderReturn.findMany({
      where: {
        createdAt: { gte: since90d },
        status: { not: "REJECTED" },
        order: { supplierId, paidAt: { not: null, gte: since90d } },
      },
      select: { orderId: true },
      distinct: ["orderId"],
    }),
    prisma.order.findMany({
      where: {
        supplierId,
        paidAt: { not: null, gte: since90d, lte: since48h },
      },
      select: { paidAt: true, shippedAt: true },
    }),
  ])

  const paidOrdersCount = eligibleOrders.length
  const shippedWithinSlaCount = eligibleOrders.reduce((count, order) => {
    if (!order.paidAt || !order.shippedAt) return count
    const deltaMs = order.shippedAt.getTime() - order.paidAt.getTime()
    return deltaMs <= SHIPPING_SLA_HOURS * 60 * 60 * 1000 ? count + 1 : count
  }, 0)

  const rating = roundMetric(Number(reviewsAgg._avg.rating ?? 0))
  const disputes = disputedOrders.length
  const disputeRate = paidOrdersCount > 0 ? roundMetric(disputes / paidOrdersCount) : 0
  const shippingSLA48h =
    paidOrdersCount > 0 ? roundMetric(shippedWithinSlaCount / paidOrdersCount) : 0

  return { rating, disputeRate, shippingSLA48h }
}

function qualifies(metrics: SupplierMetrics): boolean {
  return (
    metrics.rating > MIN_RATING &&
    metrics.disputeRate < MAX_DISPUTE_RATE &&
    metrics.shippingSLA48h > MIN_SHIPPING_SLA
  )
}

export async function runVerifySuppliersCron() {
  const now = new Date()
  const { since90d, since48h } = buildCutoffs(now)
  const suppliers = await prisma.user.findMany({
    where: { role: "SUPPLIER" },
    select: { id: true, isVerifiedSupplier: true, supplierTrustTier: true },
  })

  let verifiedNow = 0
  let revokedNow = 0
  let tierUpgrades = 0
  let tierDowngrades = 0

  for (const supplier of suppliers) {
    const metrics = await computeSupplierMetrics(supplier.id, since90d, since48h)
    const successfulOrders = await countSupplierSuccessfulOrders(supplier.id)
    const trustMetrics = {
      successfulOrders,
      rating: metrics.rating,
      disputeRate: metrics.disputeRate,
      shippingSla48h: metrics.shippingSLA48h,
    }
    const nextTier: SupplierTrustTier = resolveSupplierTrustTier(trustMetrics)
    const nextVerified = qualifies(metrics) || nextTier !== "NONE"
    const prevTier = (supplier.supplierTrustTier ?? "NONE") as SupplierTrustTier

    if (nextVerified && !supplier.isVerifiedSupplier) verifiedNow += 1
    if (!nextVerified && supplier.isVerifiedSupplier) revokedNow += 1
    if (nextTier !== prevTier) {
      const rank = (t: SupplierTrustTier) =>
        t === "ORBITAL" ? 3 : t === "FORGE" ? 2 : t === "SPARK" ? 1 : 0
      if (rank(nextTier) > rank(prevTier)) tierUpgrades += 1
      else tierDowngrades += 1
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: supplier.id },
        data: {
          isVerifiedSupplier: nextVerified,
          verifiedAt: nextVerified ? (supplier.isVerifiedSupplier ? undefined : now) : null,
          supplierMetrics: { ...metrics, successfulOrders },
          supplierTrustTier: nextTier,
          supplierTrustTierAt:
            nextTier === "NONE" ? null : nextTier !== prevTier ? now : undefined,
          supplierSuccessfulOrders: successfulOrders,
        },
      }),
      prisma.auditLog.create({
        data: {
          action: "supplier.verification.recomputed",
          entityType: "User",
          entityId: supplier.id,
          payload: {
            metrics,
            successfulOrders,
            trustTier: nextTier,
            previousTrustTier: prevTier,
            verified: nextVerified,
            threshold: {
              minRating: MIN_RATING,
              maxDisputeRate: MAX_DISPUTE_RATE,
              minShippingSLA48h: MIN_SHIPPING_SLA,
            },
            computedAt: now.toISOString(),
          },
        },
      }),
    ])

    console.log("[verify-suppliers]", {
      supplierId: supplier.id,
      verified: nextVerified,
      trustTier: nextTier,
      successfulOrders,
      metrics,
    })
  }

  return {
    scanned: suppliers.length,
    verifiedNow,
    revokedNow,
    tierUpgrades,
    tierDowngrades,
    at: now.toISOString(),
  }
}
