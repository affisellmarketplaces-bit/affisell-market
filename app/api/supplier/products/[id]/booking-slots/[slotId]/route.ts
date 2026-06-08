import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

async function assertOwnSlot(supplierId: string, productId: string, slotId: string) {
  return prisma.bookingSlot.findFirst({
    where: { id: slotId, productId, product: { supplierId } },
    select: { id: true, bookedCount: true },
  })
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string; slotId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id, slotId } = await context.params
  const slot = await assertOwnSlot(session.user.id, id, slotId)
  if (!slot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (slot.bookedCount > 0) {
    return NextResponse.json({ error: "slot_has_bookings" }, { status: 409 })
  }

  await prisma.bookingSlot.delete({ where: { id: slotId } })
  console.log("[booking]", { productId: id, result: "slot_deleted", slotId })

  return NextResponse.json({ ok: true })
}
