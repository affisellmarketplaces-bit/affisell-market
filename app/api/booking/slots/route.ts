import { NextResponse } from "next/server"

import { listPublicBookingSlots } from "@/lib/booking/slot-availability"
import { prisma } from "@/lib/prisma"
import { isServiceListingKind } from "@/lib/booking/types"

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
  if (!product || !isServiceListingKind(product.listingKind)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const slots = await listPublicBookingSlots(productId)
  return NextResponse.json({ slots })
}
