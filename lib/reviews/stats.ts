import type { Prisma, ReviewStatus } from "@prisma/client"

import { legacyImagesToMedia, parseReviewMedia, reviewHasUgc } from "@/lib/reviews/media"
import { prisma } from "@/lib/prisma"

const PUBLISHED: ReviewStatus = "PUBLISHED"

export async function recomputeProductReviewStats(productId: string) {
  const rows = await prisma.review.findMany({
    where: { productId, status: PUBLISHED },
    select: { rating: true, media: true, images: true, sentiment: true },
  })

  const reviewCount = rows.length
  const averageRating =
    reviewCount > 0 ? rows.reduce((s, r) => s + r.rating, 0) / reviewCount : 0
  const ugcCount = rows.filter((r) =>
    reviewHasUgc(parseReviewMedia(r.media), r.images)
  ).length

  const avg = reviewCount > 0 ? parseFloat(averageRating.toFixed(2)) : 0
  const sentiment =
    avg >= 4 ? "positive" : avg >= 3 ? "neutral" : reviewCount > 0 ? "negative" : "neutral"

  await prisma.product.update({
    where: { id: productId },
    data: {
      reviewCount,
      averageRating: avg,
      ugcCount,
      reviewSentiment: sentiment,
    },
  })

  return { reviewCount, averageRating: avg, ugcCount, reviewSentiment: sentiment }
}

export async function getRatingDistribution(productId: string): Promise<Record<number, number>> {
  const stats = await prisma.review.groupBy({
    by: ["rating"],
    where: { productId, status: PUBLISHED },
    _count: { rating: true },
  })
  return [5, 4, 3, 2, 1].reduce(
    (acc, star) => {
      acc[star] = stats.find((s) => s.rating === star)?._count.rating ?? 0
      return acc
    },
    {} as Record<number, number>
  )
}

export function orderIsReviewEligible(order: {
  buyerUserId: string | null
  deliveredAt: Date | null
  shippedAt: Date | null
}): boolean {
  if (!order.buyerUserId) return false
  return Boolean(order.deliveredAt ?? order.shippedAt)
}

export type ReviewWherePublished = Prisma.ReviewWhereInput

export function publishedReviewWhere(productId: string): ReviewWherePublished {
  return { productId, status: PUBLISHED }
}
