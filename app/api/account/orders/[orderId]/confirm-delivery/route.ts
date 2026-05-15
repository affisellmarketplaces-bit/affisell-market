import { auth } from "@/auth"
import { confirmOrderDeliveryByBuyer } from "@/lib/order-payout"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ orderId: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { orderId } = await ctx.params
  const result = await confirmOrderDeliveryByBuyer(
    orderId,
    session.user.id?.trim() || null,
    session.user.email
  )

  if (!result.ok) {
    const status =
      result.error === "forbidden"
        ? 403
        : result.error === "not_found"
          ? 404
          : 409
    return Response.json({ error: result.error }, { status })
  }

  return Response.json({
    ok: true,
    payoutEligibleAt: result.payoutEligibleAt,
    message: result.message,
  })
}
