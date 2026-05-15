import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import {
  buyerOwnsOrder,
  getActiveReturn,
  hasBlockingReturnHistory,
  isWithinReturnWindow,
  parseEvidenceUrls,
  sellerRespondByFromNow,
} from "@/lib/order-return-policy"
import { RETURN_REASON_CODES, type ReturnReasonCode } from "@/lib/order-return-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const session = await auth()
  if (!session?.user?.email || !session.user.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { orderId } = await ctx.params
  if (!orderId) {
    return Response.json({ error: "Missing order id" }, { status: 400 })
  }

  let body: {
    reasonCode?: string
    reasonDetail?: string
    evidenceUrls?: unknown
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const reasonCode = body.reasonCode as ReturnReasonCode | undefined
  if (!reasonCode || !RETURN_REASON_CODES.includes(reasonCode as ReturnReasonCode)) {
    return Response.json({ error: "Invalid or missing reasonCode" }, { status: 400 })
  }

  const reasonDetail =
    typeof body.reasonDetail === "string" ? body.reasonDetail.trim().slice(0, 2000) : undefined
  const evidenceUrls = parseEvidenceUrls(body.evidenceUrls)

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { returns: true, product: { select: { name: true } } },
  })

  if (!order) {
    return Response.json({ error: "Order not found" }, { status: 404 })
  }

  if (!buyerOwnsOrder(order, session.user.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  if (order.status !== "paid" && order.status !== "preparing" && order.status !== "shipped") {
    return Response.json({ error: "Returns are not available for this order state." }, { status: 400 })
  }

  if (!isWithinReturnWindow(order)) {
    return Response.json({ error: "Return window has expired" }, { status: 400 })
  }

  const active = getActiveReturn(order.returns)
  if (active) {
    return Response.json({ error: "A return is already in progress for this order" }, { status: 409 })
  }
  if (hasBlockingReturnHistory(order.returns)) {
    return Response.json({ error: "A return was already opened for this order" }, { status: 409 })
  }

  const ret = await prisma.orderReturn.create({
    data: {
      orderId: order.id,
      buyerUserId: session.user.id,
      status: "REQUESTED",
      reasonCode,
      reasonDetail: reasonDetail || null,
      evidenceUrls,
      requestedRefundCents: order.sellingPriceCents,
      sellerRespondByAt: sellerRespondByFromNow(),
    },
  })

  await prisma.notification.create({
    data: {
      userId: order.supplierId,
      type: "RETURN_REQUESTED",
      message: `Return requested · ${order.product.name} · respond by ${ret.sellerRespondByAt?.toISOString().slice(0, 10) ?? "soon"}`,
      orderId: order.id,
    },
  })

  return Response.json({
    id: ret.id,
    status: ret.status,
    reasonCode: ret.reasonCode,
    sellerRespondByAt: ret.sellerRespondByAt?.toISOString() ?? null,
  })
}
