import { NextResponse } from "next/server"

import {
  isBookableListingKind,
  isBookingCheckoutLiveForKind,
  isExperienceListingKind,
  isServiceListingKind,
} from "@/lib/booking/types"
import { slotHasNamedSeats } from "@/lib/booking/named-seats"
import { loadBookingSlotForCheckout } from "@/lib/booking/slot-availability"

type ListingProduct = {
  id: string
  listingKind: string
}

export function parseBookingSeatLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [
    ...new Set(
      raw
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter(Boolean)
    ),
  ]
}

export async function validateBookableListingCheckout(args: {
  product: ListingProduct
  quantity: number
  bookingSlotId: unknown
  bookingSeatLabels?: unknown
}): Promise<
  NextResponse | { slotId: string; quantity: number; seatLabels: string[] } | null
> {
  const kind = args.product.listingKind
  if (!isBookableListingKind(kind)) return null
  if (!isBookingCheckoutLiveForKind(kind)) {
    return NextResponse.json({ error: "booking_checkout_coming_soon" }, { status: 409 })
  }

  const seatLabels = parseBookingSeatLabels(args.bookingSeatLabels)
  let qty = Math.max(1, Math.min(99, Math.round(Number(args.quantity)) || 1))
  if (seatLabels.length > 0) qty = seatLabels.length

  if (isServiceListingKind(kind) && qty !== 1) {
    return NextResponse.json({ error: "booking_service_qty_one" }, { status: 400 })
  }

  const slotId = typeof args.bookingSlotId === "string" ? args.bookingSlotId.trim() : ""
  if (!slotId) {
    return NextResponse.json({ error: "booking_slot_required" }, { status: 400 })
  }

  const namedMap = await slotHasNamedSeats(slotId)
  if (namedMap && seatLabels.length === 0) {
    return NextResponse.json({ error: "booking_seats_required" }, { status: 400 })
  }
  if (isExperienceListingKind(kind) && seatLabels.length > 0 && seatLabels.length !== qty) {
    return NextResponse.json({ error: "booking_seats_qty_mismatch" }, { status: 400 })
  }

  const slotCheck = await loadBookingSlotForCheckout({
    productId: args.product.id,
    slotId,
    quantity: qty,
  })
  if (!slotCheck.ok) {
    return NextResponse.json({ error: slotCheck.error }, { status: 409 })
  }
  return { slotId, quantity: qty, seatLabels }
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
