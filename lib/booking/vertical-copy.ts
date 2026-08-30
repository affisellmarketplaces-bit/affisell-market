import {
  isExperienceListingKind,
  isMuseumListingKind,
  isRestaurantListingKind,
} from "@/lib/booking/types"
import type { AppLocale } from "@/lib/i18n-locale"
import { tMessage } from "@/lib/i18n-pick-message"

export type BookingVerticalCopyFamily = "service" | "experience" | "restaurant" | "museum"

export function bookingVerticalCopyFamily(kind: string | null | undefined): BookingVerticalCopyFamily {
  if (isRestaurantListingKind(kind)) return "restaurant"
  if (isMuseumListingKind(kind)) return "museum"
  if (isExperienceListingKind(kind)) return "experience"
  return "service"
}

/** J-0 digest uses vertical copy only when every row shares the same family. */
export function resolveDigestListingKind(
  rows: ReadonlyArray<{ listingKind?: string | null }>
): string | null {
  if (rows.length === 0) return null
  const families = new Set(rows.map((row) => bookingVerticalCopyFamily(row.listingKind)))
  if (families.size !== 1) return null
  const kind = rows.find((row) => row.listingKind?.trim())?.listingKind?.trim()
  return kind ?? null
}

export type BuyerBookingOrderCardCopy = {
  title: string
  hint: string
  cta: string
  cancelCta: string
}

export function buyerBookingOrderCardCopy(
  listingKind: string | null | undefined,
  locale: AppLocale
): BuyerBookingOrderCardCopy {
  const family = bookingVerticalCopyFamily(listingKind)
  const base = `accountOrders.bookingCard.${family}`
  return {
    title: tMessage(locale, `${base}.title`),
    hint: tMessage(locale, `${base}.hint`),
    cta: tMessage(locale, `${base}.cta`),
    cancelCta: tMessage(locale, `${base}.cancelCta`),
  }
}
