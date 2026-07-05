import { auth } from "@/auth"
import { resetCartAbandonmentOnActivity } from "@/lib/cart-abandonment-touch"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const body = (await req.json().catch(() => ({}))) as { quantity?: number }
  const quantity = Math.round(Number(body.quantity))

  const cart = await prisma.cart.findFirst({ where: { userId: session.user.id } })
  if (!cart) {
    return Response.json({ error: "Cart not found" }, { status: 404 })
  }

  const item = await prisma.cartItem.findFirst({
    where: { id, cartId: cart.id },
  })
  if (!item) {
    return Response.json({ error: "Item not found" }, { status: 404 })
  }

  if (!Number.isFinite(quantity) || quantity < 1) {
    await prisma.cartItem.delete({ where: { id } })
    await resetCartAbandonmentOnActivity(cart.id)
    return Response.json({ ok: true, deleted: true })
  }

  const capped = Math.min(99, quantity)
  await prisma.cartItem.update({
    where: { id },
    data: { quantity: capped },
  })
  await resetCartAbandonmentOnActivity(cart.id)

  return Response.json({ ok: true })
}
