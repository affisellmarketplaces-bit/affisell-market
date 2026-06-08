import { DEFAULT_BOOKING_CANCELLATION_HOURS } from "@/lib/booking/cancellation-policy"
import {
  parseBookingSeatLayout,
  type BookingSeatLayoutConfig,
} from "@/lib/booking/seat-layout"
import { isBookableListingKind } from "@/lib/booking/types"
export type ParsedProductBookingSettings = {
  bookingDurationMinutes: number | null
  bookingCancellationHours: number
  bookingVenueLabel: string | null
  bookingInstantConfirm: boolean
  /** Present only when `bookingSeatLayout` key is in the request body. */
  bookingSeatLayout?: BookingSeatLayoutConfig | null
}

export function parseProductBookingBody(body: Record<string, unknown>): ParsedProductBookingSettings {
  const durationRaw = body.bookingDurationMinutes
  let bookingDurationMinutes: number | null = null
  if (durationRaw !== undefined && durationRaw !== null && durationRaw !== "") {
    const n = Math.round(Number(durationRaw))
    if (Number.isFinite(n) && n >= 5 && n <= 24 * 60) {
      bookingDurationMinutes = n
    }
  }

  const cancelRaw = body.bookingCancellationHours
  const cancelN = Math.round(Number(cancelRaw))
  const bookingCancellationHours =
    Number.isFinite(cancelN) && cancelN >= 0 && cancelN <= 168
      ? cancelN
      : DEFAULT_BOOKING_CANCELLATION_HOURS

  const venueRaw = body.bookingVenueLabel
  const bookingVenueLabel =
    typeof venueRaw === "string" && venueRaw.trim().length > 0 ? venueRaw.trim().slice(0, 200) : null

  const instantRaw = body.bookingInstantConfirm
  const bookingInstantConfirm =
    instantRaw === undefined || instantRaw === null
      ? true
      : instantRaw === true || instantRaw === "true" || instantRaw === 1 || instantRaw === "1"

  const layoutProvided = "bookingSeatLayout" in body
  const bookingSeatLayout = layoutProvided
    ? body.bookingSeatLayout === null
      ? null
      : parseBookingSeatLayout(body.bookingSeatLayout)
    : undefined

  return {
    bookingDurationMinutes,
    bookingCancellationHours,
    bookingVenueLabel,
    bookingInstantConfirm,
    ...(layoutProvided ? { bookingSeatLayout } : {}),
  }
}

/** Phase 0: bookable listings can be saved as draft; live checkout arrives Phase 1. */
export function validateBookingListingForPublish(
  listingKind: string,
  saveAsDraft: boolean
): string | null {
  if (saveAsDraft || !isBookableListingKind(listingKind)) return null
  return null
}
