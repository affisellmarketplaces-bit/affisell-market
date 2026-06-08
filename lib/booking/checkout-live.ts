import type { ListingKind } from "@/lib/supplier-commission"

import { isBookableListingKind } from "@/lib/booking/types"

/** Phase 1: coiffeur / rendez-vous SERVICE checkout live. */
export const BOOKING_SERVICE_CHECKOUT_LIVE = true

/** Phase 1: cinéma & événements EXPERIENCE checkout live (multi-places). */
export const BOOKING_EXPERIENCE_CHECKOUT_LIVE = true

export function isBookingCheckoutLiveForKind(kind: string | ListingKind | null | undefined): boolean {
  const k = typeof kind === "string" ? kind.trim().toUpperCase() : ""
  if (k === "SERVICE") return BOOKING_SERVICE_CHECKOUT_LIVE
  if (k === "EXPERIENCE") return BOOKING_EXPERIENCE_CHECKOUT_LIVE
  return false
}

export function isBookingCheckoutBlocked(kind: string | ListingKind | null | undefined): boolean {
  return isBookableListingKind(kind) && !isBookingCheckoutLiveForKind(kind)
}
