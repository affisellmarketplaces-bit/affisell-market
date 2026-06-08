import { NextResponse } from "next/server"

import { listPublicSeatMapWithLayout } from "@/lib/booking/named-seats"
import { gridColumnCount, resolveSeatLayoutConfig } from "@/lib/booking/seat-layout"
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
      product: { select: { listingKind: true, bookingSeatLayout: true } },
    },
  })
  if (!slot || !isBookableListingKind(slot.product.listingKind)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const layoutConfig = resolveSeatLayoutConfig(
    slot.product.bookingSeatLayout,
    slot.product.listingKind
  )
  const seats = await listPublicSeatMapWithLayout(slotId, layoutConfig)
  return NextResponse.json({
    slotId,
    capacity: slot.capacity,
    seats,
    hasNamedSeats: seats.length > 0,
    layout: {
      preset: layoutConfig.preset,
      gridCols: gridColumnCount(layoutConfig),
      aisleAfterCols: layoutConfig.aisleAfterCols ?? [],
      vipRowIndices: layoutConfig.vipRowIndices ?? [],
    },
  })
}
