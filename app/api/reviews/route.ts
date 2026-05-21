import { type NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"
import { capturePosthog } from "@/lib/analytics/posthog"
import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { mediaToJson, parseReviewMedia, reviewHasUgc } from "@/lib/reviews/media"
import { moderateReviewText } from "@/lib/reviews/moderation"
import { createReviewSchema } from "@/lib/reviews/schemas"
import { revalidateProductReviews } from "@/lib/reviews/revalidate"
import { sanitizeReviewText } from "@/lib/reviews/sanitize"
import { orderIsReviewEligible, recomputeProductReviewStats } from "@/lib/reviews/stats"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const limited = rateLimitResponse(rateLimitClientKey(req, session.user.id), {
    limit: 3,
    windowMs: 86_400_000,
    prefix: "review-create",
  })
  if (limited) return limited

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = createReviewSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { productId, orderId, rating, title, body, media: mediaIn } = parsed.data
  const bodyClean = sanitizeReviewText(body, 2000)
  const titleClean = title ? sanitizeReviewText(title, 120) : null

  const media = parseReviewMedia(mediaIn)
  for (const m of media) {
    if (m.type === "video" && (m.duration ?? 0) > 60) {
      return NextResponse.json({ error: "Video must be 60 seconds or less" }, { status: 400 })
    }
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, buyerUserId: session.user.id, productId },
    select: {
      id: true,
      productId: true,
      buyerUserId: true,
      deliveredAt: true,
      shippedAt: true,
      buyerReview: { select: { id: true } },
    },
  })

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }
  if (order.buyerReview) {
    return NextResponse.json({ error: "You already reviewed this order" }, { status: 409 })
  }
  if (!orderIsReviewEligible(order)) {
    return NextResponse.json({ error: "Order is not eligible for review yet" }, { status: 403 })
  }

  const mod = await moderateReviewText(titleClean, bodyClean)
  const autoReject = mod.aiScore != null && mod.aiScore > 0.9 && mod.flagged
  const status = autoReject ? "REJECTED" : mod.flagged ? "AI_FLAGGED" : "PUBLISHED"
  const publishedAt = status === "PUBLISHED" ? new Date() : null

  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.review.create({
      data: {
        productId,
        orderId,
        userId: session.user.id,
        rating,
        title: titleClean,
        body: bodyClean,
        media: mediaToJson(media),
        verified: true,
        aiScore: mod.aiScore,
        sentiment: rating >= 4 ? "positive" : rating >= 3 ? "neutral" : "negative",
        status,
        moderationNote: mod.moderationNote,
        publishedAt,
        author: session.user.name ?? "Verified buyer",
        date: new Date(),
      },
    })

    if (status === "PUBLISHED") {
      await recomputeProductReviewStats(productId)
    }

    return created
  })

  revalidateProductReviews(productId)

  capturePosthog(
    "review_submitted",
    {
      rating,
      hasMedia: reviewHasUgc(media, []),
      aiFlagged: status === "AI_FLAGGED",
      productId,
    },
    session.user.id
  )

  return NextResponse.json({
    review: {
      id: review.id,
      status: review.status,
      publishedAt: review.publishedAt?.toISOString() ?? null,
    },
  })
}
