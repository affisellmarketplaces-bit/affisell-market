import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { supplierActionToNextStatus } from "@/lib/order-return-state"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(req: Request, ctx: { params: Promise<{ returnId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { returnId } = await ctx.params
  if (!returnId) {
    return Response.json({ error: "Missing return id" }, { status: 400 })
  }

  let body: {
    action?: string
    sellerNote?: string
    rejectionReason?: string
    approvedRefundCents?: number
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const action = body.action as "approve" | "reject" | "mark_received" | "mark_refunded" | undefined
  if (
    action !== "approve" &&
    action !== "reject" &&
    action !== "mark_received" &&
    action !== "mark_refunded"
  ) {
    return Response.json({ error: "Invalid action" }, { status: 400 })
  }

  const ret = await prisma.orderReturn.findFirst({
    where: { id: returnId, order: { supplierId: session.user.id } },
    include: { order: { include: { product: { select: { name: true } } } } },
  })

  if (!ret) {
    return Response.json({ error: "Return not found" }, { status: 404 })
  }

  const next = supplierActionToNextStatus(ret.status, action)
  if (!next) {
    return Response.json({ error: "Action not allowed for this status" }, { status: 400 })
  }

  const sellerNote =
    typeof body.sellerNote === "string" ? body.sellerNote.trim().slice(0, 2000) : undefined

  if (action === "reject") {
    const rejectionReason =
      typeof body.rejectionReason === "string" ? body.rejectionReason.trim().slice(0, 2000) : ""
    if (rejectionReason.length < 4) {
      return Response.json({ error: "rejectionReason is required when rejecting" }, { status: 400 })
    }
    const updated = await prisma.orderReturn.update({
      where: { id: returnId },
      data: {
        status: next,
        rejectionReason,
        sellerNote: sellerNote || null,
      },
    })
    return Response.json({ id: updated.id, status: updated.status })
  }

  if (action === "approve") {
    let approved =
      typeof body.approvedRefundCents === "number" && Number.isFinite(body.approvedRefundCents)
        ? Math.round(body.approvedRefundCents)
        : ret.requestedRefundCents
    approved = Math.max(0, Math.min(approved, ret.order.sellingPriceCents))

    const updated = await prisma.orderReturn.update({
      where: { id: returnId },
      data: {
        status: next,
        approvedRefundCents: approved,
        sellerNote: sellerNote || null,
      },
    })
    return Response.json({
      id: updated.id,
      status: updated.status,
      approvedRefundCents: updated.approvedRefundCents,
    })
  }

  if (action === "mark_received") {
    const updated = await prisma.orderReturn.update({
      where: { id: returnId },
      data: {
        status: next,
        receivedAt: new Date(),
        sellerNote: sellerNote ?? ret.sellerNote,
      },
    })
    return Response.json({ id: updated.id, status: updated.status, receivedAt: updated.receivedAt })
  }

  const updated = await prisma.orderReturn.update({
    where: { id: returnId },
    data: {
      status: next,
      refundedAt: new Date(),
      sellerNote: sellerNote ?? ret.sellerNote,
    },
  })

  return Response.json({ id: updated.id, status: updated.status, refundedAt: updated.refundedAt })
}
