import { auth } from "@/auth"
import { loadBuyerOrderDetail } from "@/lib/buyer-order-detail-load"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ orderId: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { orderId } = await ctx.params
  if (!orderId) {
    return Response.json({ error: "Missing order id" }, { status: 400 })
  }

  const detail = await loadBuyerOrderDetail(orderId, session.user.email)
  if (!detail) {
    return Response.json({ error: "Order not found" }, { status: 404 })
  }

  return Response.json(detail)
}
