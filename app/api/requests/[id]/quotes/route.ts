import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { PRODUCT_REQUEST_NOTIF } from "@/lib/product-request-notif-constants"
import { serializeProductQuote } from "@/lib/product-request-types"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PostBody = {
  price?: unknown
  moq?: unknown
  deliveryDays?: unknown
  message?: unknown
}

type RouteCtx = { params: Promise<{ id: string }> }

/**
 * POST — supplier creates one quote on an open ProductRequest.
 * GET — list quotes (reseller: all; supplier: own only).
 */
export async function POST(req: Request, ctx: RouteCtx) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 })
  }
  if (session.user.role !== "SUPPLIER") {
    return NextResponse.json({ error: "supplier_role_required" }, { status: 403 })
  }

  const { id: requestId } = await ctx.params
  if (!requestId) {
    return NextResponse.json({ error: "request_id_required" }, { status: 400 })
  }

  const request = await prisma.productRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      title: true,
      status: true,
      resellerId: true,
      imageUrl: true,
    },
  })
  if (!request) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  if (request.status !== "open") {
    return NextResponse.json({ error: "request_not_open" }, { status: 409 })
  }

  const existing = await prisma.productQuote.findUnique({
    where: {
      requestId_supplierId: {
        requestId,
        supplierId: session.user.id,
      },
    },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json({ error: "already_quoted", quoteId: existing.id }, { status: 409 })
  }

  const body = (await req.json().catch(() => ({}))) as PostBody
  const price =
    typeof body.price === "number" && Number.isFinite(body.price) && body.price > 0
      ? body.price
      : null
  const moq =
    typeof body.moq === "number" && Number.isFinite(body.moq)
      ? Math.max(1, Math.min(100_000, Math.round(body.moq)))
      : null
  const deliveryDays =
    typeof body.deliveryDays === "number" && Number.isFinite(body.deliveryDays)
      ? Math.max(1, Math.min(365, Math.round(body.deliveryDays)))
      : null
  const message =
    typeof body.message === "string" ? body.message.trim().slice(0, 4000) : null

  if (price == null || moq == null || deliveryDays == null) {
    return NextResponse.json(
      { error: "price_moq_delivery_required" },
      { status: 400 }
    )
  }

  const supplierName = session.user.name?.trim() || null
  const supplierEmail = session.user.email?.trim() || null

  const quote = await prisma.$transaction(async (tx) => {
    const created = await tx.productQuote.create({
      data: {
        requestId,
        supplierId: session.user.id,
        supplierName,
        supplierEmail,
        price,
        moq,
        deliveryDays,
        message: message || null,
        status: "pending",
      },
    })
    await tx.productRequest.update({
      where: { id: requestId },
      data: { quotesCount: { increment: 1 } },
    })
    return created
  })

  try {
    await prisma.notification.create({
      data: {
        userId: request.resellerId,
        type: PRODUCT_REQUEST_NOTIF.NEW_QUOTE,
        message: `Nouveau devis ${price}€ pour ${request.title}`,
        imageUrl: request.imageUrl,
        orderId: requestId,
      },
    })
  } catch (err) {
    console.warn("[api/requests/quotes]", {
      step: "notify_reseller_failed",
      message: err instanceof Error ? err.message : "unknown",
    })
  }

  console.log("[api/requests/quotes]", {
    requestId,
    quoteId: quote.id,
    supplierId: session.user.id,
    price,
    result: "quote_created",
  })

  return NextResponse.json({ quote: serializeProductQuote(quote) })
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 })
  }

  const { id: requestId } = await ctx.params
  const request = await prisma.productRequest.findUnique({
    where: { id: requestId },
    select: { id: true, resellerId: true, status: true },
  })
  if (!request) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const role = session.user.role
  if (role === "AFFILIATE") {
    if (request.resellerId !== session.user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }
    const quotes = await prisma.productQuote.findMany({
      where: { requestId },
      orderBy: { price: "asc" },
    })
    return NextResponse.json({
      quotes: quotes.map(serializeProductQuote),
      count: quotes.length,
    })
  }

  if (role === "SUPPLIER") {
    const quotes = await prisma.productQuote.findMany({
      where: { requestId, supplierId: session.user.id },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({
      quotes: quotes.map(serializeProductQuote),
      count: quotes.length,
    })
  }

  return NextResponse.json({ error: "forbidden" }, { status: 403 })
}
