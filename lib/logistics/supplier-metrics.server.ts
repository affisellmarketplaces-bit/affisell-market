import "server-only"

import {
  calculateDeliveryScore,
  calculateTrustScore,
  isSuspiciousLowRater,
} from "@/lib/logistics/supplier-score"
import { prisma } from "@/lib/prisma"

export type ApplyDeliveryReviewInput = {
  supplierId: string
  resellerId: string
  promisedDays: number
  actualDays: number
  rating: number
  comment: string | null
  requestId: string | null
  quoteId: string | null
  orderId: string | null
}

/**
 * Idempotent on (resellerId, quoteId) when quoteId set.
 * Recalculates SupplierMetrics + User.trustScore / isTopSupplier.
 */
export async function applyDeliveryReview(input: ApplyDeliveryReviewInput): Promise<{
  reviewId: string
  trustScore: number
  deliveryScore: number
  isTopSupplier: boolean
  suspiciousReviewer: boolean
}> {
  const isOnTime = input.actualDays <= input.promisedDays
  const thisDeliveryScore = calculateDeliveryScore(input.promisedDays, input.actualDays)

  if (input.quoteId) {
    const existing = await prisma.deliveryReview.findUnique({
      where: {
        resellerId_quoteId: {
          resellerId: input.resellerId,
          quoteId: input.quoteId,
        },
      },
      select: { id: true },
    })
    if (existing) {
      const metrics = await ensureSupplierMetrics(input.supplierId)
      return {
        reviewId: existing.id,
        trustScore: metrics.trustScore,
        deliveryScore: metrics.deliveryScore,
        isTopSupplier: metrics.trustScore >= 90,
        suspiciousReviewer: false,
      }
    }
  }

  const review = await prisma.deliveryReview.create({
    data: {
      supplierId: input.supplierId,
      resellerId: input.resellerId,
      promisedDays: input.promisedDays,
      actualDays: input.actualDays,
      isOnTime,
      rating: input.rating,
      comment: input.comment,
      requestId: input.requestId,
      quoteId: input.quoteId,
      orderId: input.orderId,
    },
    select: { id: true },
  })

  const metrics = await recalculateSupplierMetrics(input.supplierId, thisDeliveryScore)

  const recent = await prisma.deliveryReview.findMany({
    where: { resellerId: input.resellerId },
    select: { rating: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  })
  const suspiciousReviewer = isSuspiciousLowRater({
    reviewCount: recent.length,
    onesCount: recent.filter((r) => r.rating === 1).length,
  })
  if (suspiciousReviewer) {
    console.warn("[trust]", {
      step: "suspicious_reviewer",
      resellerId: input.resellerId,
      ones: recent.filter((r) => r.rating === 1).length,
      total: recent.length,
    })
  }

  return {
    reviewId: review.id,
    trustScore: metrics.trustScore,
    deliveryScore: metrics.deliveryScore,
    isTopSupplier: metrics.trustScore >= 90,
    suspiciousReviewer,
  }
}

export async function ensureSupplierMetrics(supplierId: string) {
  const existing = await prisma.supplierMetrics.findUnique({ where: { supplierId } })
  if (existing) return existing
  return prisma.supplierMetrics.create({
    data: { supplierId },
  })
}

/** Full recompute from DeliveryReview history + optional last deliveryScore blend. */
export async function recalculateSupplierMetrics(
  supplierId: string,
  lastDeliveryScore?: number
) {
  const reviews = await prisma.deliveryReview.findMany({
    where: { supplierId },
    select: {
      promisedDays: true,
      actualDays: true,
      isOnTime: true,
      rating: true,
    },
  })

  const totalOrders = reviews.length
  const onTimeDeliveries = reviews.filter((r) => r.isOnTime).length
  const avgDeliveryDays =
    totalOrders > 0
      ? reviews.reduce((s, r) => s + r.actualDays, 0) / totalOrders
      : 0
  const promisedVsActualDelta =
    totalOrders > 0
      ? reviews.reduce((s, r) => s + (r.actualDays - r.promisedDays), 0) / totalOrders
      : 0

  const deliveryScores = reviews.map((r) =>
    calculateDeliveryScore(r.promisedDays, r.actualDays)
  )
  if (lastDeliveryScore != null) deliveryScores.push(lastDeliveryScore)
  const deliveryScore =
    deliveryScores.length > 0
      ? Math.round(deliveryScores.reduce((a, b) => a + b, 0) / deliveryScores.length)
      : 75

  // Quote response time: avg minutes between request create and quote create
  const quotes = await prisma.productQuote.findMany({
    where: { supplierId },
    select: { createdAt: true, request: { select: { createdAt: true } } },
    take: 50,
    orderBy: { createdAt: "desc" },
  })
  let responseTimeAvg = 0
  if (quotes.length > 0) {
    const mins = quotes.map((q) =>
      Math.max(0, Math.round((q.createdAt.getTime() - q.request.createdAt.getTime()) / 60_000))
    )
    responseTimeAvg = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length)
  }

  const trustScore = calculateTrustScore({
    totalOrders,
    onTimeDeliveries,
    avgDeliveryDays,
    promisedVsActualDelta,
    disputeRate: 0,
    responseTimeAvg,
  })
  const isTopSupplier = trustScore >= 90

  const metrics = await prisma.supplierMetrics.upsert({
    where: { supplierId },
    create: {
      supplierId,
      totalOrders,
      onTimeDeliveries,
      avgDeliveryDays,
      promisedVsActualDelta,
      trustScore,
      deliveryScore,
      responseTimeAvg,
      disputeRate: 0,
      lastUpdated: new Date(),
    },
    update: {
      totalOrders,
      onTimeDeliveries,
      avgDeliveryDays,
      promisedVsActualDelta,
      trustScore,
      deliveryScore,
      responseTimeAvg,
      lastUpdated: new Date(),
    },
  })

  await prisma.user.update({
    where: { id: supplierId },
    data: { trustScore, isTopSupplier },
  })

  console.log("[trust]", {
    supplierId,
    trustScore,
    deliveryScore,
    totalOrders,
    onTimeDeliveries,
    result: "metrics_updated",
  })

  return metrics
}

export async function recalculateAllSupplierDeliveryTrust(limit = 500): Promise<{
  updated: number
  lowScore: Array<{ supplierId: string; email: string | null; trustScore: number }>
}> {
  const suppliers = await prisma.user.findMany({
    where: { role: "SUPPLIER" },
    select: { id: true, email: true },
    take: limit,
    orderBy: { createdAt: "desc" },
  })

  const lowScore: Array<{ supplierId: string; email: string | null; trustScore: number }> = []
  let updated = 0
  for (const s of suppliers) {
    const m = await recalculateSupplierMetrics(s.id)
    updated += 1
    if (m.trustScore < 50) {
      lowScore.push({ supplierId: s.id, email: s.email, trustScore: m.trustScore })
    }
  }
  return { updated, lowScore }
}
