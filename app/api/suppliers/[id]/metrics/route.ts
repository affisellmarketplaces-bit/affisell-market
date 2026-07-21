import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { ensureSupplierMetrics } from "@/lib/logistics/supplier-metrics.server"
import {
  formatTrustTooltip,
  getSupplierBadge,
} from "@/lib/logistics/supplier-score"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

/**
 * GET /api/suppliers/[id]/metrics — trust metrics + badge + recent reviews.
 */
export async function GET(_req: Request, ctx: RouteCtx) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 })
  }

  const { id: supplierId } = await ctx.params
  const supplier = await prisma.user.findFirst({
    where: { id: supplierId, role: "SUPPLIER" },
    select: {
      id: true,
      name: true,
      email: true,
      trustScore: true,
      isTopSupplier: true,
    },
  })
  if (!supplier) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const metrics = await ensureSupplierMetrics(supplierId)
  const badge = getSupplierBadge(metrics.trustScore)
  const reviews = await prisma.deliveryReview.findMany({
    where: { supplierId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      rating: true,
      promisedDays: true,
      actualDays: true,
      isOnTime: true,
      comment: true,
      createdAt: true,
    },
  })

  const onTimeRate =
    metrics.totalOrders > 0 ? metrics.onTimeDeliveries / metrics.totalOrders : 1

  console.log("[api/suppliers/metrics]", {
    supplierId,
    trustScore: metrics.trustScore,
    reviews: reviews.length,
  })

  return NextResponse.json({
    supplier: {
      id: supplier.id,
      name: supplier.name,
      trustScore: metrics.trustScore,
      isTopSupplier: supplier.isTopSupplier || metrics.trustScore >= 90,
    },
    metrics: {
      totalOrders: metrics.totalOrders,
      onTimeDeliveries: metrics.onTimeDeliveries,
      onTimeRate,
      avgDeliveryDays: metrics.avgDeliveryDays,
      promisedVsActualDelta: metrics.promisedVsActualDelta,
      trustScore: metrics.trustScore,
      deliveryScore: metrics.deliveryScore,
      responseTimeAvg: metrics.responseTimeAvg,
      disputeRate: metrics.disputeRate,
      lastUpdated: metrics.lastUpdated.toISOString(),
    },
    badge,
    tooltip: formatTrustTooltip(metrics),
    reviews: reviews.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  })
}
