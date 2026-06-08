import { NextResponse } from "next/server"

import { listPublicBookingSlots } from "@/lib/booking/slot-availability"
import { isBookableListingKind } from "@/lib/booking/types"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const productId = url.searchParams.get("productId")?.trim() ?? ""
  if (!productId) {
    return NextResponse.json({ error: "productId required" }, { status: 400 })
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, active: true, isDraft: false },
    select: { id: true, listingKind: true },
  })
  if (!product || !isBookableListingKind(product.listingKind)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const slots = await listPublicBookingSlots(productId)
  return NextResponse.json({ slots })
}
