import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { createProductRequestCommissionDraft } from "@/lib/product-request-commission.server"
import { PRODUCT_REQUEST_NOTIF } from "@/lib/product-request-notif-constants"
import { serializeProductQuote } from "@/lib/product-request-types"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string; quoteId: string }> }

/**
 * POST — reseller accepts one quote → reject others → fulfill request → draft listing.
 */
export async function POST(_req: Request, ctx: RouteCtx) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 })
  }
  if (session.user.role !== "AFFILIATE") {
    return NextResponse.json({ error: "affiliate_role_required" }, { status: 403 })
  }

  const { id: requestId, quoteId } = await ctx.params

  const request = await prisma.productRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      imageUrl: true,
      status: true,
      resellerId: true,
    },
  })
  if (!request) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  if (request.resellerId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }
  if (request.status !== "open") {
    return NextResponse.json({ error: "request_not_open" }, { status: 409 })
  }

  const quote = await prisma.productQuote.findFirst({
    where: { id: quoteId, requestId },
  })
  if (!quote) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 })
  }
  if (quote.status !== "pending") {
    return NextResponse.json({ error: "quote_not_pending" }, { status: 409 })
  }

  const otherQuotes = await prisma.productQuote.findMany({
    where: {
      requestId,
      id: { not: quoteId },
      status: "pending",
    },
    select: { id: true, supplierId: true },
  })

  await prisma.$transaction(async (tx) => {
    await tx.productQuote.update({
      where: { id: quoteId },
      data: { status: "accepted" },
    })
    if (otherQuotes.length > 0) {
      await tx.productQuote.updateMany({
        where: { id: { in: otherQuotes.map((q) => q.id) } },
        data: { status: "rejected" },
      })
    }
    await tx.productRequest.update({
      where: { id: requestId },
      data: { status: "fulfilled" },
    })
  })

  const updatedQuote = await prisma.productQuote.findUniqueOrThrow({
    where: { id: quoteId },
  })

  let affiliateProductId: string | null = null
  try {
    const draft = await createProductRequestCommissionDraft({
      requestId: request.id,
      title: request.title,
      description: request.description,
      category: request.category,
      imageUrl: request.imageUrl,
      resellerId: request.resellerId,
      supplierId: quote.supplierId,
      unitPrice: quote.price,
      moq: quote.moq,
      deliveryDays: quote.deliveryDays,
    })
    affiliateProductId = draft?.affiliateProductId ?? null
  } catch (err) {
    console.warn("[api/requests/accept]", {
      step: "commission_draft_failed",
      message: err instanceof Error ? err.message : "unknown",
      requestId,
    })
  }

  try {
    await prisma.notification.create({
      data: {
        userId: quote.supplierId,
        type: PRODUCT_REQUEST_NOTIF.QUOTE_ACCEPTED,
        message: `Ton devis pour ${request.title} a été accepté!`,
        imageUrl: request.imageUrl,
        orderId: requestId,
      },
    })
    const loserIds = [...new Set(otherQuotes.map((q) => q.supplierId))]
    if (loserIds.length > 0) {
      await prisma.notification.createMany({
        data: loserIds.map((userId) => ({
          userId,
          type: PRODUCT_REQUEST_NOTIF.REQUEST_FULFILLED,
          message: `Demande ${request.title} pourvue`,
          imageUrl: request.imageUrl,
          orderId: requestId,
        })),
      })
    }
  } catch (err) {
    console.warn("[api/requests/accept]", {
      step: "notify_failed",
      message: err instanceof Error ? err.message : "unknown",
    })
  }

  console.log("[api/requests/accept]", {
    requestId,
    quoteId,
    affiliateProductId,
    result: "accepted",
  })

  return NextResponse.json({
    quote: serializeProductQuote(updatedQuote),
    affiliateProductId,
    requestStatus: "fulfilled",
  })
}
