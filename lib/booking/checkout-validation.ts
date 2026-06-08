import { NextResponse } from "next/server"

import {
  isBookableListingKind,
  isBookingCheckoutLiveForKind,
  isServiceListingKind,
} from "@/lib/booking/types"
import { loadBookingSlotForCheckout } from "@/lib/booking/slot-availability"

type ListingProduct = {
  id: string
  listingKind: string
}

export async function validateBookableListingCheckout(args: {
  product: ListingProduct
  quantity: number
  bookingSlotId: unknown
}): Promise<NextResponse | { slotId: string; quantity: number } | null> {
  const kind = args.product.listingKind
  if (!isBookableListingKind(kind)) return null
  if (!isBookingCheckoutLiveForKind(kind)) {
    return NextResponse.json({ error: "booking_checkout_coming_soon" }, { status: 409 })
  }

  const qty = Math.max(1, Math.min(99, Math.round(Number(args.quantity)) || 1))
  if (isServiceListingKind(kind) && qty !== 1) {
    return NextResponse.json({ error: "booking_service_qty_one" }, { status: 400 })
  }

  const slotId = typeof args.bookingSlotId === "string" ? args.bookingSlotId.trim() : ""
  if (!slotId) {
    return NextResponse.json({ error: "booking_slot_required" }, { status: 400 })
  }

  const slotCheck = await loadBookingSlotForCheckout({
    productId: args.product.id,
    slotId,
    quantity: qty,
  })
  if (!slotCheck.ok) {
    return NextResponse.json({ error: slotCheck.error }, { status: 409 })
  }
  return { slotId, quantity: qty }
}

/** @deprecated Use validateBookableListingCheckout */
export const validateServiceBookingCheckout = validateBookableListingCheckout

export function validateBookingCartLine(product: ListingProduct): NextResponse | null {
  if (!isBookableListingKind(product.listingKind)) return null
  if (!isBookingCheckoutLiveForKind(product.listingKind)) return null
  return NextResponse.json({ error: "booking_use_single_checkout" }, { status: 400 })
}

/** @deprecated Use validateBookingCartLine */
export const validateServiceBookingCartLine = validateBookingCartLine
