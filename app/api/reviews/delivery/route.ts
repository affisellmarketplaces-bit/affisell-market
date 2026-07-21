import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { applyDeliveryReview } from "@/lib/logistics/supplier-metrics.server"
import { calculateDeliveryScore } from "@/lib/logistics/supplier-score"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PostBody = {
  supplierId?: unknown
  requestId?: unknown
  quoteId?: unknown
  orderId?: unknown
  promisedDays?: unknown
  actualDays?: unknown
  rating?: unknown
  comment?: unknown
}

/**
 * POST /api/reviews/delivery — reseller rates promised vs actual delivery.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 })
  }
  if (session.user.role !== "AFFILIATE") {
    return NextResponse.json({ error: "affiliate_role_required" }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as PostBody
  const supplierId = typeof body.supplierId === "string" ? body.supplierId.trim() : ""
  const requestId =
    typeof body.requestId === "string" && body.requestId.trim() ? body.requestId.trim() : null
  const quoteId =
    typeof body.quoteId === "string" && body.quoteId.trim() ? body.quoteId.trim() : null
  const orderId =
    typeof body.orderId === "string" && body.orderId.trim() ? body.orderId.trim() : null

  const promisedDays =
    typeof body.promisedDays === "number" && Number.isFinite(body.promisedDays)
      ? Math.max(1, Math.round(body.promisedDays))
      : null
  const actualDays =
    typeof body.actualDays === "number" && Number.isFinite(body.actualDays)
      ? Math.max(0, Math.round(body.actualDays))
      : null
  const rating =
    typeof body.rating === "number" && Number.isFinite(body.rating)
      ? Math.max(1, Math.min(5, Math.round(body.rating)))
      : null
  const comment =
    typeof body.comment === "string" ? body.comment.trim().slice(0, 2000) || null : null

  if (!supplierId || promisedDays == null || actualDays == null || rating == null) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }
  if (!quoteId && !orderId && !requestId) {
    return NextResponse.json({ error: "quote_or_order_required" }, { status: 400 })
  }

  if (quoteId) {
    const quote = await prisma.productQuote.findFirst({
      where: { id: quoteId, supplierId },
      include: { request: { select: { resellerId: true, id: true } } },
    })
    if (!quote || quote.request.resellerId !== session.user.id) {
      return NextResponse.json({ error: "forbidden_quote" }, { status: 403 })
    }
    if (quote.status !== "accepted") {
      return NextResponse.json({ error: "quote_not_accepted" }, { status: 409 })
    }
  }

  if (requestId) {
    const request = await prisma.productRequest.findFirst({
      where: { id: requestId, resellerId: session.user.id },
      select: { id: true },
    })
    if (!request) {
      return NextResponse.json({ error: "forbidden_request" }, { status: 403 })
    }
  }

  try {
    const result = await applyDeliveryReview({
      supplierId,
      resellerId: session.user.id,
      promisedDays,
      actualDays,
      rating,
      comment,
      requestId,
      quoteId,
      orderId,
    })

    try {
      await prisma.notification.create({
        data: {
          userId: supplierId,
          type: "DELIVERY_REVIEW",
          message: `Nouvelle évaluation: ${rating}/5 - Livré en ${actualDays}j au lieu de ${promisedDays}j`,
          orderId: requestId ?? orderId ?? quoteId,
        },
      })
    } catch (err) {
      console.warn("[api/reviews/delivery]", {
        step: "notify_failed",
        message: err instanceof Error ? err.message : "unknown",
      })
    }

    console.log("[api/reviews/delivery]", {
      reviewId: result.reviewId,
      supplierId,
      trustScore: result.trustScore,
      deliveryScore: calculateDeliveryScore(promisedDays, actualDays),
      suspiciousReviewer: result.suspiciousReviewer,
    })

    return NextResponse.json({
      ok: true,
      ...result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown"
    if (message.includes("Unique constraint") || message.includes("unique")) {
      return NextResponse.json({ error: "already_reviewed" }, { status: 409 })
    }
    console.error("[api/reviews/delivery]", { error: message })
    return NextResponse.json({ error: "review_failed" }, { status: 500 })
  }
}
