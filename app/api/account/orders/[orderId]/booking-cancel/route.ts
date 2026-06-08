import { auth } from "@/auth"
import { cancelBookingOrderForBuyer } from "@/lib/booking/cancel-order"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Buyer cancels a confirmed booking inside the free cancellation window (auto refund). */
export async function POST(_req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const session = await auth()
  if (!session?.user?.email) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { orderId } = await ctx.params
  if (!orderId?.trim()) {
    return Response.json({ error: "Missing order id" }, { status: 400 })
  }

  const result = await cancelBookingOrderForBuyer({
    orderId: orderId.trim(),
    buyerUserId: session.user.id ?? null,
    buyerEmail: session.user.email,
  })

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status ?? 400 })
  }

  return Response.json({
    ok: true,
    refundPending: result.refundPending,
    stripeRefundId: result.stripeRefundId ?? null,
  })
}
