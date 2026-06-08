import type { SupplierBookingRosterRow } from "@/lib/supplier-booking-roster-payload"

export type SupplierBookingStats = {
  totalGuests: number
  checkedInGuests: number
  pendingGuests: number
  noShowGuests: number
  /** % of guests on past slots who checked in; null if no past slots yet. */
  checkInRatePct: number | null
  orderCount: number
}

export function computeSupplierBookingStats(
  rows: SupplierBookingRosterRow[],
  now: Date = new Date()
): SupplierBookingStats {
  let checkedInGuests = 0
  let pendingGuests = 0
  let noShowGuests = 0
  let pastSlotGuestTotal = 0
  let pastSlotCheckedIn = 0

  for (const row of rows) {
    const qty = Math.max(1, row.quantity)
    if (row.checkedIn) {
      checkedInGuests += qty
    } else {
      pendingGuests += qty
    }

    const slotStart = row.slotStartsAt ? new Date(row.slotStartsAt) : null
    const slotPast =
      slotStart != null &&
      Number.isFinite(slotStart.getTime()) &&
      slotStart.getTime() < now.getTime()

    if (slotPast) {
      pastSlotGuestTotal += qty
      if (row.checkedIn) {
        pastSlotCheckedIn += qty
      } else {
        noShowGuests += qty
      }
    }
  }

  const checkInRatePct =
    pastSlotGuestTotal > 0 ? Math.round((pastSlotCheckedIn / pastSlotGuestTotal) * 100) : null

  return {
    totalGuests: checkedInGuests + pendingGuests,
    checkedInGuests,
    pendingGuests,
    noShowGuests,
    checkInRatePct,
    orderCount: rows.length,
  }
}
