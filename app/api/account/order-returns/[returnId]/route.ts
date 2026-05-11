import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { buyerOwnsOrder } from "@/lib/order-return-policy"
import { buyerActionToNextStatus } from "@/lib/order-return-state"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(req: Request, ctx: { params: Promise<{ returnId: string }> }) {
  const session = await auth()
  if (!session?.user?.email) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { returnId } = await ctx.params
  if (!returnId) {
    return Response.json({ error: "Missing return id" }, { status: 400 })
  }

  let body: { action?: string; buyerTrackingCarrier?: string; buyerTrackingNumber?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const action = body.action
  if (action !== "cancel" && action !== "submit_tracking") {
    return Response.json({ error: "Invalid action" }, { status: 400 })
  }

  const ret = await prisma.orderReturn.findUnique({
    where: { id: returnId },
    include: { order: true },
  })

  if (!ret) {
    return Response.json({ error: "Return not found" }, { status: 404 })
  }

  if (!buyerOwnsOrder(ret.order, session.user.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const next = buyerActionToNextStatus(ret.status, action)
  if (!next) {
    return Response.json({ error: "Action not allowed for this status" }, { status: 400 })
  }

  if (action === "cancel") {
    const updated = await prisma.orderReturn.update({
      where: { id: returnId },
      data: { status: "CANCELLED" },
    })
    return Response.json({ id: updated.id, status: updated.status })
  }

  const carrier = typeof body.buyerTrackingCarrier === "string" ? body.buyerTrackingCarrier.trim() : ""
  const number = typeof body.buyerTrackingNumber === "string" ? body.buyerTrackingNumber.trim() : ""
  if (carrier.length < 2 || carrier.length > 120 || number.length < 3 || number.length > 120) {
    return Response.json({ error: "Valid tracking carrier and number are required" }, { status: 400 })
  }

  const updated = await prisma.orderReturn.update({
    where: { id: returnId },
    data: {
      status: next,
      buyerTrackingCarrier: carrier,
      buyerTrackingNumber: number,
      buyerShippedAt: new Date(),
    },
  })

  await prisma.notification.create({
    data: {
      userId: ret.order.supplierId,
      type: "RETURN_IN_TRANSIT",
      message: `Return shipped · tracking ${carrier} ${number}`,
      orderId: ret.order.id,
    },
  })

  return Response.json({
    id: updated.id,
    status: updated.status,
    buyerTrackingCarrier: updated.buyerTrackingCarrier,
    buyerTrackingNumber: updated.buyerTrackingNumber,
  })
}
