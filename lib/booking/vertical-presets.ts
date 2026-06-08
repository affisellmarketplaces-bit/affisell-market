import type { BookableListingKind } from "@/lib/booking/types"

export type BookingVerticalPreset = {
  defaultDurationMinutes: number
  defaultSlotCapacity: number
  defaultCancellationHours: number
  holdMinutes: number
}

const PRESETS: Record<BookableListingKind, BookingVerticalPreset> = {
  SERVICE: {
    defaultDurationMinutes: 60,
    defaultSlotCapacity: 1,
    defaultCancellationHours: 24,
    holdMinutes: 45,
  },
  EXPERIENCE: {
    defaultDurationMinutes: 120,
    defaultSlotCapacity: 30,
    defaultCancellationHours: 24,
    holdMinutes: 12,
  },
  RESTAURANT: {
    defaultDurationMinutes: 90,
    defaultSlotCapacity: 8,
    defaultCancellationHours: 24,
    holdMinutes: 15,
  },
  MUSEUM: {
    defaultDurationMinutes: 120,
    defaultSlotCapacity: 40,
    defaultCancellationHours: 48,
    holdMinutes: 12,
  },
}

export function bookingVerticalPreset(kind: string): BookingVerticalPreset {
  const k = kind.trim().toUpperCase()
  if (k in PRESETS) return PRESETS[k as BookableListingKind]
  return PRESETS.SERVICE
}

/** Multi-guest timed entry (covers, tickets) — not 1:1 SERVICE slots. */
export function isMultiCapacityBookingKind(kind: string | null | undefined): boolean {
  const k = typeof kind === "string" ? kind.trim().toUpperCase() : ""
  return k === "EXPERIENCE" || k === "RESTAURANT" || k === "MUSEUM"
}

export function isSingleGuestBookingKind(kind: string | null | undefined): boolean {
  return typeof kind === "string" && kind.trim().toUpperCase() === "SERVICE"
}
