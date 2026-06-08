import type { ListingKind } from "@/lib/supplier-commission"

export const BOOKABLE_LISTING_KINDS = ["SERVICE", "EXPERIENCE"] as const

export type BookableListingKind = (typeof BOOKABLE_LISTING_KINDS)[number]

/** Phase 0: checkout slot picker ships in Phase 1 — keep false until wired. */
export const BOOKING_CHECKOUT_LIVE = false

export type BookingProductFields = {
  listingKind: string
  bookingDurationMinutes: number | null
  bookingCancellationHours: number
  bookingVenueLabel: string | null
  bookingInstantConfirm: boolean
  name: string
}

export type BookingSnapshot = {
  slotId: string
  startsAt: string
  endsAt: string
  label: string | null
  venueLabel: string | null
  quantity: number
  cancellationPolicyHours: number
  listingKind: string
  productName: string
}

export function isBookableListingKind(kind: string | ListingKind | null | undefined): kind is BookableListingKind {
  const k = typeof kind === "string" ? kind.trim().toUpperCase() : ""
  return k === "SERVICE" || k === "EXPERIENCE"
}

export function isServiceListingKind(kind: string | ListingKind | null | undefined): boolean {
  return typeof kind === "string" && kind.trim().toUpperCase() === "SERVICE"
}

export function isExperienceListingKind(kind: string | ListingKind | null | undefined): boolean {
  return typeof kind === "string" && kind.trim().toUpperCase() === "EXPERIENCE"
}

export function isBookingCheckoutBlocked(kind: string | ListingKind | null | undefined): boolean {
  return isBookableListingKind(kind) && !BOOKING_CHECKOUT_LIVE
}

export function bookingListingKindLabel(kind: string, locale: "fr" | "en" = "fr"): string {
  const k = kind.trim().toUpperCase()
  if (locale === "en") {
    if (k === "SERVICE") return "Service & appointment"
    if (k === "EXPERIENCE") return "Experience & ticket"
    return k
  }
  if (k === "SERVICE") return "Service & rendez-vous"
  if (k === "EXPERIENCE") return "Expérience & billet"
  return k
}
