import { NextResponse } from "next/server"

import { listPublicSeatMap } from "@/lib/booking/named-seats"
import { isBookableListingKind } from "@/lib/booking/types"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const slotId = url.searchParams.get("slotId")?.trim() ?? ""
  const productId = url.searchParams.get("productId")?.trim() ?? ""
  if (!slotId || !productId) {
    return NextResponse.json({ error: "slotId and productId required" }, { status: 400 })
  }

  const slot = await prisma.bookingSlot.findFirst({
    where: {
      id: slotId,
      productId,
      product: { active: true, isDraft: false },
    },
    select: {
      id: true,
      capacity: true,
      product: { select: { listingKind: true } },
    },
  })
  if (!slot || !isBookableListingKind(slot.product.listingKind)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const seats = await listPublicSeatMap(slotId)
  return NextResponse.json({
    slotId,
    capacity: slot.capacity,
    seats,
    hasNamedSeats: seats.length > 0,
  })
}
