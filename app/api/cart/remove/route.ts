import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { resetCartAbandonmentOnActivity } from "@/lib/cart-abandonment-touch"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { itemId?: string }
  const itemId = typeof body.itemId === "string" ? body.itemId.trim() : ""
  if (!itemId) {
    return NextResponse.json({ error: "Missing itemId" }, { status: 400 })
  }

  const item = await prisma.cartItem.findFirst({
    where: {
      id: itemId,
      cart: { userId: session.user.id },
    },
    select: { cartId: true },
  })

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.cartItem.delete({ where: { id: itemId } })
  await resetCartAbandonmentOnActivity(item.cartId)

  return NextResponse.json({ success: true })
}
