import { NextResponse } from "next/server"

import {
  isBookingCheckoutLiveForKind,
  isServiceListingKind,
} from "@/lib/booking/types"
import { loadBookingSlotForCheckout } from "@/lib/booking/slot-availability"

type ListingProduct = {
  id: string
  listingKind: string
}

export async function validateServiceBookingCheckout(args: {
  product: ListingProduct
  quantity: number
  bookingSlotId: unknown
}): Promise<NextResponse | { slotId: string } | null> {
  const kind = args.product.listingKind
  if (!isServiceListingKind(kind)) return null
  if (!isBookingCheckoutLiveForKind(kind)) {
    return NextResponse.json({ error: "booking_checkout_coming_soon" }, { status: 409 })
  }
  if (args.quantity !== 1) {
    return NextResponse.json({ error: "booking_service_qty_one" }, { status: 400 })
  }
  const slotId = typeof args.bookingSlotId === "string" ? args.bookingSlotId.trim() : ""
  if (!slotId) {
    return NextResponse.json({ error: "booking_slot_required" }, { status: 400 })
  }
  const slotCheck = await loadBookingSlotForCheckout({
    productId: args.product.id,
    slotId,
    quantity: 1,
  })
  if (!slotCheck.ok) {
    return NextResponse.json({ error: slotCheck.error }, { status: 409 })
  }
  return { slotId }
}

export function validateServiceBookingCartLine(product: ListingProduct): NextResponse | null {
  if (!isServiceListingKind(product.listingKind)) return null
  return NextResponse.json({ error: "booking_use_single_checkout" }, { status: 400 })
}
