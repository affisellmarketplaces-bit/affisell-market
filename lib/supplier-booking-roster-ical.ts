import { buildIcalCalendar, escapeIcal, formatIcalUtc } from "@/lib/booking/ical-format"
import type { SupplierBookingRosterRow } from "@/lib/supplier-booking-roster-payload"

export function buildSupplierBookingRosterIcal(
  rows: SupplierBookingRosterRow[],
  calendarName = "Affisell Bookings"
): string {
  const events = rows
    .filter((row) => row.slotStartsAt)
    .map((row) => {
      const start = new Date(row.slotStartsAt!)
      const end = row.slotEndsAt ? new Date(row.slotEndsAt) : new Date(start.getTime() + 60 * 60 * 1000)
      if (!Number.isFinite(start.getTime())) return null
      const endSafe = Number.isFinite(end.getTime()) ? end : new Date(start.getTime() + 60 * 60 * 1000)
      const seats =
        row.seatLabels.length > 0 ? row.seatLabels.join(", ") : `×${Math.max(1, row.quantity)}`
      const summary = escapeIcal(`${row.productName} · ${seats}`)
      const description = escapeIcal(
        [
          `Guest: ${row.customerEmail}`,
          row.venueLabel ? `Venue: ${row.venueLabel}` : null,
          row.slotLabel ? `Slot: ${row.slotLabel}` : null,
          row.checkedIn ? "Checked in" : "Pending check-in",
        ]
          .filter(Boolean)
          .join("\\n")
      )
      const uid = `affisell-booking-${row.orderId}@affisell.com`
      return [
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${formatIcalUtc(new Date())}`,
        `DTSTART:${formatIcalUtc(start)}`,
        `DTEND:${formatIcalUtc(endSafe)}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        "END:VEVENT",
      ].join("\r\n")
    })
    .filter((block): block is string => block != null)

  return buildIcalCalendar(events, calendarName)
}

export function rosterIcalFilename(slotId?: string | null): string {
  const stamp = new Date().toISOString().slice(0, 10)
  return slotId ? `affisell-booking-${slotId.slice(0, 8)}-${stamp}.ics` : `affisell-booking-roster-${stamp}.ics`
}
