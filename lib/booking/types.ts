import type { ListingKind } from "@/lib/supplier-commission"

export const BOOKABLE_LISTING_KINDS = [
  "SERVICE",
  "EXPERIENCE",
  "RESTAURANT",
  "MUSEUM",
] as const

export type BookableListingKind = (typeof BOOKABLE_LISTING_KINDS)[number]

/** Phase 1+: checkout flags live in checkout-live.ts */
export {
  BOOKING_EXPERIENCE_CHECKOUT_LIVE,
  BOOKING_MUSEUM_CHECKOUT_LIVE,
  BOOKING_RESTAURANT_CHECKOUT_LIVE,
  BOOKING_SERVICE_CHECKOUT_LIVE,
  isBookingCheckoutBlocked,
  isBookingCheckoutLiveForKind,
} from "@/lib/booking/checkout-live"

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
  seatLabels: string[]
  cancellationPolicyHours: number
  listingKind: string
  productName: string
}

export function isBookableListingKind(
  kind: string | ListingKind | null | undefined
): kind is BookableListingKind {
  const k = typeof kind === "string" ? kind.trim().toUpperCase() : ""
  return (
    k === "SERVICE" ||
    k === "EXPERIENCE" ||
    k === "RESTAURANT" ||
    k === "MUSEUM"
  )
}

export function isServiceListingKind(kind: string | ListingKind | null | undefined): boolean {
  return typeof kind === "string" && kind.trim().toUpperCase() === "SERVICE"
}

export function isExperienceListingKind(kind: string | ListingKind | null | undefined): boolean {
  return typeof kind === "string" && kind.trim().toUpperCase() === "EXPERIENCE"
}

export function isRestaurantListingKind(kind: string | ListingKind | null | undefined): boolean {
  return typeof kind === "string" && kind.trim().toUpperCase() === "RESTAURANT"
}

export function isMuseumListingKind(kind: string | ListingKind | null | undefined): boolean {
  return typeof kind === "string" && kind.trim().toUpperCase() === "MUSEUM"
}

export function bookingListingKindLabel(kind: string, locale: "fr" | "en" = "fr"): string {
  const k = kind.trim().toUpperCase()
  if (locale === "en") {
    if (k === "SERVICE") return "Service & appointment"
    if (k === "EXPERIENCE") return "Experience & ticket"
    if (k === "RESTAURANT") return "Restaurant reservation"
    if (k === "MUSEUM") return "Museum timed entry"
    return k
  }
  if (k === "SERVICE") return "Service & rendez-vous"
  if (k === "EXPERIENCE") return "Expérience & billet"
  if (k === "RESTAURANT") return "Restaurant & réservation"
  if (k === "MUSEUM") return "Musée & entrée"
  return k
}
